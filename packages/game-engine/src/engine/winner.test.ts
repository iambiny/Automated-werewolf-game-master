import { describe, expect, it } from 'vitest';

import type { MatchState } from '../index';
import {
  createNightTestState,
  markTestPlayerDead,
} from '../testing/night-state';
import { declareWinner, evaluateWinner } from './winner';

function stableDayState(): MatchState {
  const state = createNightTestState('SEER');
  return {
    ...state,
    phase: { dayNumber: 1, type: 'DAY_DEATH_RESOLUTION' },
    phaseId: 'day-1-death-resolution',
  };
}

function keepOnly(state: MatchState, livingPlayerIds: string[]): MatchState {
  return Object.keys(state.players).reduce(
    (current, playerId) =>
      livingPlayerIds.includes(playerId)
        ? current
        : markTestPlayerDead(current, playerId),
    state,
  );
}

describe('winner checkpoints', () => {
  it('declares Village when no Werewolf-aligned player remains', () => {
    const state = keepOnly(stableDayState(), ['seer', 'guard', 'villager']);

    expect(evaluateWinner(state, { werewolfCondition: 'PARITY' })).toEqual({
      reason: 'No living Werewolf-aligned players remain.',
      teamId: 'VILLAGE',
    });
  });

  it('declares Werewolves at configured parity', () => {
    const state = keepOnly(stableDayState(), ['wolf', 'villager']);

    expect(evaluateWinner(state, { werewolfCondition: 'PARITY' })).toEqual({
      reason: 'Werewolf-aligned players reached parity with the opposition.',
      teamId: 'WEREWOLF',
    });
  });

  it('records winner declaration without forcing a phase transition', () => {
    const state = keepOnly(stableDayState(), ['seer', 'villager']);

    const result = declareWinner(state, { werewolfCondition: 'PARITY' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.winner?.teamId).toBe('VILLAGE');
    expect(result.state.phase.type).toBe('DAY_DEATH_RESOLUTION');
    expect(result.events).toEqual([
      {
        type: 'WINNER_DECLARED',
        winner: {
          reason: 'No living Werewolf-aligned players remain.',
          teamId: 'VILLAGE',
        },
      },
    ]);
  });

  it('does not evaluate outside a stable checkpoint', () => {
    const state = keepOnly(createNightTestState('SEER'), ['wolf', 'villager']);

    expect(evaluateWinner(state, { werewolfCondition: 'PARITY' })).toBeNull();
  });
});
