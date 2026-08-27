import type { PlayerId, RoleId } from '@werewolf/shared';

import type { GameAction, GameEffect } from './action';
import type { DeathCause } from './player';

export interface NightTurn {
  mode: 'ACTIVE' | 'DECOY';
  order: number;
  roleId: RoleId;
}

export interface NightResolutionResult {
  attackPrevented: boolean;
  curseOutcome: 'NONE' | 'FAILED' | 'SUCCEEDED' | 'CONSUMED';
  deaths: Array<{ causes: DeathCause[]; playerId: PlayerId }>;
  nightNumber: number;
  transformedPlayerId?: PlayerId;
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
  ballots: Record<PlayerId, PlayerId | null>;
  eligibleTargetIds: PlayerId[];
  eligibleVoterIds: PlayerId[];
  round: number;
  type: 'MAYOR_ELECTION' | 'DAY_EXECUTION';
}

export type WinnerResult =
  | {
      reason: string;
      teamId: 'VILLAGE' | 'WEREWOLF';
    }
  | {
      playerId: PlayerId;
      reason: string;
      teamId: 'FOOL';
    };
