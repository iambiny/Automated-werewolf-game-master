import { describe, expect, it } from 'vitest';

import {
  createNightTestState,
  markTestPlayerDead,
} from '../testing/night-state';
import {
  getLivingWerewolfAlignedPlayerIds,
  submitWerewolfAttack,
} from './werewolf';

const rules = {
  allowNoAttack: false,
  selectionStrategy: 'SHARED_SELECTION' as const,
};

describe('Werewolf mechanics', () => {
  it('records one shared attack without immediately killing its target', () => {
    const state = createNightTestState('WEREWOLF');
    const snapshot = JSON.parse(JSON.stringify(state));

    const result = submitWerewolfAttack(
      state,
      { actionId: 'wolf-action-1', targetPlayerId: 'villager' },
      rules,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingActions).toHaveLength(1);
    expect(result.state.pendingEffects).toEqual([
      {
        sourcePlayerIds: ['wolf', 'demon-wolf'],
        sourceRoleId: 'WEREWOLF',
        targetPlayerIds: ['villager'],
        type: 'WEREWOLF_ATTACK',
        visibility: 'INTERNAL',
      },
    ]);
    expect(result.state.nightContext?.werewolfAttackTargetId).toBe('villager');
    expect(result.state.players.villager?.lifeState).toBe('ALIVE');
    expect(state).toEqual(snapshot);
  });

  it('includes a transformed cursed player in the attack group', () => {
    const state = createNightTestState('WEREWOLF');
    state.roleAssignments.villager = {
      currentRoleId: 'WEREWOLF',
      originalRoleId: 'VILLAGER',
      teamId: 'WEREWOLF',
    };

    expect(getLivingWerewolfAlignedPlayerIds(state)).toEqual([
      'wolf',
      'demon-wolf',
      'villager',
    ]);

    const result = submitWerewolfAttack(
      state,
      { actionId: 'wolf-with-convert', targetPlayerId: 'guard' },
      rules,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingActions[0]?.actorPlayerIds).toEqual([
      'wolf',
      'demon-wolf',
      'villager',
    ]);
  });

  it('excludes dead wolves from the attack group', () => {
    const state = markTestPlayerDead(createNightTestState('WEREWOLF'), 'wolf');

    expect(getLivingWerewolfAlignedPlayerIds(state)).toEqual(['demon-wolf']);
  });

  it('rejects living Werewolf-aligned targets', () => {
    const state = createNightTestState('WEREWOLF');

    const result = submitWerewolfAttack(
      state,
      { actionId: 'wolf-friendly-fire', targetPlayerId: 'demon-wolf' },
      rules,
    );

    expect(result).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
  });

  it('rejects dead targets', () => {
    const state = markTestPlayerDead(
      createNightTestState('WEREWOLF'),
      'villager',
    );

    const result = submitWerewolfAttack(
      state,
      { actionId: 'wolf-dead-target', targetPlayerId: 'villager' },
      rules,
    );

    expect(result).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
  });

  it('supports an explicit no-attack rule without creating an effect', () => {
    const state = createNightTestState('WEREWOLF');

    const rejected = submitWerewolfAttack(
      state,
      { actionId: 'wolf-must-attack', targetPlayerId: null },
      rules,
    );
    const accepted = submitWerewolfAttack(
      state,
      { actionId: 'wolf-may-skip', targetPlayerId: null },
      { ...rules, allowNoAttack: true },
    );

    expect(rejected).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(accepted.state.pendingEffects).toEqual([]);
    expect(accepted.state.nightContext?.werewolfAttackTargetId).toBeNull();
  });

  it('rejects duplicate shared attacks for the same night', () => {
    const state = createNightTestState('WEREWOLF');
    const first = submitWerewolfAttack(
      state,
      { actionId: 'wolf-first', targetPlayerId: 'villager' },
      rules,
    );
    if (!first.ok) throw new Error(first.error.message);

    const duplicate = submitWerewolfAttack(
      first.state,
      { actionId: 'wolf-duplicate', targetPlayerId: 'guard' },
      rules,
    );

    expect(duplicate).toMatchObject({
      error: { code: 'ALREADY_SUBMITTED' },
      ok: false,
    });
  });
});
