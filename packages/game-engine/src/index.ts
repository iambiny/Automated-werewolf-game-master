export type {
  GameAction,
  GameEffect,
  GameTrigger,
  InvestigationResultEffect,
  ProtectEffect,
  WerewolfAttackEffect,
} from './domain/action';
export type {
  GuardRules,
  InvestigationValue,
  SeerInvestigationMode,
  SeerRules,
  WerewolfRules,
} from './domain/core-role-rules';
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
export type {
  CreateMatchInput,
  CreateMatchPlayerInput,
} from './engine/create-match';
export { isLegalPhaseTransition, transitionPhase } from './engine/phase-engine';
export type { TransitionPhaseInput } from './engine/phase-engine';
export { buildNightQueue } from './engine/night-queue';
export { submitGuardProtection } from './engine/guard';
export type { SubmitGuardProtectionInput } from './engine/guard';
export { resolveSeerInspection, submitSeerInspection } from './engine/seer';
export type { SubmitSeerInspectionInput } from './engine/seer';
export {
  getLivingWerewolfAlignedPlayerIds,
  submitWerewolfAttack,
} from './engine/werewolf';
export type { SubmitWerewolfAttackInput } from './engine/werewolf';
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
