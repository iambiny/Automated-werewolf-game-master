export type { GameAction, GameEffect, GameTrigger } from './domain/action';
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
export type { DomainEvent, VoteResolution } from './events/domain-event';
export { createMatch } from './engine/create-match';
export type {
  CreateMatchInput,
  CreateMatchPlayerInput,
} from './engine/create-match';
export { isLegalPhaseTransition, transitionPhase } from './engine/phase-engine';
export type { TransitionPhaseInput } from './engine/phase-engine';
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
