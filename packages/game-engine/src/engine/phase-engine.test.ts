import { describe, expect, it } from 'vitest';

import type { GamePhase, MatchState } from '../index';
import { createMatch } from './create-match';
import { transitionPhase } from './phase-engine';

function makeState(): MatchState {
  return createMatch({
    id: 'match-1',
    initialPhaseId: 'phase-setup',
    players: [{ displayName: 'An', id: 'player-1', seatIndex: 0 }],
    roleComposition: [{ count: 1, roleId: 'VILLAGER' }],
    rulesetId: 'boardgameviet-vn',
    rulesetVersion: '1.0.0',
  });
}

function advance(
  state: MatchState,
  phase: GamePhase,
  sequence: number,
): MatchState {
  const result = transitionPhase(state, {
    phase,
    phaseId: `phase-${sequence}`,
  });

  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

describe('transitionPhase', () => {
  it('supports the complete legal two-cycle phase path', () => {
    let state = makeState();

    const phases: GamePhase[] = [
      { type: 'ROLE_REGISTRATION' },
      { type: 'PRE_GAME_VALIDATION' },
      { nightNumber: 1, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      { nightNumber: 1, subphase: 'ROLE_TURN', type: 'NIGHT' },
      { nightNumber: 1, subphase: 'RESOLUTION', type: 'NIGHT' },
      { dayNumber: 1, subphase: 'ANNOUNCEMENT', type: 'MORNING' },
      { dayNumber: 1, subphase: 'MORNING_TRIGGERS', type: 'MORNING' },
      { dayNumber: 1, subphase: 'MAYOR_ELECTION', type: 'MORNING' },
      {
        dayNumber: 1,
        subphase: 'READY_FOR_DISCUSSION',
        type: 'MORNING',
      },
      { dayNumber: 1, type: 'DISCUSSION' },
      { dayNumber: 1, round: 1, type: 'VOTING' },
      { dayNumber: 1, round: 2, type: 'VOTING' },
      { dayNumber: 1, type: 'DAY_DEATH_RESOLUTION' },
      { nightNumber: 2, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      { nightNumber: 2, subphase: 'ROLE_TURN', type: 'NIGHT' },
      { nightNumber: 2, subphase: 'RESOLUTION', type: 'NIGHT' },
      { dayNumber: 2, subphase: 'ANNOUNCEMENT', type: 'MORNING' },
      { dayNumber: 2, subphase: 'MORNING_TRIGGERS', type: 'MORNING' },
      {
        dayNumber: 2,
        subphase: 'READY_FOR_DISCUSSION',
        type: 'MORNING',
      },
      { dayNumber: 2, type: 'DISCUSSION' },
      { dayNumber: 2, round: 1, type: 'VOTING' },
      { dayNumber: 2, type: 'DAY_DEATH_RESOLUTION' },
      { type: 'GAME_OVER' },
    ];

    phases.forEach((phase, index) => {
      state = advance(state, phase, index + 1);
    });

    expect(state.phase).toEqual({ type: 'GAME_OVER' });
    expect(state.status).toBe('COMPLETED');
    expect(state.cycle).toBe(2);
    expect(
      state.events.filter((event) => event.type === 'MATCH_STARTED'),
    ).toHaveLength(1);
  });

  it('supports ending after completed morning triggers', () => {
    let state = makeState();
    state = advance(state, { type: 'ROLE_REGISTRATION' }, 1);
    state = advance(state, { type: 'PRE_GAME_VALIDATION' }, 2);
    state = advance(
      state,
      { nightNumber: 1, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      3,
    );
    state = advance(
      state,
      { nightNumber: 1, subphase: 'ROLE_TURN', type: 'NIGHT' },
      4,
    );
    state = advance(
      state,
      { nightNumber: 1, subphase: 'RESOLUTION', type: 'NIGHT' },
      5,
    );
    state = advance(
      state,
      { dayNumber: 1, subphase: 'ANNOUNCEMENT', type: 'MORNING' },
      6,
    );
    state = advance(
      state,
      { dayNumber: 1, subphase: 'MORNING_TRIGGERS', type: 'MORNING' },
      7,
    );
    state = advance(state, { type: 'GAME_OVER' }, 8);

    expect(state.status).toBe('COMPLETED');
  });

  it('rejects an invalid transition with a typed error and no mutation', () => {
    const state = makeState();
    const snapshot = JSON.parse(JSON.stringify(state));

    const result = transitionPhase(state, {
      phase: { nightNumber: 1, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      phaseId: 'invalid-night',
    });

    expect(result).toMatchObject({
      error: { code: 'INVALID_PHASE' },
      ok: false,
    });
    expect(result.state).toBe(state);
    expect(state).toEqual(snapshot);
  });

  it('rejects skipped subphases and inconsistent cycle numbers', () => {
    let state = makeState();
    state = advance(state, { type: 'ROLE_REGISTRATION' }, 1);
    state = advance(state, { type: 'PRE_GAME_VALIDATION' }, 2);

    const wrongFirstNight = transitionPhase(state, {
      phase: { nightNumber: 2, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      phaseId: 'wrong-night',
    });
    expect(wrongFirstNight.ok).toBe(false);

    state = advance(
      state,
      { nightNumber: 1, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      3,
    );
    const skippedRoleTurn = transitionPhase(state, {
      phase: { nightNumber: 1, subphase: 'RESOLUTION', type: 'NIGHT' },
      phaseId: 'skipped-role-turn',
    });
    expect(skippedRoleTurn.ok).toBe(false);
  });

  it('does not finalize while a delayed trigger is pending', () => {
    let state = makeState();
    state = advance(state, { type: 'ROLE_REGISTRATION' }, 1);
    state = advance(state, { type: 'PRE_GAME_VALIDATION' }, 2);
    state = advance(
      state,
      { nightNumber: 1, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
      3,
    );
    state = advance(
      state,
      { nightNumber: 1, subphase: 'ROLE_TURN', type: 'NIGHT' },
      4,
    );
    state = advance(
      state,
      { nightNumber: 1, subphase: 'RESOLUTION', type: 'NIGHT' },
      5,
    );
    state = advance(
      state,
      { dayNumber: 1, subphase: 'ANNOUNCEMENT', type: 'MORNING' },
      6,
    );
    state = advance(
      state,
      { dayNumber: 1, subphase: 'MORNING_TRIGGERS', type: 'MORNING' },
      7,
    );
    state = {
      ...state,
      pendingTriggers: [{ playerId: 'player-1', type: 'HUNTER_MORNING_SHOT' }],
    };

    const result = transitionPhase(state, {
      phase: { type: 'GAME_OVER' },
      phaseId: 'too-early',
    });

    expect(result).toMatchObject({
      error: { code: 'INVALID_PHASE' },
      ok: false,
    });
  });

  it('rejects all transitions after game over', () => {
    const completed: MatchState = {
      ...makeState(),
      phase: { type: 'GAME_OVER' },
      status: 'COMPLETED',
    };

    const result = transitionPhase(completed, {
      phase: { type: 'ROLE_REGISTRATION' },
      phaseId: 'after-game-over',
    });

    expect(result).toMatchObject({
      error: { code: 'MATCH_ALREADY_COMPLETED' },
      ok: false,
    });
  });
});
