import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
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

export const SILENCED_FLAG = 'SILENCED';

export interface SubmitSilencerTargetInput {
  actionId: ActionId;
  targetPlayerId: PlayerId;
}

export function submitSilencerTarget(
  state: MatchState,
  input: SubmitSilencerTargetInput,
): EngineResult {
  const turnError = validateActiveNightTurn(
    state,
    'SILENCER',
    'SILENCER_SILENCE',
  );
  if (turnError) return rejectedAction(state, turnError);

  const actorPlayerIds = getLivingRoleHolderIds(state, 'SILENCER');
  if (actorPlayerIds.length === 0) {
    return rejectedAction(
      state,
      domainError('ROLE_NOT_ELIGIBLE', 'No living Silencer can act.'),
    );
  }

  const target = state.players[input.targetPlayerId];
  const repeatsConsecutiveTarget = actorPlayerIds.some((playerId) => {
    const data = state.roleState[playerId]?.data;
    return (
      data?.lastSilencedPlayerId === input.targetPlayerId &&
      data.lastSilencedNightNumber === state.cycle - 1
    );
  });
  if (!target || target.lifeState !== 'ALIVE' || repeatsConsecutiveTarget) {
    return rejectedAction(
      state,
      domainError('INVALID_TARGET', 'The Silencer target is not eligible.'),
    );
  }

  const action: GameAction = {
    actorPlayerIds,
    actorRoleId: 'SILENCER',
    id: input.actionId,
    phaseId: state.phaseId,
    targetPlayerIds: [input.targetPlayerId],
    type: 'SILENCER_SILENCE',
  };
  const effect: GameEffect = {
    sourcePlayerIds: actorPlayerIds,
    sourceRoleId: 'SILENCER',
    targetPlayerIds: [input.targetPlayerId],
    type: 'SILENCE',
    visibility: 'INTERNAL',
  };

  return recordNightAction(state, action, [effect], {
    roleState: updateSilencerRuntimeState(
      state,
      actorPlayerIds,
      input.targetPlayerId,
    ),
  });
}

function updateSilencerRuntimeState(
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
        lastSilencedNightNumber: state.cycle,
        lastSilencedPlayerId: targetPlayerId,
      },
      playerId,
      roleId: 'SILENCER',
    };
  }
  return roleState;
}
