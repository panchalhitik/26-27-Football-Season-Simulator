# CLAUDE.md — 26/27 Football Season Simulator

A browser-based football transfer-window simulator. Single-page React app, no
backend, no runtime fetches. Static JSON data ships in the bundle; all logic
runs client-side.

Reference inspiration: https://theishantake.com/#titss

## Stack

- **React 18** + **Vite 5** + **TypeScript** (strict, see `tsconfig.app.json`)
- **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first config in `src/index.css`)
- **Zustand 5** for state
- **Vitest** + **@testing-library/react** for tests
- **Web Worker** (ES module format) for the season simulator

Aliases: `@/*` → `src/*`.

Scripts: `npm run dev` · `build` · `preview` · `typecheck` · `test` · `test:run`.

## Data

Six clubs only: **Man Utd, Man City, Arsenal, Liverpool, Real Madrid, Barcelona**.
~3,300 players sourced from a FIFA/EA dataset (Kaggle / SoFIFA export).

Build pipeline lives in `scripts/` (Node + TS):
1. Read raw CSV from `data-raw/` (gitignored).
2. Filter to the six clubs, drop unused columns, normalize ratings.
3. Emit `src/data/players.json`, `clubs.json`, etc.

The app imports those JSON files as ES modules — **never** `fetch()` at runtime.

## Architecture

Two pure engines, one orchestrator, one worker:

```
src/
  data/         static JSON (players, clubs) — emitted by scripts/
  types/        shared domain types
  engine/      transfer negotiation engine (pure)
  sim/         season simulator: Poisson + Monte Carlo (pure core)
  store/       Zustand store — state + orchestration only
  components/  presentational React components
  screens/     top-level screens that wire store ↔ components
  test/        Vitest setup
```

### Negotiation engine (`src/engine/`)
Pure functions: `(state, offer) => decision`. No I/O, no store imports, no
`Math.random()`. Models bid → accept / counter / reject; valuation; wage demands;
agent fees.

### Season simulator (`src/sim/`)
Pure core. Poisson goal model produces per-fixture scorelines; Monte Carlo runs
the league N times to estimate title / top-4 / relegation probabilities.
Executed inside `sim.worker.ts` so the UI stays responsive. The worker is a
thin shell — all math lives in pure modules it imports.

### Store (`src/store/`)
Zustand holds: current club, budget, squad, pending offers, season-run results.
It **orchestrates** — calls engine/sim functions and writes their outputs into
state. It does **no math itself**. If a Zustand action contains arithmetic
beyond `total += offer.fee`, that logic belongs in `engine/` or `sim/`.

## Conventions

1. **TypeScript strict.** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
   `noImplicitOverride` are all on. Don't disable them per-file.

2. **Pure functions for game logic.** Anything in `engine/` or `sim/` must be:
   - Deterministic given its inputs (plus a seed).
   - Free of side effects (no store reads, no `console.log` in hot paths).
   - Trivially testable without React or jsdom.

3. **Deterministic simulations.** Randomness goes through a seeded PRNG
   (mulberry32 or sfc32) passed in as an argument — never `Math.random()` in
   engine/sim code. Reproducibility is a feature: same seed → same season.

4. **Vitest for every engine/sim module.** A `foo.ts` in `engine/` or `sim/`
   gets a `foo.test.ts` next to it. Tests assert numerical behaviour, edge
   cases, and seed-equivalence. UI tests are nice-to-have; engine/sim tests
   are non-negotiable.

5. **Store separation.** The store imports from `engine/` and `sim/`. Those
   never import from `store/`. If you feel the urge to import the store inside
   `engine/`, the function signature is wrong — pass the data in.

6. **Components stay presentational where possible.** Screens own store
   subscriptions; leaf components take props. Avoids re-render storms during
   the season-run animation.

7. **No new files outside the scaffold without reason.** If a piece of work
   doesn't fit one of the six `src/*` folders, flag it before adding a new one.

8. **Don't fetch at runtime.** All data is static JSON imported at build time.
   If you need new data, extend the pipeline in `scripts/`.

## What is intentionally not here

- No router (yet). Tab/state-driven navigation until a real need appears.
- No backend, no auth, no persistence beyond `localStorage` (if used at all).
- No CSS-in-JS. Tailwind utilities + the occasional `@layer components` rule.
- No Redux, no React Query, no form library. Zustand + native inputs suffice.

## Working with this repo

- Before adding a feature, check whether a pure function in `engine/` or `sim/`
  can do the work. The store should be thin.
- Before changing a type in `src/types/`, grep for its uses — strict mode will
  catch most things, but Zustand selectors infer through layers.
- Before touching `src/data/*.json` by hand: don't. Re-run the pipeline.
