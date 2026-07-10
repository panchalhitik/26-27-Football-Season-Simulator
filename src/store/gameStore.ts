import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type {
  ClubId,
  FormationShape,
  GamePhase,
  ManagerId,
  Offer,
  PlayerId,
  SaleRecord,
  SeasonRunResult,
  TransferRecord,
  TeamStrength,
  XI,
} from '@/types';
import { BUDGET_MAX_M, BUDGET_MIN_M, BUDGET_STEP_M } from '@/types';

import { CLUBS_BY_ID, MANAGERS, MANAGERS_BY_ID, PLAYERS_BY_ID, PLAYERS_BY_CLUB, FORMATIONS_BY_SHAPE } from '@/data';
import {
  autoPickXI as engineAutoPickXI,
  chemistryFor,
  fillVacantSlots,
  teamStrengthFromXI,
} from '@/engine/squad';
import { computeManagerRatings } from '@/engine/manager';
import { conventionality, withDerivedPositions } from '@/engine/shape';
import { mulberry32, hashSeed } from '@/engine/rng';
import {
  initLiveSeason,
  liveToSeasonResult,
  playMatchday,
  type LiveSeasonState,
} from '@/sim/live';
import { addInjuries, rollMatchdayInjuries, tickInjuries } from '@/sim/injuries';
import { midSeasonReport as buildMidSeason, finalReport as buildFinal } from '@/sim/report';
import type { MidSeasonReport, FinalReport } from '@/types';

interface GameStateSlice {
  phase: GamePhase;
  sportingDirectorName: string;
  seed: number;

  clubId: ClubId | null;
  managerId: ManagerId | null;

  budgetM: number;
  wageRoomK: number;

  squadIds: PlayerId[];
  pendingSales: PlayerId[];
  walkedAwayPlayerIds: PlayerId[];

  signings: TransferRecord[];
  sales: SaleRecord[];

  xi: XI | null;
  formationShape: FormationShape;

  draftOffer: Offer | null;

  midSeason: MidSeasonReport | null;
  seasonRun: SeasonRunResult | null;
  finalReport: FinalReport | null;

  /** The strength array fed into the latest season sim. Used by the results
   *  screen to derive projected position, and as the opponent pool for the
   *  live matchday engine. */
  lastSeasonStrengths: TeamStrength[];

  /** Matchday-by-matchday season in progress (null before kickoff). */
  liveSeason: LiveSeasonState | null;
  /** PlayerId → matchdays still out injured. */
  injuries: Record<PlayerId, number>;
}

interface GameActions {
  setSportingDirectorName(name: string): void;
  goTo(phase: GamePhase): void;
  reset(): void;

  chooseClub(clubId: ClubId): void;
  setBudget(m: number): void;

  keepManager(): void;
  replaceManager(managerId: ManagerId): void;

  buyPlayer(args: { playerId: PlayerId; feeM: number; wageK: number; contractYears: number }): void;
  sellPlayer(playerId: PlayerId): void;
  cancelSale(playerId: PlayerId): void;
  walkAwayFromPlayer(playerId: PlayerId): void;

  setFormation(shape: FormationShape): void;
  autoPickXI(): void;
  assignToSlot(slotIndex: number, playerId: PlayerId): void;
  setXI(assignments: Record<number, PlayerId>): void;
  /** Fluid formations: drag a slot to new pitch coordinates. */
  moveSlot(slotIndex: number, x: number, y: number): void;
  /** Snap back to the preset formation layout. */
  resetSlots(): void;

  /** Kick the season off (or resume) — builds the league + live state. */
  startSeason(): void;
  /** Play exactly one matchday. */
  simMatchday(): void;
  /** Fast-forward to the mid-season break. */
  simToMidSeason(): void;
  /** Fast-forward to the end of the season. */
  simToEnd(): void;
}

export type GameStore = GameStateSlice & GameActions;

const INITIAL: GameStateSlice = {
  phase: 'landing',
  sportingDirectorName: '',
  seed: Math.floor(Math.random() * 1_000_000_000),
  clubId: null,
  managerId: null,
  budgetM: 0,
  wageRoomK: 0,
  squadIds: [],
  pendingSales: [],
  walkedAwayPlayerIds: [],
  signings: [],
  sales: [],
  xi: null,
  formationShape: '4-3-3',
  draftOffer: null,
  midSeason: null,
  seasonRun: null,
  finalReport: null,
  lastSeasonStrengths: [],
  liveSeason: null,
  injuries: {},
};

/**
 * Synthetic mid-table opponents per league, used to fill out a real-size
 * domestic competition. Strengths are calibrated to feel like real top-flight
 * sides; clubIds are prefixed so they can't collide with our hand-built clubs.
 */
const LEAGUE_FILLERS: Record<string, { id: string; name: string; attack: number; defense: number }[]> = {
  // 26/27 season: West Ham, Wolves, Burnley relegated; Ipswich, Hull,
  // Coventry promoted from the Championship.
  PL: [
    { id: 'pl-newcastle',  name: 'Newcastle',         attack: 78, defense: 76 },
    { id: 'pl-villa',      name: 'Aston Villa',       attack: 76, defense: 74 },
    { id: 'pl-brighton',   name: 'Brighton',          attack: 74, defense: 73 },
    { id: 'pl-brentford',  name: 'Brentford',         attack: 72, defense: 70 },
    { id: 'pl-palace',     name: 'Crystal Palace',    attack: 71, defense: 70 },
    { id: 'pl-fulham',     name: 'Fulham',            attack: 70, defense: 69 },
    { id: 'pl-everton',    name: 'Everton',           attack: 69, defense: 70 },
    { id: 'pl-bourne',     name: 'Bournemouth',       attack: 71, defense: 68 },
    { id: 'pl-forest',     name: 'Nottingham Forest', attack: 69, defense: 69 },
    { id: 'pl-leeds',      name: 'Leeds',             attack: 68, defense: 67 },
    { id: 'pl-sunderland', name: 'Sunderland',        attack: 66, defense: 65 },
    { id: 'pl-ipswich',    name: 'Ipswich',           attack: 66, defense: 64 },
    { id: 'pl-hull',       name: 'Hull City',         attack: 64, defense: 63 },
    { id: 'pl-coventry',   name: 'Coventry',          attack: 65, defense: 63 },
  ],
  LL: [
    { id: 'll-atleti',     name: 'Atlético Madrid',  attack: 81, defense: 82 },
    { id: 'll-athletic',   name: 'Athletic Bilbao',  attack: 76, defense: 76 },
    { id: 'll-sociedad',   name: 'Real Sociedad',    attack: 75, defense: 75 },
    { id: 'll-betis',      name: 'Real Betis',       attack: 74, defense: 73 },
    { id: 'll-villarreal', name: 'Villarreal',       attack: 75, defense: 74 },
    { id: 'll-valencia',   name: 'Valencia',         attack: 73, defense: 72 },
    { id: 'll-sevilla',    name: 'Sevilla',          attack: 73, defense: 72 },
    { id: 'll-girona',     name: 'Girona',           attack: 72, defense: 71 },
    { id: 'll-celta',      name: 'Celta Vigo',       attack: 70, defense: 70 },
    { id: 'll-rayo',       name: 'Rayo Vallecano',   attack: 70, defense: 70 },
    { id: 'll-mallorca',   name: 'Mallorca',         attack: 69, defense: 70 },
    { id: 'll-getafe',     name: 'Getafe',           attack: 68, defense: 70 },
    { id: 'll-osasuna',    name: 'Osasuna',          attack: 68, defense: 70 },
    { id: 'll-alaves',     name: 'Alavés',           attack: 66, defense: 67 },
    { id: 'll-laspalmas',  name: 'Las Palmas',       attack: 65, defense: 66 },
    { id: 'll-espanyol',   name: 'Espanyol',         attack: 67, defense: 66 },
    { id: 'll-leganes',    name: 'Leganés',          attack: 64, defense: 65 },
    { id: 'll-valladolid', name: 'Valladolid',       attack: 64, defense: 65 },
  ],
  SA: [
    { id: 'sa-milan',      name: 'AC Milan',         attack: 82, defense: 80 },
    { id: 'sa-napoli',     name: 'Napoli',           attack: 81, defense: 80 },
    { id: 'sa-roma',       name: 'Roma',             attack: 78, defense: 77 },
    { id: 'sa-lazio',      name: 'Lazio',            attack: 76, defense: 75 },
    { id: 'sa-atalanta',   name: 'Atalanta',         attack: 78, defense: 75 },
    { id: 'sa-fiorentina', name: 'Fiorentina',       attack: 74, defense: 74 },
    { id: 'sa-bologna',    name: 'Bologna',          attack: 73, defense: 73 },
    { id: 'sa-torino',     name: 'Torino',           attack: 70, defense: 71 },
    { id: 'sa-udinese',    name: 'Udinese',          attack: 70, defense: 70 },
    { id: 'sa-genoa',      name: 'Genoa',            attack: 68, defense: 69 },
    { id: 'sa-verona',     name: 'Verona',           attack: 67, defense: 68 },
    { id: 'sa-lecce',      name: 'Lecce',            attack: 66, defense: 67 },
    { id: 'sa-empoli',     name: 'Empoli',           attack: 65, defense: 67 },
    { id: 'sa-como',       name: 'Como',             attack: 67, defense: 67 },
    { id: 'sa-parma',      name: 'Parma',            attack: 66, defense: 66 },
    { id: 'sa-cagliari',   name: 'Cagliari',         attack: 65, defense: 66 },
    { id: 'sa-venezia',    name: 'Venezia',          attack: 63, defense: 64 },
    { id: 'sa-monza',      name: 'Monza',            attack: 65, defense: 66 },
  ],
  BL: [
    { id: 'bl-dortmund',   name: 'Borussia Dortmund', attack: 82, defense: 79 },
    { id: 'bl-leipzig',    name: 'RB Leipzig',        attack: 80, defense: 79 },
    { id: 'bl-leverkusen', name: 'Bayer Leverkusen',  attack: 82, defense: 81 },
    { id: 'bl-eintracht',  name: 'Eintracht Frankfurt', attack: 76, defense: 75 },
    { id: 'bl-stuttgart',  name: 'VfB Stuttgart',     attack: 77, defense: 75 },
    { id: 'bl-wolfsburg',  name: 'Wolfsburg',         attack: 73, defense: 72 },
    { id: 'bl-gladbach',   name: 'Mönchengladbach',   attack: 73, defense: 72 },
    { id: 'bl-mainz',      name: 'Mainz 05',          attack: 71, defense: 71 },
    { id: 'bl-bremen',     name: 'Werder Bremen',     attack: 71, defense: 70 },
    { id: 'bl-freiburg',   name: 'Freiburg',          attack: 72, defense: 72 },
    { id: 'bl-hoffenheim', name: 'Hoffenheim',        attack: 71, defense: 71 },
    { id: 'bl-augsburg',   name: 'FC Augsburg',       attack: 70, defense: 70 },
    { id: 'bl-koln',       name: 'FC Köln',           attack: 68, defense: 68 },
    { id: 'bl-hamburg',    name: 'Hamburger SV',      attack: 67, defense: 67 },
    { id: 'bl-stpauli',    name: 'St. Pauli',         attack: 67, defense: 68 },
    { id: 'bl-heidenheim', name: 'Heidenheim',        attack: 65, defense: 66 },
    { id: 'bl-kiel',       name: 'Holstein Kiel',     attack: 64, defense: 65 },
  ],
  L1: [
    { id: 'l1-marseille',  name: 'Marseille',         attack: 79, defense: 77 },
    { id: 'l1-monaco',     name: 'Monaco',            attack: 78, defense: 76 },
    { id: 'l1-lyon',       name: 'Lyon',              attack: 76, defense: 75 },
    { id: 'l1-nice',       name: 'Nice',              attack: 74, defense: 74 },
    { id: 'l1-lille',      name: 'Lille',             attack: 75, defense: 75 },
    { id: 'l1-lens',       name: 'Lens',              attack: 74, defense: 73 },
    { id: 'l1-rennes',     name: 'Rennes',            attack: 73, defense: 72 },
    { id: 'l1-strasbourg', name: 'Strasbourg',        attack: 71, defense: 70 },
    { id: 'l1-toulouse',   name: 'Toulouse',          attack: 70, defense: 70 },
    { id: 'l1-nantes',     name: 'Nantes',            attack: 69, defense: 69 },
    { id: 'l1-montpellier', name: 'Montpellier',      attack: 68, defense: 69 },
    { id: 'l1-brest',      name: 'Brest',             attack: 70, defense: 69 },
    { id: 'l1-angers',     name: 'Angers',            attack: 66, defense: 67 },
    { id: 'l1-havre',      name: 'Le Havre',          attack: 66, defense: 66 },
    { id: 'l1-auxerre',    name: 'Auxerre',           attack: 65, defense: 66 },
    { id: 'l1-stetienne',  name: 'Saint-Étienne',     attack: 67, defense: 67 },
    { id: 'l1-reims',      name: 'Reims',             attack: 67, defense: 67 },
  ],
};

/** League sizes that match real-world domestic competitions. */
const LEAGUE_SIZE: Record<string, number> = {
  PL: 20, LL: 20, SA: 20,
  BL: 18, L1: 18, ER: 18, PT: 18, OTHER: 18,
};

/**
 * Build the table of TeamStrength for the user's domestic league only.
 * 20-team leagues (PL/LL/SA) yield 38 matchdays per side; 18-team leagues
 * yield 34. User club + every other real club in that league + named
 * mid-table fillers to round out the size.
 */
/**
 * Deterministic-but-varied chemistry for synthetic opponents: a hash of the
 * club id maps into the [0.55, 0.85] band. This stops the user team from
 * getting a free chem multiplier no opponent has — every team starts the
 * season with a realistic-but-imperfect cohesion number.
 */
function syntheticOpponentChem(clubId: string, lo = 0.60, hi = 0.82): number {
  let h = 0;
  for (let i = 0; i < clubId.length; i++) h = (h * 31 + clubId.charCodeAt(i)) | 0;
  const t = ((h >>> 0) % 1000) / 1000;
  return lo + (hi - lo) * t;
}

/**
 * Synthetic opponent MOR from baseAttack: a proxy for "how good a club is"
 * → "they have a manager whose quality roughly matches." Range ≈ 35..85.
 */
function syntheticOpponentMor(baseAttack: number): number {
  return Math.max(20, Math.min(95, (baseAttack - 55) * 2.5));
}

/**
 * Deterministic formation per opponent so the tactical matchup layer
 * (tempo + tilt) is live for EVERY fixture, not just the user's shape vs
 * a wall of 4-3-3s. Big clubs pick from front-foot shapes; the rest also
 * park buses.
 */
const PEER_SHAPES: FormationShape[] = ['4-3-3', '4-2-3-1', '3-4-3', '4-4-2', '3-5-2'];
const FILLER_SHAPES: FormationShape[] = ['4-2-3-1', '4-4-2', '4-5-1', '5-4-1', '5-3-2', '4-1-4-1', '3-5-2'];
function syntheticFormation(clubId: string, shapes: FormationShape[]): FormationShape {
  let h = 7;
  for (let i = 0; i < clubId.length; i++) h = (h * 33 + clubId.charCodeAt(i)) | 0;
  return shapes[(h >>> 0) % shapes.length] ?? '4-4-2';
}

function buildLeagueStrengths(args: {
  userClubId: ClubId;
  userStrength: { attack: number; defense: number };
  /** Optional extras attached to the USER team strength only — chemistry, mgr mod, MOR, formation. */
  userExtras?: {
    chemistry01: number;
    managerMod: number;
    mor?: number;
    formationShape?: import('@/types').FormationShape;
  };
}): TeamStrength[] {
  const userClub = CLUBS_BY_ID[args.userClubId];
  const targetSize = userClub ? LEAGUE_SIZE[userClub.league] ?? 20 : 20;
  const targetLeague = userClub?.league ?? 'PL';

  const userStrengths: TeamStrength = {
    clubId: args.userClubId,
    attack: args.userStrength.attack,
    defense: args.userStrength.defense,
    homeBoost: 5,
    ...(args.userExtras
      ? {
          chemistry01: args.userExtras.chemistry01,
          managerMod: args.userExtras.managerMod,
          ...(args.userExtras.mor !== undefined ? { mor: args.userExtras.mor } : {}),
          ...(args.userExtras.formationShape ? { formationShape: args.userExtras.formationShape } : {}),
        }
      : {}),
  };

  // Every other hand-built club that shares the user's league
  const peerClubs: TeamStrength[] = [];
  for (const c of Object.values(CLUBS_BY_ID)) {
    if (c.id === args.userClubId) continue;
    if (c.league !== targetLeague) continue;
    // Rival big clubs are the real obstacle: settled squads (high chem),
    // elite managers (reputation-based MOR), and their own tactical shapes.
    peerClubs.push({
      clubId: c.id,
      attack: c.baseAttack,
      defense: c.baseDefense,
      homeBoost: 4 + (c.difficulty - 3) * 0.5,
      chemistry01: syntheticOpponentChem(c.id, 0.78, 0.95),
      managerMod: 0,
      mor: Math.max(45, Math.min(92, c.reputation)),
      formationShape: syntheticFormation(c.id, PEER_SHAPES),
    });
  }

  // Top up with synthetic fillers to reach the league's real size
  const fillers = LEAGUE_FILLERS[targetLeague] ?? [];
  const seats = targetSize - 1 - peerClubs.length;
  const used: TeamStrength[] = fillers.slice(0, Math.max(0, seats)).map((f) => ({
    clubId: f.id,
    attack: f.attack,
    defense: f.defense,
    homeBoost: 4,
    chemistry01: syntheticOpponentChem(f.id),
    managerMod: 0,
    mor: syntheticOpponentMor(f.attack),
    formationShape: syntheticFormation(f.id, FILLER_SHAPES),
  }));

  return [userStrengths, ...peerClubs, ...used];
}

/**
 * Derive the user's XI (repaired around injuries) and strength record from
 * current state. All math delegated to engine functions — this just wires
 * them together.
 */
function deriveUserRecord(s: GameStateSlice): {
  xi: XI;
  userStrength: { attack: number; defense: number };
  userExtras: {
    chemistry01: number;
    managerMod: number;
    mor?: number;
    formationShape?: FormationShape;
  };
} | null {
  if (!s.clubId) return null;
  const club = CLUBS_BY_ID[s.clubId];
  const manager = s.managerId ? MANAGERS_BY_ID[s.managerId] : null;
  if (!club || !manager) return null;

  const squad = s.squadIds
    .map((id) => PLAYERS_BY_ID[id])
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const formation = FORMATIONS_BY_SHAPE[s.formationShape];

  let xi = s.xi ?? engineAutoPickXI(squad, formation);

  // Injured (or sold) starters get auto-replaced by the best available fit;
  // the rest of the user's lineup is preserved. When the layout is fluid,
  // replacements are scored against the DRAGGED slot roles.
  const unavailable = new Set(Object.keys(s.injuries));
  const squadIdSet = new Set(s.squadIds);
  const needsRepair = Object.values(xi.assignments).some(
    (pid) => unavailable.has(pid) || !squadIdSet.has(pid),
  );
  if (needsRepair) {
    for (const pid of Object.values(xi.assignments)) {
      if (!squadIdSet.has(pid)) unavailable.add(pid);
    }
    const repairFormation =
      xi.customSlots && xi.customSlots.length === formation.slots.length
        ? { ...formation, slots: xi.customSlots }
        : formation;
    xi = fillVacantSlots({ squad, formation: repairFormation, xi, unavailable });
  }

  // Fluid layout: chemistry against derived positions + conventionality tax.
  let shapeMultiplier = 1;
  if (xi.customSlots && xi.customSlots.length === formation.slots.length) {
    const verdict = conventionality(xi.customSlots);
    shapeMultiplier = verdict.multiplier;
  }

  const squadById = Object.fromEntries(
    s.squadIds.map((id) => [id, PLAYERS_BY_ID[id]]).filter(([, p]) => Boolean(p)),
  ) as Record<string, NonNullable<(typeof PLAYERS_BY_ID)[string]>>;

  const userStrength = teamStrengthFromXI({
    squadById, xi, squad,
    baseAttack: club.baseAttack,
    baseDefense: club.baseDefense,
    managerAttackMod: manager.attackMod,
    managerDefenseMod: manager.defenseMod,
    shapeMultiplier,
  });
  const morById = computeManagerRatings(MANAGERS).byId;
  const userMor = morById[manager.id]?.mor ?? 50;
  return {
    xi,
    userStrength,
    userExtras: {
      chemistry01: (xi.chemistry ?? 60) / 100,
      managerMod: manager.attackMod + manager.defenseMod,
      mor: userMor,
      formationShape: s.formationShape,
    },
  };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...INITIAL,

      setSportingDirectorName(name) {
        set({ sportingDirectorName: name.trim() });
      },

      goTo(phase) {
        set({ phase });
      },

      reset() {
        set({ ...INITIAL, seed: Math.floor(Math.random() * 1_000_000_000) });
      },

      chooseClub(clubId) {
        const club = CLUBS_BY_ID[clubId];
        if (!club) return;
        const squad = PLAYERS_BY_CLUB[clubId] ?? [];
        set({
          clubId,
          managerId: club.startingManagerId,
          budgetM: club.startingBudgetM,
          wageRoomK: club.wageRoomK,
          squadIds: squad.map((p) => p.id),
          pendingSales: [],
          walkedAwayPlayerIds: [],
          signings: [],
          sales: [],
          xi: null,
          formationShape: '4-3-3',
          phase: 'boardroom',
        });
      },

      setBudget(m) {
        // Snap to BUDGET_STEP_M for safety even if a caller skips the slider.
        const snapped = Math.max(
          BUDGET_MIN_M,
          Math.min(BUDGET_MAX_M, Math.round(m / BUDGET_STEP_M) * BUDGET_STEP_M),
        );
        set({ budgetM: snapped });
      },

      keepManager() {
        // From the pre-season decision → into the summer window.
        // From the mid-season "Consider sacking" entry → back to mid-season.
        const inMidSeason = get().seasonRun !== null;
        set({ phase: inMidSeason ? 'mid-season' : 'window' });
      },

      replaceManager(managerId) {
        const m = MANAGERS_BY_ID[managerId];
        if (!m) return;
        const inMidSeason = get().seasonRun !== null;
        // In-season sacking costs a flat £8M severance on top of the new hire's
        // comp fee — flagged on the boardroom screen, enforced here.
        const sackingCost = inMidSeason ? 8 : 0;
        set((s) => ({
          managerId,
          budgetM: Math.max(0, s.budgetM - m.compensationFeeM - sackingCost),
          phase: inMidSeason ? 'mid-season' : 'window',
        }));
      },

      buyPlayer({ playerId, feeM, wageK, contractYears }) {
        const player = PLAYERS_BY_ID[playerId];
        const { clubId } = get();
        if (!player || !clubId) return;
        if (feeM > get().budgetM) return;
        set((s) => ({
          budgetM: round1(s.budgetM - feeM),
          wageRoomK: s.wageRoomK - wageK,
          squadIds: s.squadIds.includes(playerId) ? s.squadIds : [...s.squadIds, playerId],
          signings: [
            ...s.signings,
            {
              playerId,
              playerName: player.name,
              fromClubId: player.clubId,
              toClubId: clubId,
              feeM,
              wageK,
              contractYears,
              signedAt: s.signings.length,
            } satisfies TransferRecord,
          ],
          // Replace XI; user can re-pick or auto
          xi: null,
        }));
      },

      sellPlayer(playerId) {
        const player = PLAYERS_BY_ID[playerId];
        const { clubId, pendingSales, squadIds } = get();
        if (!player || !clubId) return;
        if (pendingSales.includes(playerId)) return;
        // Fee ≈ 95% of market value (per the mockup banner)
        const grossM = round1(player.marketValueM);
        const receivedM = round1(grossM * 0.95);
        set((s) => ({
          budgetM: round1(s.budgetM + receivedM),
          wageRoomK: s.wageRoomK + player.wageK,
          squadIds: squadIds.filter((id) => id !== playerId),
          pendingSales: [...s.pendingSales, playerId],
          sales: [
            ...s.sales,
            {
              playerId,
              playerName: player.name,
              fromClubId: clubId,
              toClubId: 'market',
              feeM: grossM,
              receivedM,
              wageK: player.wageK,
              contractYears: player.contractYearsLeft,
              signedAt: s.sales.length,
            } satisfies SaleRecord,
          ],
          xi: null,
        }));
      },

      walkAwayFromPlayer(playerId) {
        set((s) =>
          s.walkedAwayPlayerIds.includes(playerId)
            ? s
            : { walkedAwayPlayerIds: [...s.walkedAwayPlayerIds, playerId] },
        );
      },

      cancelSale(playerId) {
        const { sales, pendingSales, budgetM } = get();
        const sale = sales.find((s) => s.playerId === playerId);
        if (!sale) return;
        // Block cancellation if we've already spent the proceeds — refunding
        // would put the budget under water.
        if (budgetM < sale.receivedM) return;
        set((s) => ({
          budgetM: round1(s.budgetM - sale.receivedM),
          wageRoomK: s.wageRoomK - sale.wageK,
          squadIds: s.squadIds.includes(playerId) ? s.squadIds : [...s.squadIds, playerId],
          pendingSales: pendingSales.filter((id) => id !== playerId),
          sales: sales.filter((x) => x.playerId !== playerId),
          xi: null,
        }));
      },

      setFormation(shape) {
        set({ formationShape: shape, xi: null });
      },

      autoPickXI() {
        const { squadIds, formationShape } = get();
        const formation = FORMATIONS_BY_SHAPE[formationShape];
        const squad = squadIds.map((id) => PLAYERS_BY_ID[id]).filter((p): p is NonNullable<typeof p> => Boolean(p));
        const xi = engineAutoPickXI(squad, formation);
        set({ xi });
      },

      assignToSlot(slotIndex, playerId) {
        const { xi, formationShape } = get();
        const formation = FORMATIONS_BY_SHAPE[formationShape];
        // A fluid custom layout must survive player swaps — score chemistry
        // against the dragged slot positions, not the preset.
        const customSlots =
          xi?.customSlots && xi.customSlots.length === formation.slots.length
            ? xi.customSlots
            : null;
        const slots = customSlots ?? formation.slots;
        const slot = slots[slotIndex];
        if (!slot) return;
        const player = PLAYERS_BY_ID[playerId];
        if (!player) return;
        const nextAssignments = xi
          ? { ...xi.assignments, [slotIndex]: playerId }
          : { [slotIndex]: playerId };
        const squadById = Object.fromEntries(
          get().squadIds.map((id) => [id, PLAYERS_BY_ID[id]!]).filter(([, p]) => Boolean(p)),
        ) as Record<string, NonNullable<(typeof PLAYERS_BY_ID)[string]>>;
        const partial: XI = {
          shape: formationShape,
          assignments: nextAssignments,
          chemistry: 0,
          exactMatches: 0,
          ...(customSlots ? { customSlots } : {}),
        };
        const chem = chemistryFor({ squadById, xi: partial, formation: { ...formation, slots } });
        set({ xi: { ...partial, chemistry: chem.chemistry, exactMatches: chem.exactMatches } });
      },

      setXI(assignments) {
        const { xi, formationShape, squadIds } = get();
        const formation = FORMATIONS_BY_SHAPE[formationShape];
        const customSlots =
          xi?.customSlots && xi.customSlots.length === formation.slots.length
            ? xi.customSlots
            : null;
        const slots = customSlots ?? formation.slots;
        const squadById = Object.fromEntries(
          squadIds.map((id) => [id, PLAYERS_BY_ID[id]!]).filter(([, p]) => Boolean(p)),
        ) as Record<string, NonNullable<(typeof PLAYERS_BY_ID)[string]>>;
        const partial: XI = {
          shape: formationShape,
          assignments,
          chemistry: 0,
          exactMatches: 0,
          ...(customSlots ? { customSlots } : {}),
        };
        const chem = chemistryFor({ squadById, xi: partial, formation: { ...formation, slots } });
        set({ xi: { ...partial, chemistry: chem.chemistry, exactMatches: chem.exactMatches } });
      },

      moveSlot(slotIndex, x, y) {
        const { xi, formationShape, squadIds } = get();
        if (!xi) return;
        const formation = FORMATIONS_BY_SHAPE[formationShape];
        const base = xi.customSlots ?? formation.slots.map((s) => ({ ...s }));
        if (slotIndex < 0 || slotIndex >= base.length) return;
        const cx = Math.max(4, Math.min(96, x));
        const cy = Math.max(8, Math.min(96, y));
        const customSlots = withDerivedPositions(
          base.map((s, i) => (i === slotIndex ? { ...s, x: cx, y: cy } : s)),
        );
        // Chemistry re-scores against the DERIVED positions of the new layout.
        const squadById = Object.fromEntries(
          squadIds.map((id) => [id, PLAYERS_BY_ID[id]!]).filter(([, p]) => Boolean(p)),
        ) as Record<string, NonNullable<(typeof PLAYERS_BY_ID)[string]>>;
        const fluidFormation = { ...formation, slots: customSlots };
        const partial: XI = { ...xi, customSlots };
        const chem = chemistryFor({ squadById, xi: partial, formation: fluidFormation });
        set({ xi: { ...partial, chemistry: chem.chemistry, exactMatches: chem.exactMatches } });
      },

      resetSlots() {
        const { xi, formationShape, squadIds } = get();
        if (!xi) return;
        const formation = FORMATIONS_BY_SHAPE[formationShape];
        const squadById = Object.fromEntries(
          squadIds.map((id) => [id, PLAYERS_BY_ID[id]!]).filter(([, p]) => Boolean(p)),
        ) as Record<string, NonNullable<(typeof PLAYERS_BY_ID)[string]>>;
        const { customSlots: _drop, ...rest } = xi;
        const chem = chemistryFor({ squadById, xi: rest, formation });
        set({ xi: { ...rest, chemistry: chem.chemistry, exactMatches: chem.exactMatches } });
      },

      startSeason() {
        const s = get();
        if (!s.clubId) return;
        // Resuming an in-progress season (e.g. back from the January window)
        // keeps the live state — only the user record refreshes per matchday.
        if (s.liveSeason && s.liveSeason.matchday <= s.liveSeason.totalRounds) return;

        const derived = deriveUserRecord(s);
        if (!derived) return;
        const strengths = buildLeagueStrengths({
          userClubId: s.clubId,
          userStrength: derived.userStrength,
          userExtras: derived.userExtras,
        });
        const live = initLiveSeason({ seed: s.seed, strengths });
        set({
          xi: derived.xi,
          liveSeason: live,
          lastSeasonStrengths: strengths,
          injuries: {},
          midSeason: null,
          seasonRun: null,
          finalReport: null,
        });
      },

      simMatchday() {
        const s = get();
        if (!s.clubId || !s.liveSeason) return;
        const live = s.liveSeason;
        if (live.matchday > live.totalRounds) return;
        const club = CLUBS_BY_ID[s.clubId];
        const manager = s.managerId ? MANAGERS_BY_ID[s.managerId] : null;
        if (!club || !manager) return;

        // 1. Repair the XI around injuries, then refresh the user's strength
        //    record — lineup, chemistry, fluid-shape penalty all live.
        const derived = deriveUserRecord(s);
        if (!derived) return;
        const strengths = s.lastSeasonStrengths.map((t) =>
          t.clubId === s.clubId
            ? {
                ...t,
                attack: derived.userStrength.attack,
                defense: derived.userStrength.defense,
                chemistry01: derived.userExtras.chemistry01,
                managerMod: derived.userExtras.managerMod,
                ...(derived.userExtras.mor !== undefined ? { mor: derived.userExtras.mor } : {}),
                ...(derived.userExtras.formationShape
                  ? { formationShape: derived.userExtras.formationShape }
                  : {}),
              }
            : t,
        );

        // 2. Play the matchday.
        const next = playMatchday(live, strengths);
        const playedMd = live.matchday;

        // 3. Injuries: the XI that just played rolls the dice; existing
        //    knocks heal by one matchday.
        const xiPlayers = Object.values(derived.xi.assignments)
          .map((id) => PLAYERS_BY_ID[id])
          .filter((p): p is NonNullable<typeof p> => Boolean(p));
        const injRng = mulberry32(hashSeed(s.seed, `inj:${playedMd}`));
        const newInjuries = rollMatchdayInjuries({ rng: injRng, players: xiPlayers });
        const injuries = addInjuries(tickInjuries(s.injuries), newInjuries);

        const patch: Partial<GameStateSlice> = {
          xi: derived.xi,
          liveSeason: next,
          lastSeasonStrengths: strengths,
          injuries,
        };

        // 4. Season milestones.
        const half = next.totalRounds / 2;
        if (playedMd === half) {
          const mid = buildMidSeason({
            fixtures: next.results,
            userClubId: s.clubId,
            finalTableAtH1: next.table.map((r) => ({ clubId: r.clubId, points: r.points })),
          });
          patch.midSeason = mid;
          patch.seasonRun = liveToSeasonResult(next, s.clubId);
          patch.phase = 'mid-season';
        } else if (playedMd === next.totalRounds) {
          const season = liveToSeasonResult(next, s.clubId);
          patch.seasonRun = season;
          patch.finalReport = buildFinal({
            club,
            season,
            signings: s.signings,
            sales: s.sales,
            finalFormation: s.formationShape,
            strengths,
            seed: s.seed + 1000,
          });
          patch.phase = 'final-report';
        }

        set(patch);
      },

      simToMidSeason() {
        const { simMatchday } = get();
        for (let guard = 0; guard < 50; guard++) {
          const live = get().liveSeason;
          if (!live || live.matchday > live.totalRounds / 2) break;
          simMatchday();
        }
      },

      simToEnd() {
        const { simMatchday } = get();
        for (let guard = 0; guard < 50; guard++) {
          const live = get().liveSeason;
          if (!live || live.matchday > live.totalRounds) break;
          simMatchday();
        }
      },
    }),
    {
      name: 'fss-26-27-game-v2',
      version: 2,
      partialize: (state) => ({
        // Persist game state, not the action handlers (they aren't serializable).
        phase: state.phase,
        sportingDirectorName: state.sportingDirectorName,
        seed: state.seed,
        clubId: state.clubId,
        managerId: state.managerId,
        budgetM: state.budgetM,
        wageRoomK: state.wageRoomK,
        squadIds: state.squadIds,
        pendingSales: state.pendingSales,
        walkedAwayPlayerIds: state.walkedAwayPlayerIds,
        signings: state.signings,
        sales: state.sales,
        xi: state.xi,
        formationShape: state.formationShape,
        draftOffer: state.draftOffer,
        midSeason: state.midSeason,
        seasonRun: state.seasonRun,
        finalReport: state.finalReport,
        lastSeasonStrengths: state.lastSeasonStrengths,
        liveSeason: state.liveSeason,
        injuries: state.injuries,
      }),
    },
  ),
);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
