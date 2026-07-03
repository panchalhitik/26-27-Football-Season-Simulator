// Monte Carlo validation for the cup-run engine.
//   npx vite-node scripts/verify-cups.mjs

import { mulberry32 } from '../src/engine/rng.ts';
import { simulateUserCupRun } from '../src/sim/cups.ts';

const RUNS = 4000;

function ts(id, atk, def, chem = 0.7, mor = 50) {
  return { clubId: id, attack: atk, defense: def, homeBoost: 5, chemistry01: chem, mor };
}

const POOL = [
  ts('peer1', 84, 84, 0.78, 82), ts('peer2', 83, 82, 0.75, 76), ts('peer3', 81, 80, 0.72, 70),
  ts('peer4', 80, 79, 0.70, 66), ts('peer5', 78, 78, 0.68, 60),
  ts('f01', 78, 76, 0.66, 55), ts('f02', 76, 74), ts('f03', 74, 73), ts('f04', 73, 71),
  ts('f05', 72, 70), ts('f06', 71, 70), ts('f07', 70, 69), ts('f08', 70, 69),
  ts('f09', 69, 70), ts('f10', 71, 68), ts('f11', 69, 69), ts('f12', 68, 67),
  ts('f13', 66, 65), ts('f14', 65, 65),
];
const ELITE = [...POOL].sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense)).slice(0, 8);
const AVG = { attack: 74, defense: 73 };

const SQUADS = [
  ['Title-class  (86/85, chem .92, MOR 85)', ts('top', 86, 85, 0.92, 85)],
  ['Strong       (82/81, chem .80, MOR 70)', ts('str', 82, 81, 0.80, 70)],
  ['Mid-table    (75/75, chem .65, MOR 50)', ts('mid', 75, 75, 0.65, 50)],
  ['Weak         (67/66, chem .55, MOR 30)', ts('wk', 67, 66, 0.55, 30)],
];

console.log('\n━━━ CUP WIN RATES (' + RUNS + ' seasons each) ━━━');
console.log('Squad'.padEnd(42) + 'FA Cup   EFL Cup   UCL');
console.log('─'.repeat(70));
for (const [label, user] of SQUADS) {
  const rates = [];
  for (const [cup, pool, base] of [['FA Cup', POOL, 1], ['EFL', POOL, 2], ['UCL', ELITE, 3]]) {
    let wins = 0;
    for (let i = 0; i < RUNS; i++) {
      const run = simulateUserCupRun({
        rng: mulberry32(base * 100_000 + i),
        cup, user, opponents: pool, leagueAvg: AVG,
      });
      if (run.reached === 'Winners') wins++;
    }
    rates.push((wins / RUNS * 100).toFixed(1).padStart(5) + '%');
  }
  console.log(label.padEnd(42) + rates.join('    '));
}

console.log('\n━━━ EXIT-ROUND DISTRIBUTION — title-class squad, FA Cup ━━━');
{
  const tally = {};
  const user = SQUADS[0][1];
  for (let i = 0; i < RUNS; i++) {
    const run = simulateUserCupRun({
      rng: mulberry32(500_000 + i),
      cup: 'FA Cup', user, opponents: POOL, leagueAvg: AVG,
    });
    tally[run.reached] = (tally[run.reached] ?? 0) + 1;
  }
  for (const round of ['R3', 'R4', 'R5', 'QF', 'SF', 'Final', 'Winners']) {
    const n = tally[round] ?? 0;
    console.log(`  ${round.padEnd(8)} ${(n / RUNS * 100).toFixed(1).padStart(5)}%  ${'█'.repeat(Math.round(n / RUNS * 60))}`);
  }
}

console.log('\n━━━ AT LEAST ONE TROPHY PER SEASON (all 3 cups together) ━━━');
for (const [label, user] of SQUADS) {
  let seasonsWithTrophy = 0;
  for (let i = 0; i < RUNS; i++) {
    let won = false;
    for (const [cup, pool, base] of [['FA Cup', POOL, 7], ['EFL', POOL, 8], ['UCL', ELITE, 9]]) {
      const run = simulateUserCupRun({
        rng: mulberry32(base * 100_000 + i),
        cup, user, opponents: pool, leagueAvg: AVG,
      });
      if (run.reached === 'Winners') { won = true; break; }
    }
    if (won) seasonsWithTrophy++;
  }
  console.log(`  ${label.padEnd(42)} ${(seasonsWithTrophy / RUNS * 100).toFixed(1)}%`);
}

console.log('\n━━━ DONE ━━━\n');
