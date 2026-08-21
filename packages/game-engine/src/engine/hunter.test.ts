import { describe, expect, it } from 'vitest';

import type { EngineResult, MatchState, NightResolutionRules } from '../index';
import {
  createNightTestState,
  markTestPlayerDead,
  setActiveNightTurn,
  setNightResolutionPhase,
} from '../testing/night-state';
import { submitHunterShot } from './hunter';
import { resolveNight } from './night-resolution';
import { submitWerewolfAttack } from './werewolf';
import { evaluateWinner } from './winner';

const resolutionRules: NightResolutionRules = {
  healPreventsCurse: true,
  hunter: {
    eligibleShotCauses: [
      'WEREWOLF_ATTACK',
      'WITCH_POISON',
      'HUNTER_SHOT',
      'DAY_EXECUTION',
    ],
  },
  mayor: {
    electionDay: 1,
    executionVoteWeight: 2,
    officeOnDeath: 'VACANT',
  },
};

function success(result: EngineResult): MatchState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function killHunterAtNight(): MatchState {
  let state = markTestPlayerDead(
    createNightTestState('WEREWOLF'),
    'demon-wolf',
  );
  state = success(
    submitWerewolfAttack(
      setActiveNightTurn(state, 'WEREWOLF'),
      { actionId: 'attack-hunter', targetPlayerId: 'hunter' },
      { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
    ),
  );
  return success(resolveNight(setNightResolutionPhase(state), resolutionRules));
}

describe('Hunter mechanics', () => {
  it('creates a delayed morning trigger instead of shooting at night', () => {
    const state = killHunterAtNight();

    expect(state.players.hunter?.lifeState).toBe('DEAD');
    expect(state.pendingTriggers).toEqual([
      { playerId: 'hunter', type: 'HUNTER_MORNING_SHOT' },
    ]);
    expect(
      state.events.some((event) => event.type === 'HUNTER_SHOT_RESOLVED'),
    ).toBe(false);
  });

  it('blocks winner evaluation until the mandatory shot resolves', () => {
    const state = killHunterAtNight();
    const morning: MatchState = {
      ...state,
      phase: {
        dayNumber: 1,
        subphase: 'MORNING_TRIGGERS',
        type: 'MORNING',
      },
      phaseId: 'morning-1-hunter',
    };

    expect(evaluateWinner(morning, { werewolfCondition: 'PARITY' })).toBeNull();

    const shot = submitHunterShot(
      morning,
      { actionId: 'hunter-shot', targetPlayerId: 'wolf' },
      { hunter: resolutionRules.hunter, mayor: resolutionRules.mayor },
    );

    expect(shot.ok).toBe(true);
    if (!shot.ok) throw new Error(shot.error.message);
    expect(shot.state.players.wolf?.death?.causes).toEqual(['HUNTER_SHOT']);
    expect(shot.state.pendingTriggers).toEqual([]);
    expect(evaluateWinner(shot.state, { werewolfCondition: 'PARITY' })).toEqual(
      {
        reason: 'No living Werewolf-aligned players remain.',
        teamId: 'VILLAGE',
      },
    );
  });

  it('allows exactly one resolution per pending trigger', () => {
    const state = killHunterAtNight();
    const morning: MatchState = {
      ...state,
      phase: {
        dayNumber: 1,
        subphase: 'MORNING_TRIGGERS',
        type: 'MORNING',
      },
    };
    const first = submitHunterShot(
      morning,
      { actionId: 'hunter-first-shot', targetPlayerId: 'wolf' },
      { hunter: resolutionRules.hunter, mayor: resolutionRules.mayor },
    );
    if (!first.ok) throw new Error(first.error.message);

    const second = submitHunterShot(
      first.state,
      { actionId: 'hunter-second-shot', targetPlayerId: 'guard' },
      { hunter: resolutionRules.hunter, mayor: resolutionRules.mayor },
    );

    expect(second).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });
  });
});
