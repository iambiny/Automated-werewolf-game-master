import type { PhaseId } from '@werewolf/shared';

import type { MatchState, MatchStatus } from '../domain/match-state';
import type { GamePhase } from '../domain/phase';
import type { DomainEvent } from '../events/domain-event';
import type { EngineResult } from './result';

export interface TransitionPhaseInput {
  phase: GamePhase;
  phaseId: PhaseId;
}

export function transitionPhase(
  state: MatchState,
  input: TransitionPhaseInput,
): EngineResult {
  if (state.status === 'COMPLETED' || state.phase.type === 'GAME_OVER') {
    return {
      error: {
        code: 'MATCH_ALREADY_COMPLETED',
        message: 'A completed match cannot change phase.',
      },
      ok: false,
      state,
    };
  }

  if (!isLegalPhaseTransition(state, input.phase)) {
    return {
      error: {
        code: 'INVALID_PHASE',
        details: {
          attemptedPhase: input.phase.type,
          currentPhase: state.phase.type,
        },
        message: `Cannot transition from ${state.phase.type} to ${input.phase.type}.`,
      },
      ok: false,
      state,
    };
  }

  const events: DomainEvent[] = [];

  if (
    state.phase.type === 'PRE_GAME_VALIDATION' &&
    input.phase.type === 'NIGHT'
  ) {
    events.push({ type: 'MATCH_STARTED' });
  }

  events.push({
    type: 'PHASE_CHANGED',
    phase: input.phase,
    previousPhase: state.phase,
  });

  const nextState: MatchState = {
    ...state,
    cycle: input.phase.type === 'NIGHT' ? input.phase.nightNumber : state.cycle,
    events: [...state.events, ...events],
    phase: input.phase,
    phaseId: input.phaseId,
    status: getStatusForPhase(input.phase, state.status),
  };

  return { events, ok: true, state: nextState };
}

export function isLegalPhaseTransition(
  state: MatchState,
  next: GamePhase,
): boolean {
  const current = state.phase;

  switch (current.type) {
    case 'SETUP':
      return next.type === 'ROLE_REGISTRATION';

    case 'ROLE_REGISTRATION':
      return next.type === 'PRE_GAME_VALIDATION';

    case 'PRE_GAME_VALIDATION':
      return (
        next.type === 'NIGHT' &&
        next.nightNumber === 1 &&
        next.subphase === 'PREPARE_QUEUE'
      );

    case 'NIGHT':
      return isLegalNightTransition(current, next);

    case 'MORNING':
      return isLegalMorningTransition(state, current, next);

    case 'DISCUSSION':
      return (
        next.type === 'VOTING' &&
        next.dayNumber === current.dayNumber &&
        next.round === 1
      );

    case 'VOTING':
      if (next.type === 'VOTING') {
        return (
          next.dayNumber === current.dayNumber &&
          next.round === current.round + 1
        );
      }

      return (
        next.type === 'DAY_DEATH_RESOLUTION' &&
        next.dayNumber === current.dayNumber
      );

    case 'DAY_DEATH_RESOLUTION':
      if (next.type === 'VOTING') {
        return (
          state.votingContext?.type === 'DAY_EXECUTION' &&
          state.votingContext.round === next.round &&
          next.dayNumber === current.dayNumber
        );
      }

      if (next.type === 'GAME_OVER') {
        return state.pendingTriggers.length === 0;
      }

      return (
        next.type === 'NIGHT' &&
        next.nightNumber === current.dayNumber + 1 &&
        next.subphase === 'PREPARE_QUEUE'
      );

    case 'GAME_OVER':
      return false;
  }
}

function isLegalNightTransition(
  current: Extract<GamePhase, { type: 'NIGHT' }>,
  next: GamePhase,
): boolean {
  if (next.type === 'NIGHT') {
    if (next.nightNumber !== current.nightNumber) return false;

    return (
      (current.subphase === 'PREPARE_QUEUE' && next.subphase === 'ROLE_TURN') ||
      (current.subphase === 'ROLE_TURN' && next.subphase === 'RESOLUTION')
    );
  }

  return (
    current.subphase === 'RESOLUTION' &&
    next.type === 'MORNING' &&
    next.dayNumber === current.nightNumber &&
    next.subphase === 'ANNOUNCEMENT'
  );
}

function isLegalMorningTransition(
  state: MatchState,
  current: Extract<GamePhase, { type: 'MORNING' }>,
  next: GamePhase,
): boolean {
  if (next.type === 'MORNING') {
    if (next.dayNumber !== current.dayNumber) return false;

    return (
      (current.subphase === 'ANNOUNCEMENT' &&
        next.subphase === 'MORNING_TRIGGERS') ||
      (current.subphase === 'MORNING_TRIGGERS' &&
        (next.subphase === 'MAYOR_ELECTION' ||
          next.subphase === 'READY_FOR_DISCUSSION')) ||
      (current.subphase === 'MAYOR_ELECTION' &&
        next.subphase === 'READY_FOR_DISCUSSION')
    );
  }

  if (next.type === 'GAME_OVER') {
    return (
      state.pendingTriggers.length === 0 &&
      (current.subphase === 'MORNING_TRIGGERS' ||
        current.subphase === 'READY_FOR_DISCUSSION')
    );
  }

  return (
    current.subphase === 'READY_FOR_DISCUSSION' &&
    next.type === 'DISCUSSION' &&
    next.dayNumber === current.dayNumber
  );
}

function getStatusForPhase(
  phase: GamePhase,
  currentStatus: MatchStatus,
): MatchStatus {
  if (phase.type === 'GAME_OVER') return 'COMPLETED';
  if (phase.type === 'NIGHT') return 'ACTIVE';
  return currentStatus;
}
