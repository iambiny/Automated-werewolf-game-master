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
import { resolveSeerInspection } from './seer';
import {
  getLivingWerewolfAlignedPlayerIds,
  submitWerewolfAttack,
} from './werewolf';
import { submitWitchPoison } from './witch';

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

function success(result: { ok: boolean; state: MatchState }): MatchState {
  if (!result.ok) throw new Error('Expected command to succeed.');
  return result.state;
}

function attackHybrid(state = createNightTestState('WEREWOLF')): MatchState {
  return success(
    submitWerewolfAttack(
      setActiveNightTurn(state, 'WEREWOLF'),
      { actionId: 'attack-hybrid', targetPlayerId: 'hybrid-wolf' },
      { allowNoAttack: false, selectionStrategy: 'SHARED_SELECTION' },
    ),
  );
}

function resolve(state: MatchState) {
  return resolveNight(setNightResolutionPhase(state), resolutionRules);
}

describe('Hybrid Wolf conversion', () => {
  it('starts as Village/Hybrid Wolf for both Seer scan modes', () => {
    const state = createNightTestState('SEER');

    expect(resolveSeerInspection(state, 'hybrid-wolf', 'TEAM')).toEqual({
      mode: 'TEAM',
      teamId: 'VILLAGE',
    });
    expect(resolveSeerInspection(state, 'hybrid-wolf', 'ROLE')).toEqual({
      mode: 'ROLE',
      roleId: 'HYBRID_WOLF',
    });
  });

  it('survives an unprotected pack attack and permanently becomes a Werewolf', () => {
    const result = resolve(attackHybrid());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players['hybrid-wolf']?.lifeState).toBe('ALIVE');
    expect(result.state.roleAssignments['hybrid-wolf']).toEqual({
      converted: true,
      currentRoleId: 'WEREWOLF',
      originalRoleId: 'HYBRID_WOLF',
      teamId: 'WEREWOLF',
    });
    expect(result.state.roleState['hybrid-wolf']).toMatchObject({
      data: { converted: true },
      roleId: 'WEREWOLF',
    });
    expect(result.events).toContainEqual({
      playerId: 'hybrid-wolf',
      type: 'HYBRID_WOLF_CONVERTED',
    });
    expect(result.state.nightContext?.resolution?.deaths).toEqual([]);
    expect(getLivingWerewolfAlignedPlayerIds(result.state)).toContain(
      'hybrid-wolf',
    );
    expect(resolveSeerInspection(result.state, 'hybrid-wolf', 'TEAM')).toEqual({
      mode: 'TEAM',
      teamId: 'WEREWOLF',
    });
    expect(resolveSeerInspection(result.state, 'hybrid-wolf', 'ROLE')).toEqual({
      mode: 'ROLE',
      roleId: 'WEREWOLF',
    });
  });

  it('does not convert when Guard blocks the pack attack', () => {
    let state = createNightTestState('GUARD');
    state = success(
      submitGuardProtection(
        state,
        { actionId: 'guard-hybrid', targetPlayerId: 'hybrid-wolf' },
        {
          allowSameTargetConsecutiveNights: false,
          allowSelfProtect: false,
        },
      ),
    );
    const result = resolve(attackHybrid(state));

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.roleAssignments['hybrid-wolf']).toMatchObject({
      currentRoleId: 'HYBRID_WOLF',
      teamId: 'VILLAGE',
    });
    expect(result.state.nightContext?.resolution?.attackPrevented).toBe(true);
  });

  it('takes priority over Demon Wolf curse while consuming that curse', () => {
    let state = attackHybrid();
    state = success(
      submitDemonWolfCurseDecision(setActiveNightTurn(state, 'DEMON_WOLF'), {
        actionId: 'curse-hybrid',
        decision: 'CURSE',
      }),
    );
    const result = resolve(state);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.roleAssignments['hybrid-wolf']).toMatchObject({
      converted: true,
      currentRoleId: 'WEREWOLF',
    });
    expect(result.state.roleState['hybrid-wolf']?.data.cursed).toBeUndefined();
    expect(result.state.roleState['demon-wolf']?.data.curseAvailable).toBe(
      false,
    );
    expect(result.state.nightContext?.resolution?.curseOutcome).toBe(
      'CONSUMED',
    );
  });

  it('retains Demon Wolf curse when Guard blocks the shared target', () => {
    let state = createNightTestState('GUARD');
    state = success(
      submitGuardProtection(
        state,
        { actionId: 'guard-hybrid', targetPlayerId: 'hybrid-wolf' },
        {
          allowSameTargetConsecutiveNights: false,
          allowSelfProtect: false,
        },
      ),
    );
    state = attackHybrid(state);
    state = success(
      submitDemonWolfCurseDecision(setActiveNightTurn(state, 'DEMON_WOLF'), {
        actionId: 'curse-hybrid',
        decision: 'CURSE',
      }),
    );
    const result = resolve(state);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.roleState['demon-wolf']?.data.curseAvailable).toBe(
      true,
    );
    expect(result.state.roleAssignments['hybrid-wolf']?.currentRoleId).toBe(
      'HYBRID_WOLF',
    );
  });

  it('dies normally to Witch poison without converting', () => {
    const poisoned = success(
      submitWitchPoison(
        setActiveNightTurn(createNightTestState('WITCH'), 'WITCH'),
        { actionId: 'poison-hybrid', targetPlayerId: 'hybrid-wolf' },
        {
          allowHealAndPoisonSameNight: false,
          allowSelfHeal: true,
          allowSelfPoison: false,
          healPotionCount: 1,
          poisonPotionCount: 1,
          seesWerewolfVictim: true,
        },
      ),
    );
    const result = resolve(poisoned);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.players['hybrid-wolf']?.death?.causes).toEqual([
      'WITCH_POISON',
    ]);
    expect(result.state.roleAssignments['hybrid-wolf']).toMatchObject({
      currentRoleId: 'HYBRID_WOLF',
      teamId: 'VILLAGE',
    });
  });
});
