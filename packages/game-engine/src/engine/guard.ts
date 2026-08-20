import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
import type { GuardRules } from '../domain/core-role-rules';
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

export interface SubmitGuardProtectionInput {
  actionId: ActionId;
  targetPlayerId: PlayerId;
}

export function submitGuardProtection(
  state: MatchState,
  input: SubmitGuardProtectionInput,
  rules: GuardRules,
): EngineResult {
  const turnError = validateActiveNightTurn(state, 'GUARD', 'GUARD_PROTECT');
  if (turnError) return rejectedAction(state, turnError);

  const actorPlayerIds = getLivingRoleHolderIds(state, 'GUARD');
  if (actorPlayerIds.length === 0) {
    return rejectedAction(
      state,
      domainError('ROLE_NOT_ELIGIBLE', 'No living Guard can act.'),
    );
  }

  const target = state.players[input.targetPlayerId];
  const repeatsPreviousTarget = actorPlayerIds.some(
    (playerId) =>
      state.roleState[playerId]?.data.lastProtectedPlayerId ===
      input.targetPlayerId,
  );
  if (
    !target ||
    target.lifeState !== 'ALIVE' ||
    (!rules.allowSelfProtect &&
      actorPlayerIds.includes(input.targetPlayerId)) ||
    (!rules.allowSameTargetConsecutiveNights && repeatsPreviousTarget)
  ) {
    return rejectedAction(
      state,
      domainError('INVALID_TARGET', 'The Guard target is not eligible.'),
    );
  }

  const action: GameAction = {
    actorPlayerIds,
    actorRoleId: 'GUARD',
    id: input.actionId,
    phaseId: state.phaseId,
    targetPlayerIds: [input.targetPlayerId],
    type: 'GUARD_PROTECT',
  };
  const effect: GameEffect = {
    sourcePlayerIds: actorPlayerIds,
    sourceRoleId: 'GUARD',
    targetPlayerIds: [input.targetPlayerId],
    type: 'PROTECT',
    visibility: 'INTERNAL',
  };

  return recordNightAction(state, action, [effect], {
    roleState: updateGuardRuntimeState(
      state,
      actorPlayerIds,
      input.targetPlayerId,
    ),
  });
}

function updateGuardRuntimeState(
  state: MatchState,
  actorPlayerIds: PlayerId[],
  targetPlayerId: PlayerId,
): Record<PlayerId, RoleRuntimeState> {
  const roleState = { ...state.roleState };

  for (const playerId of actorPlayerIds) {
    const existing = state.roleState[playerId];
    roleState[playerId] = {
      data: {
        ...existing?.data,
        lastProtectedPlayerId: targetPlayerId,
      },
      playerId,
      roleId: 'GUARD',
    };
  }

  return roleState;
}
