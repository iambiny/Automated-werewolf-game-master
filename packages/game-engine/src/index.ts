export type {
  DemonWolfCurseIntentEffect,
  DirectKillEffect,
  GameAction,
  GameEffect,
  GameTrigger,
  HealEffect,
  InvestigationResultEffect,
  PoisonEffect,
  ProtectEffect,
  WerewolfAttackEffect,
} from './domain/action';
export type {
  DemonWolfCurseDecision,
  FoolExecutionBehavior,
  FoolRules,
  GuardRules,
  HunterRules,
  InvestigationValue,
  MayorRules,
  NightResolutionRules,
  SeerInvestigationMode,
  SeerRules,
  TiePolicy,
  WerewolfRules,
  WinRules,
  WitchRules,
} from './domain/core-role-rules';
export type {
  ExecutionInterceptionResult,
  ExecutionInterceptor,
} from './domain/execution';
export type {
  NightContext,
  NightResolutionResult,
  NightTurn,
  VotingContext,
  WinnerResult,
} from './domain/context';
export type {
  MatchState,
  MatchStatus,
  PublicOfficeState,
} from './domain/match-state';
export type {
  GamePhase,
  GamePhaseType,
  MorningSubphase,
  NightSubphase,
} from './domain/phase';
export type {
  DeathCause,
  DeathRecord,
  LifeState,
  PlayerRuntimeState,
} from './domain/player';
export type {
  RoleAssignment,
  RoleCompositionEntry,
  RoleRuntimeState,
  TeamId,
} from './domain/role';
export type {
  NightActivation,
  NightRoleMetadata,
  RoleCatalog,
  RoleDefinition,
} from './domain/role-definition';
export type { DomainEvent, VoteResolution } from './events/domain-event';
export { createMatch } from './engine/create-match';
export { isPlayerCursed } from './engine/curse';
export { announcePendingDeaths, startNextNight } from './engine/day-flow';
export type {
  CreateMatchInput,
  CreateMatchPlayerInput,
} from './engine/create-match';
export { isLegalPhaseTransition, transitionPhase } from './engine/phase-engine';
export type { TransitionPhaseInput } from './engine/phase-engine';
export { buildNightQueue } from './engine/night-queue';
export {
  advanceNightTurn,
  startNightRoleTurns,
  submitNightPass,
} from './engine/night-turn';
export type { SubmitNightPassInput } from './engine/night-turn';
export {
  completeRoleRegistration,
  registerRole,
  resetRoleRegistration,
  startFirstNight,
} from './engine/role-registration';
export type { RegisterRoleInput } from './engine/role-registration';
export {
  evaluateDemonWolfCurse,
  submitDemonWolfCurseDecision,
} from './engine/demon-wolf';
export type {
  DemonWolfCurseEvaluation,
  SubmitDemonWolfCurseInput,
} from './engine/demon-wolf';
export {
  createFoolExecutionInterceptor,
  FOOL_NO_VOTE_FLAG,
} from './engine/fool';
export { submitGuardProtection } from './engine/guard';
export type { SubmitGuardProtectionInput } from './engine/guard';
export { submitHunterShot } from './engine/hunter';
export type {
  HunterShotResolutionRules,
  SubmitHunterShotInput,
} from './engine/hunter';
export { getPendingHybridWolfConversionId } from './engine/hybrid-wolf';
export { resolveNight } from './engine/night-resolution';
export { resolveSeerInspection, submitSeerInspection } from './engine/seer';
export type { SubmitSeerInspectionInput } from './engine/seer';
export {
  getLivingWerewolfAlignedPlayerIds,
  submitWerewolfAttack,
} from './engine/werewolf';
export type { SubmitWerewolfAttackInput } from './engine/werewolf';
export { declareWinner, evaluateWinner } from './engine/winner';
export {
  appointMayorSuccessor,
  castVote,
  getVoteWeight,
  resolveVote,
  startDayExecutionVote,
  startMayorElection,
} from './engine/voting';
export type { VoteBallot, VoteResolutionRules } from './engine/voting';
export {
  getWitchHealTargetId,
  submitWitchHeal,
  submitWitchPoison,
} from './engine/witch';
export type { SubmitWitchActionInput } from './engine/witch';
export type {
  DomainError,
  DomainErrorCode,
  EngineResult,
} from './engine/result';
export type {
  ActionId,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  MatchId,
  PhaseId,
  PlayerId,
  RoleId,
} from '@werewolf/shared';
