import { describe, expect, it } from 'vitest';

import type { MatchState } from '../domain/match-state';
import { createNightTestState } from '../testing/night-state';
import {
  advanceNightTurn,
  startNightRoleTurns,
  submitNightPass,
} from './night-turn';

function preparedState(): MatchState {
  const state = createNightTestState('SEER');
  return {
    ...state,
    nightContext: {
      actions: [],
      currentTurnIndex: 0,
      effects: [],
      nightNumber: 1,
      queue: [
        { mode: 'ACTIVE', order: 10, roleId: 'SEER' },
        { mode: 'DECOY', order: 20, roleId: 'GUARD' },
      ],
    },
    phase: { nightNumber: 1, subphase: 'PREPARE_QUEUE', type: 'NIGHT' },
  };
}

describe('night turn progression', () => {
  it('requires an ACTIVE turn to act or explicitly pass', () => {
    const started = startNightRoleTurns(preparedState(), 'seer-turn');
    if (!started.ok) throw new Error(started.error.message);

    expect(advanceNightTurn(started.state, 'guard-turn')).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });

    const passed = submitNightPass(started.state, {
      actionId: 'seer-timeout',
      reason: 'TIMEOUT',
    });
    if (!passed.ok) throw new Error(passed.error.message);
    const advanced = advanceNightTurn(passed.state, 'guard-turn');

    expect(advanced.ok).toBe(true);
    if (advanced.ok) {
      expect(advanced.state.nightContext?.currentTurnIndex).toBe(1);
    }
  });

  it('allows DECOY turns to finish without recording an action', () => {
    const started = startNightRoleTurns(preparedState(), 'seer-turn');
    if (!started.ok) throw new Error(started.error.message);
    const passed = submitNightPass(started.state, {
      actionId: 'seer-pass',
      reason: 'MANUAL',
    });
    if (!passed.ok) throw new Error(passed.error.message);
    const guard = advanceNightTurn(passed.state, 'guard-turn');
    if (!guard.ok) throw new Error(guard.error.message);

    const resolution = advanceNightTurn(guard.state, 'resolution');

    expect(resolution.ok).toBe(true);
    if (resolution.ok) {
      expect(resolution.state.phase).toEqual({
        nightNumber: 1,
        subphase: 'RESOLUTION',
        type: 'NIGHT',
      });
      expect(resolution.state.nightContext?.actions).toHaveLength(1);
    }
  });
});
