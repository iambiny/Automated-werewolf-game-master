import type { GameAction } from '../domain/action';
import type { NightResolutionResult } from '../domain/context';
import type { DeathCause } from '../domain/player';
import type { GamePhase } from '../domain/phase';
import type { WinnerResult } from '../domain/context';
import type { MatchId, PlayerId, RoleId } from '@werewolf/shared';

export type DomainEvent =
  | { type: 'MATCH_CREATED'; matchId: MatchId }
  | { type: 'ROLE_REGISTERED'; playerId: PlayerId; roleId: RoleId }
  | { type: 'ROLE_REGISTRATION_RESET' }
  | { type: 'MATCH_STARTED' }
  | {
      type: 'PHASE_CHANGED';
      phase: GamePhase;
      previousPhase: GamePhase;
    }
  | {
      type: 'NIGHT_TURN_STARTED';
      mode: 'ACTIVE' | 'DECOY';
      roleId: RoleId;
    }
  | { type: 'ACTION_SUBMITTED'; action: GameAction }
  | { type: 'NIGHT_RESOLVED'; result: NightResolutionResult }
  | {
      type: 'PLAYER_DIED';
      causes: DeathCause[];
      playerId: PlayerId;
    }
  | { type: 'DEATHS_ANNOUNCED'; playerIds: PlayerId[] }
  | { type: 'VOTE_CAST'; voterId: PlayerId; targetPlayerId: PlayerId }
  | { type: 'VOTE_RESOLVED'; result: VoteResolution }
  | { type: 'PLAYER_CURSED'; playerId: PlayerId }
  | { type: 'DEMON_WOLF_CURSE_CONSUMED'; playerId: PlayerId }
  | {
      type: 'HUNTER_SHOT_RESOLVED';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
    }
  | { type: 'MAYOR_ELECTED'; playerId: PlayerId }
  | { type: 'MAYOR_VACATED'; playerId: PlayerId }
  | { type: 'EXECUTION_INTERCEPTED'; playerId: PlayerId; roleId: RoleId }
  | { type: 'WINNER_DECLARED'; winner: WinnerResult };

export interface VoteResolution {
  eliminatedPlayerId?: PlayerId;
  tallies: Array<{ targetPlayerId: PlayerId; weightedVotes: number }>;
  tiedPlayerIds: PlayerId[];
}
