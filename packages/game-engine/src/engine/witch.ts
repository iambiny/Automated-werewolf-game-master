import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
import type { WitchRules } from '../domain/core-role-rules';
import type { MatchState } from '../domain/match-state';
import type { RoleRuntimeState } from '../domain/role';
import type { EngineResult } from './result';
import { domainError } from './result';
import {
  getLivingRoleHolderIds,
  recordNightAction,
  rejectedAction,
  validateActiveNightTurn,
} from './night-action';
import { evaluateDemonWolfCurse } from './demon-wolf';

export interface SubmitWitchActionInput {
  actionId: ActionId;
  targetPlayerId: PlayerId;
}

/** Returns the living player whose Werewolf-attack death the Witch can heal. */
export function getWitchHealTargetId(state: MatchState): PlayerId | undefined {
  const context = state.nightContext;
  const targetPlayerId = context?.werewolfAttackTargetId ?? undefined;
  if (!context || !targetPlayerId) return undefined;

  const target = state.players[targetPlayerId];
  const protectedByGuard = context.effects.some(
    (effect) =>
      effect.type === 'PROTECT' &&
      effect.targetPlayerIds.includes(targetPlayerId),
  );
  const curseOutcome = evaluateDemonWolfCurse(state)?.outcome;
  const assignment = state.roleAssignments[targetPlayerId];
  const convertsAsHybridWolf =
    assignment?.originalRoleId === 'HYBRID_WOLF' &&
    assignment.currentRoleId === 'HYBRID_WOLF' &&
    assignment.teamId === 'VILLAGE' &&
    assignment.converted !== true;

  if (
    !target ||
    target.lifeState !== 'ALIVE' ||
    protectedByGuard ||
    curseOutcome === 'SUCCEEDED' ||
    curseOutcome === 'CONSUMED' ||
    convertsAsHybridWolf
  ) {
    return undefined;
  }

  return targetPlayerId;
}

export function submitWitchHeal(
  state: MatchState,
  input: SubmitWitchActionInput,
  rules: WitchRules,
): EngineResult {
  const validation = validateWitchAction(state, 'WITCH_HEAL', rules);
  if ('error' in validation) return rejectedAction(state, validation.error);

  const wolfTargetId = getWitchHealTargetId(state);
  const target = state.players[input.targetPlayerId];
  if (
    !wolfTargetId ||
    input.targetPlayerId !== wolfTargetId ||
    !target ||
    target.lifeState !== 'ALIVE' ||
    (!rules.allowSelfHeal &&
      validation.actorPlayerIds.includes(input.targetPlayerId))
  ) {
    return rejectedAction(
      state,
      domainError(
        'INVALID_TARGET',
        'The Witch healing target is not eligible.',
      ),
    );
  }

  if (
    !validation.actorPlayerIds.some(
      (playerId) => getPotionCount(state, playerId, 'healPotionRemaining') > 0,
    )
  ) {
    return rejectedAction(
      state,
      domainError('RESOURCE_EXHAUSTED', 'The healing potion is exhausted.'),
    );
  }

  return recordWitchAction(
    state,
    input,
    validation.actorPlayerIds,
    'WITCH_HEAL',
    'HEAL',
    'healPotionRemaining',
  );
}

export function submitWitchPoison(
  state: MatchState,
  input: SubmitWitchActionInput,
  rules: WitchRules,
): EngineResult {
  const validation = validateWitchAction(state, 'WITCH_POISON', rules);
  if ('error' in validation) return rejectedAction(state, validation.error);

  const target = state.players[input.targetPlayerId];
  if (
    !target ||
    target.lifeState !== 'ALIVE' ||
    (!rules.allowSelfPoison &&
      validation.actorPlayerIds.includes(input.targetPlayerId))
  ) {
    return rejectedAction(
      state,
      domainError('INVALID_TARGET', 'The Witch poison target is not eligible.'),
    );
  }

  if (
    !validation.actorPlayerIds.some(
      (playerId) =>
        getPotionCount(state, playerId, 'poisonPotionRemaining') > 0,
    )
  ) {
    return rejectedAction(
      state,
      domainError('RESOURCE_EXHAUSTED', 'The poison potion is exhausted.'),
    );
  }

  return recordWitchAction(
    state,
    input,
    validation.actorPlayerIds,
    'WITCH_POISON',
    'POISON',
    'poisonPotionRemaining',
  );
}

type WitchActionType = 'WITCH_HEAL' | 'WITCH_POISON';
type WitchEffectType = 'HEAL' | 'POISON';
type PotionKey = 'healPotionRemaining' | 'poisonPotionRemaining';

function validateWitchAction(
  state: MatchState,
  actionType: WitchActionType,
  rules: WitchRules,
): { actorPlayerIds: PlayerId[] } | { error: ReturnType<typeof domainError> } {
  const turnError = validateActiveNightTurn(state, 'WITCH', actionType);
  if (turnError) return { error: turnError };

  const actorPlayerIds = getLivingRoleHolderIds(state, 'WITCH');
  if (actorPlayerIds.length === 0) {
    return {
      error: domainError('ROLE_NOT_ELIGIBLE', 'No living Witch can act.'),
    };
  }

  const otherActionType =
    actionType === 'WITCH_HEAL' ? 'WITCH_POISON' : 'WITCH_HEAL';
  if (
    !rules.allowHealAndPoisonSameNight &&
    state.nightContext?.actions.some(
      (action) => action.type === otherActionType,
    )
  ) {
    return {
      error: domainError(
        'ACTION_NOT_AVAILABLE',
        'The Witch cannot use both potions in the same night.',
      ),
    };
  }

  return { actorPlayerIds };
}

function recordWitchAction(
  state: MatchState,
  input: SubmitWitchActionInput,
  actorPlayerIds: PlayerId[],
  actionType: WitchActionType,
  effectType: WitchEffectType,
  potionKey: PotionKey,
): EngineResult {
  const action: GameAction = {
    actorPlayerIds,
    actorRoleId: 'WITCH',
    id: input.actionId,
    phaseId: state.phaseId,
    targetPlayerIds: [input.targetPlayerId],
    type: actionType,
  };
  const effect: GameEffect = {
    sourcePlayerIds: actorPlayerIds,
    sourceRoleId: 'WITCH',
    targetPlayerIds: [input.targetPlayerId],
    type: effectType,
    visibility: 'INTERNAL',
  };

  return recordNightAction(state, action, [effect], {
    roleState: consumePotion(state, actorPlayerIds, potionKey),
  });
}

function consumePotion(
  state: MatchState,
  actorPlayerIds: PlayerId[],
  potionKey: PotionKey,
): Record<PlayerId, RoleRuntimeState> {
  const roleState = { ...state.roleState };
  const ownerId = actorPlayerIds.find(
    (playerId) => getPotionCount(state, playerId, potionKey) > 0,
  );
  if (!ownerId) return roleState;

  const existing = state.roleState[ownerId];
  roleState[ownerId] = {
    data: {
      ...existing?.data,
      [potionKey]: getPotionCount(state, ownerId, potionKey) - 1,
    },
    playerId: ownerId,
    roleId: 'WITCH',
  };

  return roleState;
}

function getPotionCount(
  state: MatchState,
  playerId: PlayerId,
  potionKey: PotionKey,
): number {
  const value = state.roleState[playerId]?.data[potionKey];
  return typeof value === 'number' ? value : 0;
}
