import { describe, expect, it } from 'vitest';

import type {
  EngineResult,
  MatchState,
  NightResolutionRules,
  WitchRules,
} from '../index';
import {
  createNightTestState,
  setActiveNightTurn,
  setNightResolutionPhase,
} from '../testing/night-state';
import { submitDemonWolfCurseDecision } from './demon-wolf';
import { resolveNight } from './night-resolution';
import { submitWerewolfAttack } from './werewolf';
import { submitWitchHeal, submitWitchPoison } from './witch';

const witchRules: WitchRules = {
  allowHealAndPoisonSameNight: true,
  allowSelfHeal: false,
  allowSelfPoison: false,
  healPotionCount: 1,
  poisonPotionCount: 1,
  seesWerewolfVictim: true,
};

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

function attack(state: MatchState, targetPlayerId: string): MatchState {
  return success(
    submitWerewolfAttack(
      setActiveNightTurn(state, 'WEREWOLF'),
      { actionId: `attack-${targetPlayerId}`, targetPlayerId },
      { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
    ),
  );
}

describe('Witch mechanics', () => {
  it('uses a healing potion to prevent an eligible Werewolf death', () => {
    let state = attack(createNightTestState('WEREWOLF'), 'villager');
    state = success(
      submitWitchHeal(
        setActiveNightTurn(state, 'WITCH'),
        { actionId: 'witch-heal', targetPlayerId: 'villager' },
        witchRules,
      ),
    );

    expect(state.roleState.witch?.data.healPotionRemaining).toBe(0);
    const resolution = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.players.villager?.lifeState).toBe('ALIVE');
    expect(resolution.state.nightContext?.resolution?.attackPrevented).toBe(
      true,
    );
  });

  it('uses poison to kill a living target with the correct cause', () => {
    let state = createNightTestState('WITCH');
    state = success(
      submitWitchPoison(
        state,
        { actionId: 'witch-poison', targetPlayerId: 'villager' },
        witchRules,
      ),
    );

    expect(state.roleState.witch?.data.poisonPotionRemaining).toBe(0);
    const resolution = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.players.villager?.death?.causes).toEqual([
      'WITCH_POISON',
    ]);
  });

  it('enforces the configured dual-potion restriction', () => {
    let state = attack(createNightTestState('WEREWOLF'), 'villager');
    state = success(
      submitWitchHeal(
        setActiveNightTurn(state, 'WITCH'),
        { actionId: 'witch-heal-only', targetPlayerId: 'villager' },
        { ...witchRules, allowHealAndPoisonSameNight: false },
      ),
    );

    const poison = submitWitchPoison(
      state,
      { actionId: 'witch-poison-disallowed', targetPlayerId: 'guard' },
      { ...witchRules, allowHealAndPoisonSameNight: false },
    );

    expect(poison).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });
  });

  it('rejects an exhausted potion', () => {
    const state = createNightTestState('WITCH');
    if (state.roleState.witch) {
      state.roleState.witch.data.poisonPotionRemaining = 0;
    }

    const result = submitWitchPoison(
      state,
      { actionId: 'witch-no-poison', targetPlayerId: 'villager' },
      witchRules,
    );

    expect(result).toMatchObject({
      error: { code: 'RESOURCE_EXHAUSTED' },
      ok: false,
    });
  });

  it('can explicitly make healing prevent a pending curse', () => {
    let state = attack(createNightTestState('WEREWOLF'), 'villager');
    state = success(
      submitDemonWolfCurseDecision(setActiveNightTurn(state, 'DEMON_WOLF'), {
        actionId: 'curse-healed-target',
        decision: 'CURSE',
      }),
    );
    state = success(
      submitWitchHeal(
        setActiveNightTurn(state, 'WITCH'),
        { actionId: 'heal-cursed-target', targetPlayerId: 'villager' },
        witchRules,
      ),
    );

    const resolution = resolveNight(setNightResolutionPhase(state), {
      ...resolutionRules,
      healPreventsCurse: true,
    });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.players.villager?.lifeState).toBe('ALIVE');
    expect(resolution.state.roleAssignments.villager?.teamId).toBe('VILLAGE');
    expect(resolution.state.nightContext?.resolution?.curseOutcome).toBe(
      'FAILED',
    );
    expect(resolution.state.roleState['demon-wolf']?.data.curseAvailable).toBe(
      true,
    );
  });
});
