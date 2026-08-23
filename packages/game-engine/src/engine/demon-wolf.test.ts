import { describe, expect, it } from 'vitest';

import type { MatchState, NightResolutionRules } from '../index';
import {
  createNightTestState,
  setActiveNightTurn,
  setNightResolutionPhase,
} from '../testing/night-state';
import { submitDemonWolfCurseDecision } from './demon-wolf';
import { submitGuardProtection } from './guard';
import { resolveNight } from './night-resolution';
import { submitWerewolfAttack } from './werewolf';

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

function success(result: ReturnType<typeof submitWerewolfAttack>): MatchState {
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function submitWolfTarget(
  state: MatchState,
  targetPlayerId: string,
): MatchState {
  return success(
    submitWerewolfAttack(
      setActiveNightTurn(state, 'WEREWOLF'),
      { actionId: 'wolf-attack', targetPlayerId },
      { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
    ),
  );
}

function submitCurse(state: MatchState): MatchState {
  return success(
    submitDemonWolfCurseDecision(setActiveNightTurn(state, 'DEMON_WOLF'), {
      actionId: 'demon-curse',
      decision: 'CURSE',
    }),
  );
}

describe('Demon Wolf mechanics', () => {
  it('uses exactly the preceding Werewolf attack target without consuming immediately', () => {
    const attacked = submitWolfTarget(
      createNightTestState('WEREWOLF'),
      'villager',
    );

    const cursed = submitDemonWolfCurseDecision(
      setActiveNightTurn(attacked, 'DEMON_WOLF'),
      { actionId: 'curse-intent', decision: 'CURSE' },
    );

    expect(cursed.ok).toBe(true);
    if (!cursed.ok) throw new Error(cursed.error.message);
    expect(cursed.state.pendingEffects.at(-1)).toEqual({
      sourcePlayerIds: ['demon-wolf'],
      sourceRoleId: 'DEMON_WOLF',
      targetPlayerIds: ['villager'],
      type: 'DEMON_WOLF_CURSE_INTENT',
      visibility: 'PRIVATE',
    });
    expect(cursed.state.roleState['demon-wolf']?.data.curseAvailable).toBe(
      true,
    );
  });

  it('rejects CURSE when the Werewolves selected no target', () => {
    const state = createNightTestState('DEMON_WOLF');
    if (state.nightContext) state.nightContext.werewolfAttackTargetId = null;

    const result = submitDemonWolfCurseDecision(state, {
      actionId: 'curse-without-target',
      decision: 'CURSE',
    });

    expect(result).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });
  });

  it('retains the curse when Guard prevents the attack', () => {
    let state = createNightTestState('GUARD');
    state = success(
      submitGuardProtection(
        state,
        { actionId: 'guard-protect', targetPlayerId: 'villager' },
        {
          allowSameTargetConsecutiveNights: false,
          allowSelfProtect: false,
        },
      ),
    );
    state = submitWolfTarget(state, 'villager');
    state = submitCurse(state);

    const resolution = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.players.villager?.lifeState).toBe('ALIVE');
    expect(resolution.state.roleState['demon-wolf']?.data.curseAvailable).toBe(
      true,
    );
    expect(resolution.state.nightContext?.resolution?.curseOutcome).toBe(
      'FAILED',
    );
  });

  it('converts an unprotected target and consumes the curse on success', () => {
    let state = createNightTestState('WEREWOLF');
    state = submitWolfTarget(state, 'villager');
    state = submitCurse(state);

    const resolution = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.players.villager?.lifeState).toBe('ALIVE');
    expect(resolution.state.roleAssignments.villager).toMatchObject({
      currentRoleId: 'VILLAGER',
      originalRoleId: 'VILLAGER',
      teamId: 'WEREWOLF',
    });
    expect(resolution.state.roleState['demon-wolf']?.data.curseAvailable).toBe(
      false,
    );
    expect(resolution.state.roleState.villager?.data.cursed).toBe(true);
    expect(resolution.state.nightContext?.resolution).toMatchObject({
      curseOutcome: 'SUCCEEDED',
      deaths: [],
      transformedPlayerId: 'villager',
    });
    expect(resolution.events).toContainEqual({
      playerId: 'villager',
      type: 'PLAYER_CURSED',
    });
  });

  it('resolves an ordinary Werewolf death when no curse is used', () => {
    const state = submitWolfTarget(
      createNightTestState('WEREWOLF'),
      'villager',
    );

    const resolution = resolveNight(
      setNightResolutionPhase(state),
      resolutionRules,
    );

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) throw new Error(resolution.error.message);
    expect(resolution.state.players.villager?.death?.causes).toEqual([
      'WEREWOLF_ATTACK',
    ]);
    expect(resolution.state.nightContext?.resolution?.curseOutcome).toBe(
      'NONE',
    );
  });
});
