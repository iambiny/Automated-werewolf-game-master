import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
import type { WerewolfRules } from '../domain/core-role-rules';
import type { MatchState } from '../domain/match-state';
import type { EngineResult } from './result';
import { domainError } from './result';
import {
  recordNightAction,
  rejectedAction,
  validateActiveNightTurn,
} from './night-action';

export interface SubmitWerewolfAttackInput {
  actionId: ActionId;
  targetPlayerId: PlayerId | null;
}

export function submitWerewolfAttack(
  state: MatchState,
  input: SubmitWerewolfAttackInput,
  rules: WerewolfRules,
): EngineResult {
  const turnError = validateActiveNightTurn(
    state,
    'WEREWOLF',
    'WEREWOLF_ATTACK',
  );
  if (turnError) return rejectedAction(state, turnError);

  const actorPlayerIds = getLivingWerewolfAlignedPlayerIds(state);
  if (actorPlayerIds.length === 0) {
    return rejectedAction(
      state,
      domainError(
        'ROLE_NOT_ELIGIBLE',
        'No living Werewolf-aligned player can attack.',
      ),
    );
  }

  if (input.targetPlayerId === null) {
    if (!rules.allowNoAttack) {
      return rejectedAction(
        state,
        domainError('INVALID_TARGET', 'A Werewolf attack target is required.'),
      );
    }

    return recordNightAction(
      state,
      createWerewolfAction(state, input.actionId, actorPlayerIds, null),
      [],
      { nightContext: { werewolfAttackTargetId: null } },
    );
  }

  const target = state.players[input.targetPlayerId];
  const targetAssignment = state.roleAssignments[input.targetPlayerId];
  if (
    !target ||
    target.lifeState !== 'ALIVE' ||
    !targetAssignment ||
    targetAssignment.teamId === 'WEREWOLF'
  ) {
    return rejectedAction(
      state,
      domainError('INVALID_TARGET', 'The Werewolf target is not eligible.'),
    );
  }

  const action = createWerewolfAction(
    state,
    input.actionId,
    actorPlayerIds,
    input.targetPlayerId,
  );
  const effect: GameEffect = {
    sourcePlayerIds: actorPlayerIds,
    sourceRoleId: 'WEREWOLF',
    targetPlayerIds: [input.targetPlayerId],
    type: 'WEREWOLF_ATTACK',
    visibility: 'INTERNAL',
  };

  return recordNightAction(state, action, [effect], {
    nightContext: { werewolfAttackTargetId: input.targetPlayerId },
  });
}

export function getLivingWerewolfAlignedPlayerIds(
  state: MatchState,
): PlayerId[] {
  return Object.entries(state.roleAssignments)
    .filter(
      ([playerId, assignment]) =>
        assignment.teamId === 'WEREWOLF' &&
        state.players[playerId]?.lifeState === 'ALIVE',
    )
    .map(([playerId]) => playerId);
}

function createWerewolfAction(
  state: MatchState,
  actionId: ActionId,
  actorPlayerIds: PlayerId[],
  targetPlayerId: PlayerId | null,
): GameAction {
  return {
    actorPlayerIds,
    actorRoleId: 'WEREWOLF',
    id: actionId,
    payload: { selectionStrategy: 'SHARED_SELECTION' },
    phaseId: state.phaseId,
    targetPlayerIds: targetPlayerId === null ? [] : [targetPlayerId],
    type: 'WEREWOLF_ATTACK',
  };
}
