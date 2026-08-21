import type { MatchId, PhaseId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect, GameTrigger } from './action';
import type { NightContext, VotingContext, WinnerResult } from './context';
import type { GamePhase } from './phase';
import type { PlayerRuntimeState } from './player';
import type {
  RoleAssignment,
  RoleCompositionEntry,
  RoleRuntimeState,
} from './role';
import type { DomainEvent } from '../events/domain-event';

export type MatchStatus = 'SETUP' | 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export interface PublicOfficeState {
  mayorElectionCompleted: boolean;
  mayorPlayerId?: PlayerId;
}

export interface MatchState {
  cycle: number;
  events: DomainEvent[];
  id: MatchId;
  nightContext?: NightContext;
  pendingActions: GameAction[];
  pendingEffects: GameEffect[];
  pendingTriggers: GameTrigger[];
  phase: GamePhase;
  phaseId: PhaseId;
  players: Record<PlayerId, PlayerRuntimeState>;
  publicOffice: PublicOfficeState;
  roleAssignments: Record<PlayerId, RoleAssignment>;
  roleComposition: RoleCompositionEntry[];
  roleState: Record<PlayerId, RoleRuntimeState>;
  rulesetId: string;
  rulesetVersion: string;
  schemaVersion: number;
  status: MatchStatus;
  votingContext?: VotingContext;
  winner?: WinnerResult;
}
