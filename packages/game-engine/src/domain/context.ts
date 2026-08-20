import type { JsonObject, PlayerId, RoleId } from '@werewolf/shared';

import type { GameAction, GameEffect } from './action';

export interface NightTurn {
  mode: 'ACTIVE' | 'DECOY';
  order: number;
  roleId: RoleId;
}

export interface NightResolutionResult {
  data: JsonObject;
  nightNumber: number;
}

export interface NightContext {
  actions: GameAction[];
  currentTurnIndex: number;
  demonWolfCurseIntent?: boolean;
  effects: GameEffect[];
  nightNumber: number;
  queue: NightTurn[];
  resolution?: NightResolutionResult;
  werewolfAttackTargetId?: PlayerId | null;
}

export interface VotingContext {
  ballots: Record<PlayerId, PlayerId>;
  eligibleTargetIds: PlayerId[];
  eligibleVoterIds: PlayerId[];
  round: number;
  type: 'MAYOR_ELECTION' | 'DAY_EXECUTION';
}

export interface WinnerResult {
  reason: string;
  teamId: string;
}
