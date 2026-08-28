import {
  evaluateDemonWolfCurse,
  getPendingHybridWolfConversionId,
  getWitchHealTargetId,
  isPlayerCursed,
  type MatchState,
  type PlayerId,
} from '@werewolf/game-engine';
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
  if (!base) return base;

  const cursedPlayers = currentRoleHolderIds(state, base.roleId)
    .filter((playerId) => isPlayerCursed(state, playerId))
    .map((playerId) => state.players[playerId])
    .filter(
      (player): player is NonNullable<typeof player> => player !== undefined,
    );
  const cursedContext =
    cursedPlayers.length > 0
      ? { cursedPlayers: summarize(cursedPlayers) }
      : undefined;
  const hybridWolfContext =
    base.roleId === 'HYBRID_WOLF' ? getHybridWolfContext(state) : undefined;
  const passiveContext =
    cursedContext || hybridWolfContext
      ? {
          ...cursedContext,
          ...(hybridWolfContext ? { hybridWolf: hybridWolfContext } : {}),
        }
      : undefined;
  if (base.mode === 'DECOY') {
    return {
      ...base,
      ...(passiveContext ? { privateContext: passiveContext } : {}),
    };
  }

  const livingPlayers = Object.values(state.players)
    .filter((player) => player.lifeState === 'ALIVE')
    .sort((left, right) => left.seatIndex - right.seatIndex);
  const actorIds = livingRoleHolderIds(state, base.roleId);
  if (base.roleId !== 'WEREWOLF' && actorIds.length === 0) {
    return {
      ...base,
      instruction: `Complete the private ${base.roleId} handoff.`,
      mode: 'DECOY',
      ...(cursedContext ? { privateContext: cursedContext } : {}),
    };
  }
  const withCurseNotice: PrivateTurnView = {
    ...base,
    ...(cursedContext ? { privateContext: cursedContext } : {}),
  };

  switch (base.roleId) {
    case 'SEER':
      return {
        ...withCurseNotice,
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
        ...withCurseNotice,
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
    case 'SILENCER': {
      const lastTargetId = [...(state.nightContext?.effects ?? [])]
        .reverse()
        .find((effect) => effect.type === 'SILENCE')?.targetPlayerIds[0];
      const lastTarget = lastTargetId ? state.players[lastTargetId] : undefined;
      const previousTargets = new Set(
        actorIds
          .map((playerId) => {
            const data = state.roleState[playerId]?.data;
            return data?.lastSilencedNightNumber === state.cycle - 1
              ? data.lastSilencedPlayerId
              : undefined;
          })
          .filter((value): value is PlayerId => typeof value === 'string'),
      );
      return {
        ...withCurseNotice,
        ...(lastTarget
          ? {
              privateContext: {
                ...cursedContext,
                silenceTarget: summarizeOne(lastTarget),
              },
            }
          : {}),
        validTargets: summarize(
          livingPlayers.filter(
            (player) => !previousTargets.has(player.playerId),
          ),
        ),
      };
    }
    case 'WEREWOLF':
      return {
        ...withCurseNotice,
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
      const curse = evaluateDemonWolfCurse(state);
      const curseTarget = curse
        ? state.players[curse.targetPlayerId]
        : undefined;
      return {
        ...withCurseNotice,
        ...(curse && curseTarget
          ? {
              curseResult: {
                outcome: curse.outcome,
                target: summarizeOne(curseTarget),
              },
            }
          : {}),
        privateContext: {
          ...cursedContext,
          ...(victim ? { werewolfVictim: summarizeOne(victim) } : {}),
        },
      };
    }
    case 'WITCH': {
      const victimId = getWitchHealTargetId(state);
      const victim = victimId ? state.players[victimId] : undefined;
      return {
        ...withCurseNotice,
        privateContext: {
          ...cursedContext,
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
      return withCurseNotice;
  }
}

function getHybridWolfContext(
  state: MatchState,
): { converted: boolean; player: PlayerSummary } | undefined {
  const entry = Object.entries(state.roleAssignments).find(
    ([playerId, assignment]) =>
      assignment.originalRoleId === 'HYBRID_WOLF' &&
      state.players[playerId]?.lifeState === 'ALIVE',
  );
  if (!entry) return undefined;

  const [playerId, assignment] = entry;
  const player = state.players[playerId];
  if (!player) return undefined;
  return {
    converted:
      assignment.converted === true ||
      getPendingHybridWolfConversionId(state) === playerId,
    player: summarizeOne(player),
  };
}

function currentRoleHolderIds(state: MatchState, roleId: string): PlayerId[] {
  return Object.entries(state.roleAssignments)
    .filter(
      ([playerId, assignment]) =>
        assignment.currentRoleId === roleId &&
        state.players[playerId]?.lifeState === 'ALIVE',
    )
    .map(([playerId]) => playerId);
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
        state.players[playerId]?.lifeState === 'ALIVE' &&
        !isPlayerCursed(state, playerId),
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
