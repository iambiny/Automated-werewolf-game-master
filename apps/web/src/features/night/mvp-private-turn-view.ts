import type { MatchState, PlayerId } from '@werewolf/game-engine';
import type { MvpRuleConfig } from '@werewolf/role-catalog';

import {
  toPrivateTurnView,
  type PlayerSummary,
  type PrivateTurnView,
} from '../../application/projections/game-view';

export function toMvpPrivateTurnView(
  state: MatchState,
  rules: MvpRuleConfig,
): PrivateTurnView | null {
  const base = toPrivateTurnView(state);
  if (!base || base.mode === 'DECOY') return base;

  const livingPlayers = Object.values(state.players)
    .filter((player) => player.lifeState === 'ALIVE')
    .sort((left, right) => left.seatIndex - right.seatIndex);
  const actorIds = livingRoleHolderIds(state, base.roleId);

  switch (base.roleId) {
    case 'SEER':
      return {
        ...base,
        validTargets: summarize(
          livingPlayers.filter(
            (player) =>
              rules.seer.allowSelfInspect ||
              !actorIds.includes(player.playerId),
          ),
        ),
      };
    case 'GUARD': {
      const previousTargets = new Set(
        actorIds
          .map(
            (playerId) => state.roleState[playerId]?.data.lastProtectedPlayerId,
          )
          .filter((value): value is PlayerId => typeof value === 'string'),
      );
      return {
        ...base,
        validTargets: summarize(
          livingPlayers.filter(
            (player) =>
              (rules.guard.allowSelfProtect ||
                !actorIds.includes(player.playerId)) &&
              (rules.guard.allowSameTargetConsecutiveNights ||
                !previousTargets.has(player.playerId)),
          ),
        ),
      };
    }
    case 'WEREWOLF':
      return {
        ...base,
        validTargets: summarize(
          livingPlayers.filter(
            (player) =>
              state.roleAssignments[player.playerId]?.teamId !== 'WEREWOLF',
          ),
        ),
      };
    case 'DEMON_WOLF': {
      const victimId = state.nightContext?.werewolfAttackTargetId;
      const victim = victimId ? state.players[victimId] : undefined;
      return {
        ...base,
        privateContext: {
          ...(victim ? { werewolfVictim: summarizeOne(victim) } : {}),
        },
      };
    }
    case 'WITCH': {
      const victimId = state.nightContext?.werewolfAttackTargetId;
      const victim = victimId ? state.players[victimId] : undefined;
      return {
        ...base,
        privateContext: {
          canHealWerewolfVictim: victim !== undefined,
          healPotionRemaining: potionCount(
            state,
            actorIds,
            'healPotionRemaining',
          ),
          poisonPotionRemaining: potionCount(
            state,
            actorIds,
            'poisonPotionRemaining',
          ),
          ...(rules.witch.seesWerewolfVictim && victim
            ? { werewolfVictim: summarizeOne(victim) }
            : {}),
        },
        validTargets: summarize(
          livingPlayers.filter(
            (player) =>
              rules.witch.allowSelfPoison ||
              !actorIds.includes(player.playerId),
          ),
        ),
      };
    }
    default:
      return base;
  }
}

function livingRoleHolderIds(state: MatchState, roleId: string): PlayerId[] {
  if (roleId === 'WEREWOLF') {
    return Object.entries(state.roleAssignments)
      .filter(
        ([playerId, assignment]) =>
          assignment.teamId === 'WEREWOLF' &&
          state.players[playerId]?.lifeState === 'ALIVE',
      )
      .map(([playerId]) => playerId);
  }
  return Object.entries(state.roleAssignments)
    .filter(
      ([playerId, assignment]) =>
        assignment.currentRoleId === roleId &&
        state.players[playerId]?.lifeState === 'ALIVE',
    )
    .map(([playerId]) => playerId);
}

function summarize(players: MatchState['players'][string][]): PlayerSummary[] {
  return players.map(summarizeOne);
}

function summarizeOne(player: MatchState['players'][string]): PlayerSummary {
  return {
    displayName: player.displayName,
    playerId: player.playerId,
    seatIndex: player.seatIndex,
  };
}

function potionCount(
  state: MatchState,
  playerIds: PlayerId[],
  key: 'healPotionRemaining' | 'poisonPotionRemaining',
): number {
  return playerIds.reduce((total, playerId) => {
    const value = state.roleState[playerId]?.data[key];
    return total + (typeof value === 'number' ? value : 0);
  }, 0);
}
