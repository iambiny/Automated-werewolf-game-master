import { describe, expect, it } from 'vitest';

import {
  createNightTestState,
  markTestPlayerDead,
} from '../testing/night-state';
import { submitGuardProtection } from './guard';

const restrictiveRules = {
  allowSameTargetConsecutiveNights: false,
  allowSelfProtect: false,
};

describe('Guard mechanics', () => {
  it('records protection and the previous target without mutating input', () => {
    const state = createNightTestState('GUARD');
    const snapshot = JSON.parse(JSON.stringify(state));

    const result = submitGuardProtection(
      state,
      { actionId: 'guard-action-1', targetPlayerId: 'villager' },
      restrictiveRules,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingEffects).toEqual([
      {
        sourcePlayerIds: ['guard'],
        sourceRoleId: 'GUARD',
        targetPlayerIds: ['villager'],
        type: 'PROTECT',
        visibility: 'INTERNAL',
      },
    ]);
    expect(result.state.roleState.guard?.data.lastProtectedPlayerId).toBe(
      'villager',
    );
    expect(state).toEqual(snapshot);
  });

  it('rejects dead and self targets when ineligible', () => {
    const state = markTestPlayerDead(createNightTestState('GUARD'), 'villager');

    const deadTarget = submitGuardProtection(
      state,
      { actionId: 'guard-dead-target', targetPlayerId: 'villager' },
      restrictiveRules,
    );
    const selfTarget = submitGuardProtection(
      state,
      { actionId: 'guard-self-target', targetPlayerId: 'guard' },
      restrictiveRules,
    );

    expect(deadTarget).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
    expect(selfTarget).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
  });

  it('enforces or permits consecutive protection from explicit rules', () => {
    const state = createNightTestState('GUARD');
    state.roleState.guard = {
      data: { lastProtectedPlayerId: 'villager' },
      playerId: 'guard',
      roleId: 'GUARD',
    };

    const rejected = submitGuardProtection(
      state,
      { actionId: 'guard-repeat-rejected', targetPlayerId: 'villager' },
      restrictiveRules,
    );
    const accepted = submitGuardProtection(
      state,
      { actionId: 'guard-repeat-accepted', targetPlayerId: 'villager' },
      { ...restrictiveRules, allowSameTargetConsecutiveNights: true },
    );

    expect(rejected).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
    expect(accepted.ok).toBe(true);
  });

  it('does not accept an action from a dead Guard DECOY turn', () => {
    const state = markTestPlayerDead(
      createNightTestState('GUARD', 'DECOY'),
      'guard',
    );

    const result = submitGuardProtection(
      state,
      { actionId: 'dead-guard-action', targetPlayerId: 'villager' },
      restrictiveRules,
    );

    expect(result).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });
  });
});
