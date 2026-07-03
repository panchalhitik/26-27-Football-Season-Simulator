// Monte Carlo verification for the rewritten match engine.
// Loads the compiled sim modules via vite-node so it runs the same code the
// app uses. Reports head-to-head W/D/L splits + avg scoreline for a series
// of stylised matchups, and a 5×5 attack/defense grid for goals-vs-strength.
//
//   npx vite-node scripts/verify-match-engine.mjs

import { mulberry32 } from '../src/engine/rng.ts';
import { simulateFixture } from '../src/sim/poisson.ts';
import { runSeasonOnce, leagueAverages } from '../src/sim/season.ts';

const RUNS = 5000;

/* ────────────────────────────────────────────── helpers ────────── */

function makeTeam(id, attack, defense, chem01 = 0.6, mgrMod = 0) {
  return { clubId: id, attack, defense, homeBoost: 5, chemistry01: chem01, managerMod: mgrMod };
}

function tally(rng, home, away, leagueAvg, runs) {
  let homeWin = 0, draw = 0, awayWin = 0;
  let gf = 0, ga = 0;
  for (let i = 0; i < runs; i++) {
    const { homeGoals, awayGoals } = simulateFixture(rng, home, away, leagueAvg);
    if (homeGoals > awayGoals) homeWin++;
    else if (homeGoals < awayGoals) awayWin++;
    else draw++;
    gf += homeGoals;
    ga += awayGoals;
  }
  return {
    homeWinPct: (homeWin / runs * 100).toFixed(1),
    drawPct:    (draw    / runs * 100).toFixed(1),
    awayWinPct: (awayWin / runs * 100).toFixed(1),
    avgScore:   `${(gf / runs).toFixed(2)}–${(ga / runs).toFixed(2)}`,
  };
}

function row(label, t) {
  return `${label.padEnd(40)}  ${t.homeWinPct.padStart(5)}%   ${t.drawPct.padStart(5)}%   ${t.awayWinPct.padStart(5)}%   ${t.avgScore}`;
}

const rng = mulberry32(42);
const leagueAvg = { attack: 75, defense: 75 };

/* ────────────────────────────────────────── strength-gap matrix ────── */

console.log('\n━━━ HEAD-TO-HEAD W/D/L OVER 5000 MATCHES ━━━');
console.log('  (home is favourite. neutral chem 0.6, neutral manager mod, home advantage applied)\n');
console.log('Matchup                                    Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────');

for (const gap of [0, 5, 10, 15, 20, 30]) {
  const fav = makeTeam('fav', 75 + gap / 2, 75 + gap / 2);
  const dog = makeTeam('dog', 75 - gap / 2, 75 - gap / 2);
  console.log(row(`Strength gap ${String(gap).padStart(2)} pts`, tally(rng, fav, dog, leagueAvg, RUNS)));
}

/* ────────────────────────────────────────── chemistry ────── */

console.log('\n━━━ CHEMISTRY SENSITIVITY (equal squads, only chem differs) ━━━\n');
console.log('Home chem / Away chem                       Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────');

for (const [hc, ac] of [[1.0, 0.6], [1.0, 0.3], [1.0, 0.0], [0.3, 1.0], [0.6, 0.6]]) {
  const h = makeTeam('h', 78, 78, hc);
  const a = makeTeam('a', 78, 78, ac);
  console.log(row(`chem ${hc.toFixed(1)} vs ${ac.toFixed(1)}`, tally(rng, h, a, leagueAvg, RUNS)));
}

/* ────────────────────────────────────────── manager ────── */

console.log('\n━━━ MANAGER SENSITIVITY (equal squads, only manager mod differs) ━━━\n');
console.log('Home mgr / Away mgr                         Home    Draw    Away    Avg score');
console.log('───────────────────────────────────────────────────────────────────────────');

for (const [hm, am] of [[+10, 0], [+10, -5], [0, 0], [-5, +5]]) {
  const h = makeTeam('h', 78, 78, 0.6, hm);
  const a = makeTeam('a', 78, 78, 0.6, am);
  console.log(row(`mgrMod ${hm >= 0 ? '+' : ''}${hm} vs ${am >= 0 ? '+' : ''}${am}`, tally(rng, h, a, leagueAvg, RUNS)));
}

/* ────────────────────────────────────────── GF/GA by strength grid ── */

console.log('\n━━━ AVG GF & GA BY (ATTACK × DEFENSE) — opponent fixed at 75/75 ━━━\n');
console.log('              Def 65    Def 70    Def 75    Def 80    Def 85');
console.log('─────────────────────────────────────────────────────────────────');

for (const atk of [65, 70, 75, 80, 85]) {
  const row = [`Atk ${atk}`];
  for (const def of [65, 70, 75, 80, 85]) {
    const ours = makeTeam('us',  atk, def);
    const them = makeTeam('them', 75, 75);
    let gf = 0, ga = 0;
    for (let i = 0; i < 1500; i++) {
      const r = simulateFixture(rng, ours, them, leagueAvg);
      gf += r.homeGoals; ga += r.awayGoals;
    }
    row.push(`${(gf / 1500).toFixed(2)}–${(ga / 1500).toFixed(2)}`);
  }
  console.log(`${row[0].padEnd(12)}${row.slice(1).map((c) => c.padStart(10)).join('')}`);
}

/* ────────────────────────────────────────── full-season check ────── */

console.log('\n━━━ FULL-SEASON CHECK: top side vs mid-table vs weak side ━━━\n');
console.log('Building a 20-team league with the user at the top, mid, or bottom.');
console.log('Each run = one 38-matchday season. We do 50 seasons per scenario.\n');

function makeLeague(userAttack, userDefense, userChem, userMgrMod) {
  const teams = [makeTeam('user', userAttack, userDefense, userChem, userMgrMod)];
  // Spread of opponents
  for (let i = 0; i < 19; i++) {
    const r = 65 + i;  // 65..83 spread
    teams.push(makeTeam(`opp-${i}`, r, r));
  }
  return teams;
}

for (const [label, atk, def, chem, mgr] of [
  ['TOP-TIER squad (atk 88 def 86) + chem 0.95 + +5 mgr', 88, 86, 0.95, 5],
  ['STRONG squad   (atk 82 def 80) + chem 0.80 + +2 mgr', 82, 80, 0.80, 2],
  ['MID-TABLE      (atk 75 def 75) + chem 0.60 +  0 mgr', 75, 75, 0.60, 0],
  ['WEAK squad     (atk 68 def 68) + chem 0.40 + -2 mgr', 68, 68, 0.40, -2],
  ['MINNOW         (atk 62 def 62) + chem 0.30 + -3 mgr', 62, 62, 0.30, -3],
]) {
  let totalPos = 0, totalPts = 0, titles = 0, top4 = 0, releg = 0;
  const N = 50;
  for (let s = 0; s < N; s++) {
    const teams = makeLeague(atk, def, chem, mgr);
    const result = runSeasonOnce({
      seed: 1000 + s,
      userClubId: 'user',
      strengths: teams,
      monteCarloRuns: 1,
    });
    totalPos += result.userPosition;
    totalPts += result.userPoints;
    if (result.userPosition === 1) titles++;
    if (result.userPosition <= 4) top4++;
    if (result.userPosition >= teams.length - 2) releg++;
  }
  console.log(`${label}`);
  console.log(`   avg pos ${(totalPos / N).toFixed(2).padStart(5)}   avg pts ${(totalPts / N).toFixed(1).padStart(5)}   titles ${String(Math.round(titles / N * 100)).padStart(3)}%   top-4 ${String(Math.round(top4 / N * 100)).padStart(3)}%   relegated ${String(Math.round(releg / N * 100)).padStart(3)}%`);
}

console.log('\n━━━ DONE ━━━\n');
