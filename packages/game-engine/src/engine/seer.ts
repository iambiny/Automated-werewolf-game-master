import type { ActionId, PlayerId } from '@werewolf/shared';

import type { GameAction, GameEffect } from '../domain/action';
import type {
  InvestigationValue,
  SeerInvestigationMode,
  SeerRules,
} from '../domain/core-role-rules';
import type { MatchState } from '../domain/match-state';
import type { EngineResult } from './result';
import { domainError } from './result';
import {
  getLivingRoleHolderIds,
  recordNightAction,
  rejectedAction,
  validateActiveNightTurn,
} from './night-action';

export interface SubmitSeerInspectionInput {
  actionId: ActionId;
  targetPlayerId: PlayerId;
}

export function submitSeerInspection(
  state: MatchState,
  input: SubmitSeerInspectionInput,
  rules: SeerRules,
): EngineResult {
  const turnError = validateActiveNightTurn(state, 'SEER', 'SEER_INSPECT');
  if (turnError) return rejectedAction(state, turnError);

  const actorPlayerIds = getLivingRoleHolderIds(state, 'SEER');
  if (actorPlayerIds.length === 0) {
    return rejectedAction(
      state,
      domainError('ROLE_NOT_ELIGIBLE', 'No living Seer can act.'),
    );
  }

  const target = state.players[input.targetPlayerId];
  const assignment = state.roleAssignments[input.targetPlayerId];
  if (
    !target ||
    target.lifeState !== 'ALIVE' ||
    !assignment ||
    (!rules.allowSelfInspect && actorPlayerIds.includes(input.targetPlayerId))
  ) {
    return rejectedAction(
      state,
      domainError('INVALID_TARGET', 'The Seer target is not eligible.'),
    );
  }

  const result = resolveSeerInspection(
    state,
    input.targetPlayerId,
    rules.investigationMode,
  );
  if (!result) {
    return rejectedAction(
      state,
      domainError('INVALID_TARGET', 'The Seer target has no role assignment.'),
    );
  }

  const action: GameAction = {
    actorPlayerIds,
    actorRoleId: 'SEER',
    id: input.actionId,
    payload: { investigationMode: rules.investigationMode },
    phaseId: state.phaseId,
    targetPlayerIds: [input.targetPlayerId],
    type: 'SEER_INSPECT',
  };
  const effect: GameEffect = {
    payload:
      result.mode === 'TEAM'
        ? { mode: result.mode, teamId: result.teamId }
        : { mode: result.mode, roleId: result.roleId },
    sourcePlayerIds: actorPlayerIds,
    sourceRoleId: 'SEER',
    targetPlayerIds: [input.targetPlayerId],
    type: 'INVESTIGATION_RESULT',
    visibility: 'PRIVATE',
  };

  return recordNightAction(state, action, [effect]);
}

export function resolveSeerInspection(
  state: MatchState,
  targetPlayerId: PlayerId,
  mode: SeerInvestigationMode,
): InvestigationValue | null {
  const assignment = state.roleAssignments[targetPlayerId];
  if (!assignment) return null;

  return mode === 'TEAM'
    ? { mode, teamId: assignment.teamId }
    : { mode, roleId: assignment.currentRoleId };
}
