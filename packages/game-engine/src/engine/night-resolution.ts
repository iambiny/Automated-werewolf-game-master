import type { PlayerId } from '@werewolf/shared';

import type { GameEffect } from '../domain/action';
import type { NightResolutionRules } from '../domain/core-role-rules';
import type { NightResolutionResult } from '../domain/context';
import type { MatchState } from '../domain/match-state';
import type { RoleRuntimeState } from '../domain/role';
import type { DomainEvent } from '../events/domain-event';
import { applyDeaths, type PendingDeath } from './death';
import { domainError, type EngineResult } from './result';
import { CURSED_ROLE_STATE_KEY } from './curse';
import { evaluateDemonWolfCurse } from './demon-wolf';
import { getPendingHybridWolfConversionId } from './hybrid-wolf';

export function resolveNight(
  state: MatchState,
  rules: NightResolutionRules,
): EngineResult {
  if (state.phase.type !== 'NIGHT' || state.phase.subphase !== 'RESOLUTION') {
    return {
      error: domainError(
        'INVALID_PHASE',
        'Night resolution requires the NIGHT RESOLUTION phase.',
      ),
      ok: false,
      state,
    };
  }

  const context = state.nightContext;
  if (!context || context.resolution) {
    return {
      error: domainError(
        'ACTION_NOT_AVAILABLE',
        'Night resolution is missing or has already completed.',
      ),
      ok: false,
      state,
    };
  }

  const attack = findEffect(context.effects, 'WEREWOLF_ATTACK');
  const curse = findEffect(context.effects, 'DEMON_WOLF_CURSE_INTENT');
  const attackTargetId = attack?.targetPlayerIds[0];
  const protectedIds = targetSet(context.effects, 'PROTECT');
  const healedIds = targetSet(context.effects, 'HEAL');
  const poisonIds = targetSet(context.effects, 'POISON');
  const curseEvaluation = evaluateDemonWolfCurse(state);
  const curseMatchesAttack =
    Boolean(attackTargetId) && curse?.targetPlayerIds[0] === attackTargetId;
  const protectedFromAttack =
    Boolean(attackTargetId) && protectedIds.has(attackTargetId as PlayerId);
  const healedFromAttack =
    Boolean(attackTargetId) && healedIds.has(attackTargetId as PlayerId);
  const hybridWolfConversion =
    getPendingHybridWolfConversionId(state) !== undefined;
  const curseSucceeded = curseEvaluation?.outcome === 'SUCCEEDED';
  const attackPrevented =
    !hybridWolfConversion &&
    (protectedFromAttack || (healedFromAttack && !curseSucceeded));

  let nextState = state;
  const events: DomainEvent[] = [];
  let transformedPlayerId: PlayerId | undefined;

  if (hybridWolfConversion && attackTargetId) {
    transformedPlayerId = attackTargetId;
    nextState = applyHybridWolfConversion(nextState, attackTargetId);
    events.push({ playerId: attackTargetId, type: 'HYBRID_WOLF_CONVERTED' });

    if (curseMatchesAttack && curse) {
      nextState = consumeDemonWolfCurse(nextState, curse.sourcePlayerIds);
      events.push(
        ...curse.sourcePlayerIds.map((playerId): DomainEvent => ({
          playerId,
          type: 'DEMON_WOLF_CURSE_CONSUMED',
        })),
      );
    }
  }

  if (curseSucceeded && attackTargetId && curse) {
    transformedPlayerId = attackTargetId;
    nextState = applyCurseConversion(
      nextState,
      attackTargetId,
      curse.sourcePlayerIds,
    );
    events.push({ playerId: attackTargetId, type: 'PLAYER_CURSED' });
    events.push(
      ...curse.sourcePlayerIds.map((playerId): DomainEvent => ({
        playerId,
        type: 'DEMON_WOLF_CURSE_CONSUMED',
      })),
    );
  }

  const pendingDeaths: PendingDeath[] = [];
  if (
    attackTargetId &&
    !attackPrevented &&
    !curseSucceeded &&
    !hybridWolfConversion
  ) {
    pendingDeaths.push({
      causes: ['WEREWOLF_ATTACK'],
      playerId: attackTargetId,
    });
  }
  for (const playerId of poisonIds) {
    pendingDeaths.push({ causes: ['WITCH_POISON'], playerId });
  }

  const deathResolution = applyDeaths(
    nextState,
    pendingDeaths,
    'NIGHT',
    state.phaseId,
    rules,
  );
  nextState = deathResolution.state;
  events.push(...deathResolution.events);

  const result: NightResolutionResult = {
    attackPrevented,
    curseOutcome: curse ? (curseEvaluation?.outcome ?? 'FAILED') : 'NONE',
    deaths: deathResolution.deaths,
    nightNumber: context.nightNumber,
    ...(transformedPlayerId ? { transformedPlayerId } : {}),
  };
  const resolvedEvent: DomainEvent = { result, type: 'NIGHT_RESOLVED' };
  events.push(resolvedEvent);

  nextState = {
    ...nextState,
    events: [...state.events, ...events],
    nightContext: { ...context, resolution: result },
    pendingActions: [],
    pendingEffects: [],
  };

  return { events, ok: true, state: nextState };
}

function applyHybridWolfConversion(
  state: MatchState,
  targetPlayerId: PlayerId,
): MatchState {
  const assignment = state.roleAssignments[targetPlayerId];
  if (!assignment) return state;

  return {
    ...state,
    roleAssignments: {
      ...state.roleAssignments,
      [targetPlayerId]: {
        ...assignment,
        converted: true,
        currentRoleId: 'WEREWOLF',
        teamId: 'WEREWOLF',
      },
    },
    roleState: {
      ...state.roleState,
      [targetPlayerId]: {
        data: { ...state.roleState[targetPlayerId]?.data, converted: true },
        playerId: targetPlayerId,
        roleId: 'WEREWOLF',
      },
    },
  };
}

function consumeDemonWolfCurse(
  state: MatchState,
  demonWolfPlayerIds: PlayerId[],
): MatchState {
  const roleState = { ...state.roleState };
  for (const playerId of demonWolfPlayerIds) {
    const existing = state.roleState[playerId];
    roleState[playerId] = {
      data: { ...existing?.data, curseAvailable: false },
      playerId,
      roleId: 'DEMON_WOLF',
    } satisfies RoleRuntimeState;
  }
  return { ...state, roleState };
}

function applyCurseConversion(
  state: MatchState,
  targetPlayerId: PlayerId,
  demonWolfPlayerIds: PlayerId[],
): MatchState {
  const assignment = state.roleAssignments[targetPlayerId];
  if (!assignment) return state;

  const roleState = { ...state.roleState };
  const consumedState = consumeDemonWolfCurse(state, demonWolfPlayerIds);
  Object.assign(roleState, consumedState.roleState);

  const targetRoleState = state.roleState[targetPlayerId];
  roleState[targetPlayerId] = {
    data: {
      ...targetRoleState?.data,
      [CURSED_ROLE_STATE_KEY]: true,
    },
    playerId: targetPlayerId,
    roleId: assignment.currentRoleId,
  };

  return {
    ...state,
    roleAssignments: {
      ...state.roleAssignments,
      [targetPlayerId]: {
        ...assignment,
        teamId: 'WEREWOLF',
      },
    },
    roleState,
  };
}

function findEffect<T extends GameEffect['type']>(
  effects: GameEffect[],
  type: T,
): Extract<GameEffect, { type: T }> | undefined {
  return effects.find(
    (effect): effect is Extract<GameEffect, { type: T }> =>
      effect.type === type,
  );
}

function targetSet<T extends GameEffect['type']>(
  effects: GameEffect[],
  type: T,
): Set<PlayerId> {
  return new Set(
    effects
      .filter(
        (effect): effect is Extract<GameEffect, { type: T }> =>
          effect.type === type,
      )
      .flatMap((effect) => effect.targetPlayerIds),
  );
}
