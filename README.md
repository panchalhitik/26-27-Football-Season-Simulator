# 26/27 Football Season Simulator

A browser-based football transfer-window simulator. Pick one of twelve European
giants, hire or sack the manager, negotiate signings and sales across ~3,500
real players, set your XI, then play out all 38 fixtures of the season.

Single-page React app; no backend, no runtime fetches. All player and club
data ships in the bundle; all match, transfer, and cup logic runs client-side
against seeded RNGs so a given seed always produces the same season.

URL : https://26-27-football-season-simulator.vercel.app/


## Stack

- **React 18** + **Vite 5** + **TypeScript** (strict — `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)
- **Tailwind CSS v4** via `@tailwindcss/vite` (CSS-first config in `src/index.css`)
- **Zustand 5** for state + orchestration
- **Vitest** + **@testing-library/react** for tests
- **Web Worker** (ES module) for the season simulator

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck    # tsc -b --noEmit
npm run test:run     # full Vitest run
npm run build        # production bundle
npm run preview      # preview the built bundle
```

## Clubs & players

Twelve hand-built clubs across five leagues:

| League         | Clubs                                    |
| -------------- | ---------------------------------------- |
| Premier League | Man Utd, Man City, Arsenal, Liverpool, Chelsea, Spurs |
| La Liga        | Real Madrid, Barcelona                   |
| Serie A        | Juventus, Inter                          |
| Bundesliga     | Bayern Munich                            |
| Ligue 1        | PSG                                      |

Player pool (~3,500) is generated offline in `scripts/` from a Transfermarkt
API pull. Only the emitted JSON in `src/data/` is used at runtime.

## Architecture

Two pure engines, one orchestrator, one worker:

```
src/
  data/         static JSON (players, clubs, managers) — emitted by scripts/
  types/        shared domain types
  engine/       transfer negotiation + squad / manager rating (pure)
  sim/          season simulator: Dixon-Coles + Monte Carlo + cups (pure core)
  store/        Zustand store — state + orchestration only
  components/   presentational React components
  screens/      top-level screens that wire store ↔ components
  test/         Vitest setup
```

### `engine/` — negotiation, squad, manager

Pure functions taking `(state, offer) => decision`. No I/O, no store imports,
no `Math.random()`. Includes:

- Bid → accept / counter / reject with valuation, wages, agent fees, prestige premium
- Position-affinity chemistry scoring for XI building
- Manager Overall Rating (MOR) via decoupled MoneyScore + LegacyScore

### `sim/` — match engine, season, cups

- **Dixon-Coles log-linear** match model with antisymmetric μ / τ_tilt and symmetric τ_tempo / home_adv
- **Form layers** — per-season campaign factor, AR(1) matchday momentum, and run-in motivation from the live table
- **Monte Carlo** season runs to estimate title / top-4 / relegation probabilities
- **Cup simulator** — full FA Cup / EFL / UCL runs through the same match engine: squad rotation, lower-league draws, progressive difficulty, two-legged UCL ties, extra time + penalties
- **Season stats** — per-player goals / assists / clean sheets attributed each fixture
- **Awards** — Golden Boot, Playmaker, Golden Glove, Player of the Season
- **Department balance** and **projected vs finished position** narrative

The season simulator runs inside `sim.worker.ts` so the UI stays responsive.
The worker is a thin shell — all math lives in pure modules it imports.

### `store/` — orchestration only

Zustand holds current club, budget, squad, pending offers, season-run results.
It **calls** engine/sim functions and writes their outputs into state. It does
**no math itself**.

## Conventions

1. **TypeScript strict.** Don't disable strict flags per-file.
2. **Pure functions for game logic.** Anything in `engine/` or `sim/` must be:
   - Deterministic given its inputs + a seed
   - Free of side effects (no store reads, no `console.log` in hot paths)
   - Trivially testable without React or jsdom
3. **Deterministic simulations.** All randomness goes through a seeded PRNG
   (mulberry32) passed in as an argument — never `Math.random()` in engine/sim.
   Same seed → same season, every time.
4. **Vitest coverage for every engine/sim module.** A `foo.ts` in `engine/` or
   `sim/` gets a `foo.test.ts` next to it. Engine/sim tests are non-negotiable.
5. **Store separation.** The store imports from `engine/` and `sim/`. Those
   never import from `store/`.
6. **Components stay presentational where possible.** Screens own store
   subscriptions; leaf components take props.
7. **No runtime fetches.** All data is static JSON imported at build time. To
   add data, extend the pipeline in `scripts/`.

## Data pipeline

The Transfermarkt pull lives in `scripts/`. It reads raw player exports,
filters to the twelve clubs, normalizes ratings, and emits:

- `src/data/players.json` — full player pool
- `src/data/clubs.json`   — clubs + starting managers, budgets, board objectives
- `src/data/managers.json` — managers with attack/defense mods + legacy tags

Raw inputs live under `data-raw/` (gitignored). Regenerate with the script's
own instructions.


## License

Personal / educational project. Real player and club names are used for
research and simulation purposes only.
