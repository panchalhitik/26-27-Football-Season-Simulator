// Monte Carlo validation for the league season engine.
//   npx vite-node scripts/verify-league.mjs
//
// Benchmarks (real EPL, last ~20 seasons):
//   Champion points        : 82-95 typical (max 100)
//   Relegated (18th) points: 25-35
//   Draw rate              : 23-26%
//   Goals per match        : 2.6-3.0
//   Title favourite wins   : ~50-65% of seasons
//   Surprise seasons       : a side beating preseason rank by 5+ places
//                            should happen most seasons somewhere in the table

import { runSeasonOnce } from '../src/sim/season.ts';

function ts(id, atk, def, chem, mor) {
  return { clubId: id, attack: atk, defense: def, homeBoost: 5, chemistry01: chem, mor };
}

/** A realistic 20-team league: favourite + genuine rival, big-6 pack, midtable, strugglers. */
function buildLeague() {
  return [
    ts('r0',  86, 85, 0.90, 85),  // title favourite
    ts('r1',  85, 84, 0.87, 82),  // genuine rival — real leagues have one
    ts('r2',  83, 82, 0.80, 74),
    ts('r3',  81, 80, 0.75, 70),
    ts('r4',  80, 79, 0.72, 66),
    ts('r5',  78, 78, 0.70, 62),
    ts('r6',  77, 75, 0.68, 58),
    ts('r7',  76, 74, 0.66, 55),
    ts('r8',  74, 73, 0.66, 52),
    ts('r9',  73, 72, 0.65, 50),
    ts('r10', 72, 71, 0.65, 48),
    ts('r11', 71, 71, 0.64, 46),
    ts('r12', 71, 70, 0.64, 44),
    ts('r13', 70, 69, 0.63, 42),
    ts('r14', 69, 69, 0.63, 40),
    ts('r15', 68, 68, 0.62, 38),
    ts('r16', 68, 67, 0.62, 36),
    ts('r17', 67, 66, 0.61, 34),
    ts('r18', 66, 65, 0.60, 32),
    ts('r19', 65, 64, 0.60, 30),
  ];
}

const SEASONS = 300;

let champPts = [], relegPts = [], userPts = [];
let draws = 0, matches = 0, goals = 0;
let favTitles = 0, favTop4 = 0;
let bigOverachievers = 0; // seasons where ANY team beats preseason rank by >= 5
let corrSum = 0;
const champByRank = new Array(20).fill(0);

for (let s = 0; s < SEASONS; s++) {
  const teams = buildLeague();
  const res = runSeasonOnce({ seed: 40_000 + s * 13, userClubId: 'r0', strengths: teams, monteCarloRuns: 1 });

  const order = res.finalTable.map((r) => r.clubId);
  champPts.push(res.finalTable[0].points);
  relegPts.push(res.finalTable[17].points);
  userPts.push(res.userPoints);

  for (const f of res.fixtures) {
    matches++;
    goals += f.homeGoals + f.awayGoals;
    if (f.homeGoals === f.awayGoals) draws++;
  }

  const champRank = Number(order[0].slice(1));
  champByRank[champRank]++;
  if (res.userPosition === 1) favTitles++;
  if (res.userPosition <= 4) favTop4++;

  // Overachievers + rank correlation
  let anyBig = false;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < 20; i++) {
    const finished = order.indexOf('r' + i);
    if (i - finished >= 5) anyBig = true;
    sxx += (i - 9.5) ** 2; syy += (finished - 9.5) ** 2; sxy += (i - 9.5) * (finished - 9.5);
  }
  if (anyBig) bigOverachievers++;
  corrSum += sxy / Math.sqrt(sxx * syy);
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (n) => (n / SEASONS * 100).toFixed(1) + '%';

console.log('\n━━━ LEAGUE REALISM (' + SEASONS + ' seasons, 20 teams) ━━━\n');
console.log(`  Champion points (avg / min / max)   : ${avg(champPts).toFixed(1)} / ${Math.min(...champPts)} / ${Math.max(...champPts)}   (real: 82-95, max 100)`);
console.log(`  18th-place points (avg)             : ${avg(relegPts).toFixed(1)}   (real: 25-35)`);
console.log(`  Goals per match                     : ${(goals / matches).toFixed(2)}   (real: 2.6-3.0)`);
console.log(`  Draw rate                           : ${(draws / matches * 100).toFixed(1)}%   (real: 23-26%)`);
console.log(`  Favourite (r0) wins title           : ${pct(favTitles)}   (real: ~50-65%)`);
console.log(`  Favourite top-4                     : ${pct(favTop4)}   (should be very high, not 100%)`);
console.log(`  Favourite points (avg / min / max)  : ${avg(userPts).toFixed(1)} / ${Math.min(...userPts)} / ${Math.max(...userPts)}`);
console.log(`  Rank correlation (strength ↔ table) : ${(corrSum / SEASONS).toFixed(3)}   (real leagues ≈ 0.75-0.90)`);
console.log(`  Seasons with a 5+ place overachiever: ${pct(bigOverachievers)}   (real: most seasons)`);
console.log('\n  Titles by preseason rank:');
for (let i = 0; i < 6; i++) {
  console.log(`    rank ${i}: ${pct(champByRank[i])}`);
}
console.log('\n━━━ DONE ━━━\n');
