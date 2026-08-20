import type { ActionId, PhaseId, PlayerId, RoleId } from '@werewolf/shared';

import type { GameAction } from '../domain/action';
import type { MatchState } from '../domain/match-state';
import type { DomainEvent } from '../events/domain-event';
import {
  getLivingRoleHolderIds,
  recordNightAction,
  rejectedAction,
  validateActiveNightTurn,
} from './night-action';
import { domainError, type EngineResult } from './result';

export interface SubmitNightPassInput {
  actionId: ActionId;
  reason: 'MANUAL' | 'TIMEOUT';
}

export function startNightRoleTurns(
  state: MatchState,
  phaseId: PhaseId,
): EngineResult {
  if (
    state.phase.type !== 'NIGHT' ||
    state.phase.subphase !== 'PREPARE_QUEUE' ||
    !state.nightContext
  ) {
    return rejectedAction(
      state,
      domainError('INVALID_PHASE', 'The night role queue is not ready.'),
    );
  }

  if (state.nightContext.queue.length === 0) {
    return enterResolution(state, phaseId);
  }

  const turn = state.nightContext.queue[0];
  if (!turn) {
    return rejectedAction(
      state,
      domainError('INVALID_MATCH_INPUT', 'The night role queue is invalid.'),
    );
  }

  const nextPhase = {
    nightNumber: state.phase.nightNumber,
    subphase: 'ROLE_TURN',
    type: 'NIGHT',
  } as const;
  const events: DomainEvent[] = [
    { phase: nextPhase, previousPhase: state.phase, type: 'PHASE_CHANGED' },
    { mode: turn.mode, roleId: turn.roleId, type: 'NIGHT_TURN_STARTED' },
  ];
  return {
    events,
    ok: true,
    state: {
      ...state,
      events: [...state.events, ...events],
      nightContext: { ...state.nightContext, currentTurnIndex: 0 },
      phase: nextPhase,
      phaseId,
    },
  };
}

export function submitNightPass(
  state: MatchState,
  input: SubmitNightPassInput,
): EngineResult {
  const context = state.nightContext;
  const turn = context?.queue[context.currentTurnIndex];
  if (!turn) {
    return rejectedAction(
      state,
      domainError('INVALID_PHASE', 'There is no current night turn.'),
    );
  }

  const actionType = `${turn.roleId}_PASS`;
  const validation = validateActiveNightTurn(state, turn.roleId, actionType);
  if (validation) return rejectedAction(state, validation);

  const actorPlayerIds = getNightActorIds(state, turn.roleId);
  const action: GameAction = {
    actorPlayerIds,
    actorRoleId: turn.roleId,
    id: input.actionId,
    payload: { reason: input.reason },
    phaseId: state.phaseId,
    targetPlayerIds: [],
    type: actionType,
  };
  return recordNightAction(state, action, []);
}

export function advanceNightTurn(
  state: MatchState,
  nextPhaseId: PhaseId,
): EngineResult {
  if (state.phase.type !== 'NIGHT' || state.phase.subphase !== 'ROLE_TURN') {
    return rejectedAction(
      state,
      domainError('INVALID_PHASE', 'No night role turn can be advanced.'),
    );
  }

  const context = state.nightContext;
  const turn = context?.queue[context.currentTurnIndex];
  if (!context || !turn) {
    return rejectedAction(
      state,
      domainError('INVALID_MATCH_INPUT', 'The current night turn is invalid.'),
    );
  }

  const hasCompletedAction = context.actions.some(
    (action) => action.actorRoleId === turn.roleId,
  );
  if (turn.mode === 'ACTIVE' && !hasCompletedAction) {
    return rejectedAction(
      state,
      domainError(
        'ACTION_NOT_AVAILABLE',
        'The active role must act or explicitly pass before sleeping.',
      ),
    );
  }

  const nextIndex = context.currentTurnIndex + 1;
  const nextTurn = context.queue[nextIndex];
  if (!nextTurn) return enterResolution(state, nextPhaseId);

  const event: DomainEvent = {
    mode: nextTurn.mode,
    roleId: nextTurn.roleId,
    type: 'NIGHT_TURN_STARTED',
  };
  return {
    events: [event],
    ok: true,
    state: {
      ...state,
      events: [...state.events, event],
      nightContext: { ...context, currentTurnIndex: nextIndex },
      phaseId: nextPhaseId,
    },
  };
}

function enterResolution(state: MatchState, phaseId: PhaseId): EngineResult {
  if (state.phase.type !== 'NIGHT') {
    return rejectedAction(
      state,
      domainError('INVALID_PHASE', 'Night resolution is not available.'),
    );
  }
  const nextPhase = {
    nightNumber: state.phase.nightNumber,
    subphase: 'RESOLUTION',
    type: 'NIGHT',
  } as const;
  const event: DomainEvent = {
    phase: nextPhase,
    previousPhase: state.phase,
    type: 'PHASE_CHANGED',
  };
  return {
    events: [event],
    ok: true,
    state: {
      ...state,
      events: [...state.events, event],
      phase: nextPhase,
      phaseId,
    },
  };
}

function getNightActorIds(state: MatchState, roleId: RoleId): PlayerId[] {
  if (roleId === 'WEREWOLF') {
    return Object.entries(state.roleAssignments)
      .filter(
        ([playerId, assignment]) =>
          assignment.teamId === 'WEREWOLF' &&
          state.players[playerId]?.lifeState === 'ALIVE',
      )
      .map(([playerId]) => playerId);
  }
  return getLivingRoleHolderIds(state, roleId);
}
