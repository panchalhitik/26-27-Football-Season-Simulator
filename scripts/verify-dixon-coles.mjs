// Monte Carlo validation for the Dixon-Coles match engine.
//   npx vite-node scripts/verify-dixon-coles.mjs

import { mulberry32 } from '../src/engine/rng.ts';
import { simulateFixture } from '../src/sim/poisson.ts';
import { runSeasonOnce } from '../src/sim/season.ts';

const N = 5000;

function team(id, attack, defense, chem = 0.7, mor = 50, formation = '4-3-3') {
  return { clubId: id, attack, defense, homeBoost: 5, chemistry01: chem, mor, formationShape: formation };
}

function tally(rng, home, away, leagueAvg) {
  let h = 0, d = 0, a = 0, gf = 0, ga = 0;
  for (let i = 0; i < N; i++) {
    const r = simulateFixture(rng, home, away, leagueAvg);
    if (r.homeGoals > r.awayGoals) h++;
    else if (r.homeGoals < r.awayGoals) a++;
    else d++;
    gf += r.homeGoals;
    ga += r.awayGoals;
  }
  return {
    hwin: (h / N * 100).toFixed(1),
    draw: (d / N * 100).toFixed(1),
    awin: (a / N * 100).toFixed(1),
    score: `${(gf / N).toFixed(2)}–${(ga / N).toFixed(2)}`,
  };
}

function row(label, t) {
  return `${label.padEnd(48)} ${t.hwin.padStart(5)}%  ${t.draw.padStart(5)}%  ${t.awin.padStart(5)}%   ${t.score}`;
}

const rng = mulberry32(42);
const avg = { attack: 75, defense: 75 };

/* ─────────────────────────── 1. Strength gap ──────────────── */
console.log('\n━━━ STRENGTH GAP (squad-quality dominates) ━━━');
console.log('Matchup                                          Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────────');
for (const gap of [0, 5, 10, 15, 20, 30]) {
  const fav = team('fav', 75 + gap / 2, 75 + gap / 2);
  const dog = team('dog', 75 - gap / 2, 75 - gap / 2);
  console.log(row(`Gap ${String(gap).padStart(2)} pts`, tally(rng, fav, dog, avg)));
}

/* ─────────────────────────── 2. Chemistry ──────────────── */
console.log('\n━━━ CHEMISTRY (broken cohesion devastates) ━━━');
console.log('Equal squads, only chemistry differs.\n');
console.log('Matchup                                          Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────────');
for (const [hc, ac] of [[0.95, 0.30], [0.95, 0.55], [0.95, 0.95], [0.30, 0.95]]) {
  const h = team('h', 78, 78, hc);
  const a = team('a', 78, 78, ac);
  console.log(row(`Chem ${hc.toFixed(2)} vs ${ac.toFixed(2)}`, tally(rng, h, a, avg)));
}

/* ─────────────────────────── 3. Manager MOR ──────────────── */
console.log('\n━━━ MANAGER MOR (head-to-head μ tilt, ANTISYMMETRIC) ━━━');
console.log('Equal squads + equal chem, only MOR differs.\n');
console.log('Matchup                                          Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────────');
for (const [hm, am] of [[90, 30], [80, 50], [50, 50], [30, 90]]) {
  const h = team('h', 78, 78, 0.7, hm);
  const a = team('a', 78, 78, 0.7, am);
  console.log(row(`MOR ${String(hm).padStart(2)} vs ${String(am).padStart(2)}`, tally(rng, h, a, avg)));
}

/* ─────────────────────────── 4. Cap guarantee ──────────────── */
console.log('\n━━━ CAP GUARANTEE: top manager + weak squad vs weak manager + strong squad ━━━');
console.log('SAME chemistry both sides — isolating the manager-vs-squad question.');
console.log('Spec: "a top manager + average squad should MODESTLY beat expectation but');
console.log('       still lose more often than not to a strong squad with a weak manager."\n');
console.log('Matchup                                          Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────────');
{
  // 12-pt squad gap. Same chemistry. Opposite manager extremes.
  const eliteMgrWeakSquad  = team('weakSquad-eliteMgr',  70, 70, 0.70, 95);
  const weakMgrStrongSquad = team('strongSquad-weakMgr', 82, 82, 0.70, 25);
  console.log(row('Strong sq home (weak mgr) vs weak sq away',     tally(rng, weakMgrStrongSquad, eliteMgrWeakSquad, avg)));
  console.log(row('Strong sq away (weak mgr) vs weak sq home',     tally(rng, eliteMgrWeakSquad, weakMgrStrongSquad, avg)));

  // Spec's stricter test: relegation squad should NOT contend even with elite mgr
  const relegationSquadEliteMgr = team('releg-elite', 64, 64, 0.70, 95);
  const titleSquadWeakMgr       = team('title-weak',  84, 84, 0.70, 25);
  console.log(row('Title sq home (weak mgr) vs releg sq away',     tally(rng, titleSquadWeakMgr, relegationSquadEliteMgr, avg)));
  console.log(row('Title sq away (weak mgr) vs releg sq home',     tally(rng, relegationSquadEliteMgr, titleSquadWeakMgr, avg)));
}

/* ─────────────────────────── 5. Goal distribution ──────────────── */
console.log('\n━━━ OVERALL GOAL DISTRIBUTION (league-average teams) ━━━');
{
  const h = team('h', 75, 75, 0.7, 50);
  const a = team('a', 75, 75, 0.7, 50);
  let tg = 0, n00 = 0, n10 = 0, n01 = 0, n11 = 0, totalDraw = 0, gfSum = 0, gaSum = 0;
  for (let i = 0; i < 20000; i++) {
    const r = simulateFixture(rng, h, a, avg);
    tg += r.homeGoals + r.awayGoals;
    gfSum += r.homeGoals; gaSum += r.awayGoals;
    if (r.homeGoals === r.awayGoals) totalDraw++;
    if (r.homeGoals === 0 && r.awayGoals === 0) n00++;
    if (r.homeGoals === 1 && r.awayGoals === 0) n10++;
    if (r.homeGoals === 0 && r.awayGoals === 1) n01++;
    if (r.homeGoals === 1 && r.awayGoals === 1) n11++;
  }
  console.log(`  Avg total goals/match : ${(tg / 20000).toFixed(2)}  (real EPL ≈ 2.7–3.0)`);
  console.log(`  Avg home λ            : ${(gfSum / 20000).toFixed(2)}  (real ≈ 1.5)`);
  console.log(`  Avg away λ            : ${(gaSum / 20000).toFixed(2)}  (real ≈ 1.1)`);
  console.log(`  Draw rate             : ${(totalDraw / 20000 * 100).toFixed(1)}%  (real ≈ 24–27%)`);
  console.log(`  0–0 frequency         : ${(n00 / 20000 * 100).toFixed(1)}%  (real ≈ 7–8%)`);
  console.log(`  1–0 frequency         : ${(n10 / 20000 * 100).toFixed(1)}%  (real ≈ 10–12%)`);
  console.log(`  0–1 frequency         : ${(n01 / 20000 * 100).toFixed(1)}%  (real ≈ 7–9%)`);
  console.log(`  1–1 frequency         : ${(n11 / 20000 * 100).toFixed(1)}%  (real ≈ 11–13%)`);
}

/* ─────────────────────────── 6. Full-season rank correlation ──────────────── */
console.log('\n━━━ FULL-SEASON: rank correlation between squad strength and finishing position ━━━');
console.log('Build a 20-team league with strength linear in rank. Run 50 seasons. ');
console.log('Higher rank correlation = the table tracks merit more tightly.\n');
{
  const buildLeague = (seedOff) => {
    const teams = [];
    for (let i = 0; i < 20; i++) {
      const strength = 85 - i;  // rank 0 → 85, rank 19 → 66
      // Better squads tend to have better managers (positive correlation)
      // but with NOISE — a couple of teams over- or under-perform expectations.
      const morBase = 85 - i * 2;
      const morNoise = Math.cos(i * 3.7 + seedOff) * 10;
      const mor = Math.max(20, Math.min(95, morBase + morNoise));
      const chem = 0.55 + ((Math.cos(i + seedOff) + 1) / 2) * 0.30;
      teams.push(team(`r${i}`, strength, strength, chem, mor));
    }
    return teams;
  };

  let spearmanSum = 0;
  let titleByRank = new Array(20).fill(0);
  const seasons = 50;
  for (let s = 0; s < seasons; s++) {
    const teams = buildLeague(s);
    const res = runSeasonOnce({ seed: 9000 + s, userClubId: 'r0', strengths: teams, monteCarloRuns: 1 });
    // Rank in finalTable
    const order = res.finalTable.map((r) => r.clubId);
    const finishedRank = teams.map((t) => order.indexOf(t.clubId));
    // Pearson correlation between strength rank (0..19) and finished rank
    let n = 20, sxx = 0, syy = 0, sxy = 0, mx = 9.5, my = 9.5;
    for (let i = 0; i < n; i++) {
      sxx += (i - mx) ** 2;
      syy += (finishedRank[i] - my) ** 2;
      sxy += (i - mx) * (finishedRank[i] - my);
    }
    spearmanSum += sxy / Math.sqrt(sxx * syy);
    titleByRank[finishedRank.indexOf(0)]++;  // who actually won
  }
  console.log(`  Rank correlation (mean over ${seasons} seasons): ${(spearmanSum / seasons).toFixed(3)}  (≥ 0.85 → strongly merit-based)`);
  console.log(`  Titles won by pre-season rank 1: ${(titleByRank[0] / seasons * 100).toFixed(0)}%  (rank 1 should win most often)`);
}

console.log('\n━━━ DONE ━━━\n');
