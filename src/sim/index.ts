export { simulateFixture, expectedGoals } from './poisson';
export { runSeasonOnce, monteCarloSeason } from './season';
export type { MonteCarloOutput } from './season';
export { midSeasonReport, finalReport } from './report';
export { computePositionProgression, pickTopScorer, pickPlayerOfSeason } from './narrative';
export { attributeGoals, computeSeasonStats } from './events';
export type { GoalEvent, PlayerSeasonStats } from './events';
export {
  pickAwards,
  bandFor,
  departmentBalance,
  projectedPosition,
  finishVerdict,
} from './awards';
export type {
  Awards,
  BalanceBand,
  DepartmentBalance,
  FinishVerdict,
} from './awards';
