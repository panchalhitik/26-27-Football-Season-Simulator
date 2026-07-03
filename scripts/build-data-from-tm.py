#!/usr/bin/env python3
"""
Build src/data/players.json from the community Transfermarkt API.

This script runs ONCE on your laptop (not inside the app). It walks the top
7 competitions → clubs → players → market value, normalises the output, and
overwrites src/data/players.json. The app itself remains 100% offline.

Usage:
    pip install requests tqdm
    python scripts/build-data-from-tm.py

The output schema matches what src/data/players.ts expects.

API docs: https://transfermarkt-api.fly.dev/docs

Rate-limit note: this script makes hundreds of requests. The API isn't
rate-limited in any documented way but be polite — there's a built-in
0.4s sleep between calls and per-club caching. Expect 10–25 minutes.
"""

from __future__ import annotations

import json
import re
import sys
import time
import unicodedata
from pathlib import Path
from typing import Any, Iterable

try:
    import requests
    from tqdm import tqdm
except ImportError:
    print("Missing deps. Install with: pip install requests tqdm")
    sys.exit(1)


BASE = "https://transfermarkt-api.fly.dev"
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "data" / "players.json"
CLUBS_TS = ROOT / "src" / "data" / "clubs.ts"

# ─────────────────────────────────────────────────────────── leagues ──

# Map our internal Club.league IDs to Transfermarkt competition IDs.
# These rarely change.
COMPETITIONS: dict[str, dict[str, str]] = {
    "PL":    {"name": "Premier League",  "tm_id": "GB1"},
    "LL":    {"name": "LaLiga",          "tm_id": "ES1"},
    "SA":    {"name": "Serie A",         "tm_id": "IT1"},
    "BL":    {"name": "Bundesliga",      "tm_id": "L1"},
    "L1":    {"name": "Ligue 1",         "tm_id": "FR1"},
    "ER":    {"name": "Eredivisie",      "tm_id": "NL1"},
    "PT":    {"name": "Primeira Liga",   "tm_id": "PO1"},
}

# Map TM-style club name → our internal club id. We only assign players to
# named clubs for our 12 hand-built club entries; everyone else lands in
# the 'market' bucket so they remain buyable but unassigned.
CLUB_NAME_TO_ID: dict[str, str] = {
    "Manchester United": "manutd",
    "Manchester City":   "mancity",
    "Arsenal FC":        "arsenal",
    "Arsenal":           "arsenal",
    "Liverpool FC":      "liverpool",
    "Liverpool":         "liverpool",
    "Tottenham Hotspur": "spurs",
    "Chelsea FC":        "chelsea",
    "Chelsea":           "chelsea",
    "Real Madrid":       "realmadrid",
    "FC Barcelona":      "barcelona",
    "Bayern Munich":     "bayern",
    "Bayern München":    "bayern",
    "Juventus FC":       "juventus",
    "Juventus":          "juventus",
    "Inter Milan":       "inter",
    "Internazionale":    "inter",
    "Paris Saint-Germain": "psg",
    "Paris SG":          "psg",
}

# ───────────────────────────────────────────────────────── helpers ──

session = requests.Session()


def fetch(path: str) -> Any:
    """GET helper with simple retry + small polite sleep."""
    url = f"{BASE}{path}"
    for attempt in range(3):
        try:
            r = session.get(url, timeout=20)
            r.raise_for_status()
            time.sleep(0.4)
            return r.json()
        except (requests.RequestException, ValueError) as e:
            if attempt == 2:
                print(f"  GET {url} failed: {e}", file=sys.stderr)
                return None
            time.sleep(1.5 * (attempt + 1))
    return None


def slugify(name: str) -> str:
    """Stable string id, used internally."""
    norm = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", norm.lower()).strip("-")


def parse_market_value(raw: Any) -> float:
    """TM returns market value as "€80.00m" or "€500k" or null. → millions GBP."""
    if not raw:
        return 1.0
    s = str(raw).replace("€", "").strip().lower()
    if s.endswith("m"):
        try:
            return float(s[:-1]) * 0.87  # EUR → GBP rough rate
        except ValueError:
            return 1.0
    if s.endswith("k"):
        try:
            return float(s[:-1]) * 0.87 / 1000
        except ValueError:
            return 0.1
    try:
        return float(s) * 0.87 / 1_000_000
    except ValueError:
        return 1.0


# Position-string normalisation. TM uses long-form names ("Centre-Back",
# "Defensive Midfield"); our app uses short codes ("CB", "CDM").
POSITION_MAP: dict[str, str] = {
    "Goalkeeper": "GK",
    "Centre-Back": "CB",
    "Left-Back": "LB",
    "Right-Back": "RB",
    "Defensive Midfield": "CDM",
    "Central Midfield": "CM",
    "Attacking Midfield": "CAM",
    "Left Midfield": "LM",
    "Right Midfield": "RM",
    "Left Winger": "LW",
    "Right Winger": "RW",
    "Centre-Forward": "ST",
    "Second Striker": "CAM",
    "Striker": "ST",
}

POSITION_GROUP: dict[str, str] = {
    "GK": "GK",
    "CB": "DEF", "LB": "DEF", "RB": "DEF",
    "CDM": "MID", "CM": "MID", "CAM": "MID", "LM": "MID", "RM": "MID",
    "LW": "FWD", "RW": "FWD", "ST": "FWD",
}


def normalize_position(raw: str) -> str:
    return POSITION_MAP.get(raw, "CM")


def wage_estimate(market_value_m: float, age: int) -> int:
    """
    Rough wage from market value. TM doesn't publish wages; we estimate.
    Heuristic: wage ≈ marketValue × (40 .. 70) per year → convert to weekly k£.
    """
    factor = 55 if 22 <= age <= 30 else 40
    weekly_thousand = (market_value_m * factor) / 52
    return max(8, int(round(weekly_thousand)))


def rating_from_value(value_m: float, age: int) -> int:
    """
    Derive a FIFA-style rating (60..94) from market value + age.
    The Transfermarkt API doesn't expose a rating field, so we infer it from
    how the market has priced the player. Calibrated against typical bands:
      £1M ≈ 68, £5M ≈ 75, £15M ≈ 80, £40M ≈ 84, £80M ≈ 87, £150M ≈ 90, £250M+ ≈ 93
    Wonderkids under 22 get +1; veterans over 32 lose a point, over 35 lose 2.
    """
    import math
    v = max(0.5, value_m)
    base = 68 + 10 * math.log10(v)
    if age < 22:
        base += 1
    if age > 35:
        base -= 2
    elif age > 32:
        base -= 1
    return min(94, max(60, round(base)))


def potential_from_rating(rating: int, age: int) -> int:
    if age <= 19:
        bonus = 7
    elif age <= 21:
        bonus = 5
    elif age <= 23:
        bonus = 3
    elif age <= 26:
        bonus = 2
    elif age <= 29:
        bonus = 1
    else:
        bonus = 0
    return min(95, rating + bonus)


# ────────────────────────────────────────────────────────── pipeline ──

def fetch_clubs(competition_id: str) -> list[dict[str, str]]:
    """List of {id, name} for clubs in a given TM competition this season."""
    data = fetch(f"/competitions/{competition_id}/clubs")
    if not data:
        return []
    clubs = data.get("clubs") or data.get("data") or []
    return [{"id": str(c.get("id")), "name": c.get("name", "")} for c in clubs if c.get("id")]


def fetch_players(club_tm_id: str) -> list[dict[str, Any]]:
    """List of player records for a TM club id."""
    data = fetch(f"/clubs/{club_tm_id}/players")
    if not data:
        return []
    return data.get("players") or data.get("squad") or data.get("data") or []


def build() -> None:
    next_id = 1
    out: list[dict[str, Any]] = []

    for league_id, comp in COMPETITIONS.items():
        print(f"\n── {comp['name']} ({league_id})")
        clubs = fetch_clubs(comp["tm_id"])
        if not clubs:
            print(f"  no clubs returned, skipping")
            continue
        print(f"  {len(clubs)} clubs")
        for club in tqdm(clubs, desc=f"  {league_id}", leave=False):
            players = fetch_players(club["id"])
            # Assign to our internal club id if recognised, else market.
            target_club_id = CLUB_NAME_TO_ID.get(club["name"], "market")
            for pl in players:
                name = pl.get("name") or pl.get("playerName")
                if not name:
                    continue
                raw_pos = pl.get("position") or pl.get("mainPosition") or "Central Midfield"
                pos = normalize_position(raw_pos)
                group = POSITION_GROUP[pos]
                age = int(pl.get("age") or 25)
                value_m = parse_market_value(pl.get("marketValue"))
                rating = rating_from_value(value_m, age)
                contract_end = pl.get("contract") or ""
                # Crude contract-years-left: parse "2027-06-30" style.
                contract_years = 3
                m = re.search(r"(20\d\d)", str(contract_end))
                if m:
                    year = int(m.group(1))
                    contract_years = max(1, min(5, year - 2026))

                pid = f"p-{next_id:04d}"
                next_id += 1
                out.append({
                    "id": pid,
                    "name": name,
                    "age": age,
                    "position": pos,
                    "group": group,
                    "rating": rating,
                    "potential": potential_from_rating(rating, age),
                    "marketValueM": round(max(0.5, value_m), 1),
                    "wageK": wage_estimate(value_m, age),
                    "contractYearsLeft": contract_years,
                    "clubId": target_club_id,
                    "foot": pl.get("foot") or "R",
                    "nationality": (pl.get("nationality") or ["Unknown"])[0] if isinstance(pl.get("nationality"), list) else (pl.get("nationality") or "Unknown"),
                    "isStar": rating >= 87 or value_m >= 80,
                })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote {len(out)} players to {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    build()
