#!/usr/bin/env node
/**
 * Reads src/data/players.json and recomputes `rating`, `potential`, and
 * `isStar` from each player's market value + age. The Transfermarkt API
 * doesn't expose FIFA-style ratings, so we derive them from how the market
 * has priced the player — high value ≈ high quality.
 *
 * Run after build-data-from-tm.py to back-fill ratings.
 *
 *   node scripts/fix-ratings.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PATH = resolve(__dirname, '..', 'src', 'data', 'players.json');

/**
 * Log curve calibrated so the bands feel right against the seed data:
 *   £1M     → ~68     squad / fringe
 *   £5M     → ~75     useful rotation
 *   £15M    → ~80     starter
 *   £40M    → ~84     established starter
 *   £80M    → ~87     top-table mainstay
 *   £150M   → ~90     star
 *   £250M+  → ~93     superstar
 *
 * Age tweak: <22 wonderkids get +1, >32 lose a point, >35 lose 2.
 */
function ratingFromValue(valueM, age) {
  const v = Math.max(0.5, valueM);
  let base = 68 + 10 * Math.log10(v);
  if (age < 22) base += 1;
  if (age > 35) base -= 2;
  else if (age > 32) base -= 1;
  return Math.min(94, Math.max(60, Math.round(base)));
}

function potentialFromRating(rating, age) {
  let bonus;
  if (age <= 19) bonus = 7;
  else if (age <= 21) bonus = 5;
  else if (age <= 23) bonus = 3;
  else if (age <= 26) bonus = 2;
  else if (age <= 29) bonus = 1;
  else bonus = 0;
  return Math.min(95, rating + bonus);
}

function isStar(rating, valueM) {
  return rating >= 87 || valueM >= 80;
}

const players = JSON.parse(readFileSync(PATH, 'utf8'));
let changed = 0;
for (const p of players) {
  const newRating = ratingFromValue(p.marketValueM, p.age);
  const newPotential = potentialFromRating(newRating, p.age);
  const newStar = isStar(newRating, p.marketValueM);
  if (p.rating !== newRating || p.potential !== newPotential || p.isStar !== newStar) {
    p.rating = newRating;
    p.potential = newPotential;
    p.isStar = newStar;
    changed += 1;
  }
}

writeFileSync(PATH, JSON.stringify(players, null, 2), 'utf8');

// Print a quick distribution summary so the user can sanity-check.
const buckets = new Map();
for (const p of players) {
  const b = Math.floor(p.rating / 5) * 5;
  buckets.set(b, (buckets.get(b) ?? 0) + 1);
}
console.log(`Updated ${changed} of ${players.length} players.`);
console.log('\nRating distribution:');
for (const k of [...buckets.keys()].sort((a, b) => a - b)) {
  const count = buckets.get(k);
  const bar = '█'.repeat(Math.round((count / players.length) * 80));
  console.log(`  ${k}–${k + 4}: ${String(count).padStart(4)} ${bar}`);
}

const stars = players.filter((p) => p.isStar).length;
console.log(`\nStars: ${stars} (${((stars / players.length) * 100).toFixed(1)}%)`);
