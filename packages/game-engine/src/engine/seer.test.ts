import { describe, expect, it } from 'vitest';

import {
  createNightTestState,
  markTestPlayerCursed,
  markTestPlayerDead,
} from '../testing/night-state';
import { resolveSeerInspection, submitSeerInspection } from './seer';

describe('Seer mechanics', () => {
  it('returns only the target team in TEAM mode', () => {
    const state = createNightTestState('SEER');

    expect(resolveSeerInspection(state, 'demon-wolf', 'TEAM')).toEqual({
      mode: 'TEAM',
      teamId: 'WEREWOLF',
    });
  });

  it('returns the Fool as an unclear third alignment in TEAM mode', () => {
    const state = createNightTestState('SEER');

    expect(resolveSeerInspection(state, 'fool', 'TEAM')).toEqual({
      mode: 'TEAM',
      teamId: 'FOOL',
    });
  });

  it('returns the exact current role in ROLE mode', () => {
    const state = createNightTestState('SEER');

    expect(resolveSeerInspection(state, 'demon-wolf', 'ROLE')).toEqual({
      mode: 'ROLE',
      roleId: 'DEMON_WOLF',
    });
  });

  it('records the action and a private investigation effect immutably', () => {
    const state = createNightTestState('SEER');
    const snapshot = JSON.parse(JSON.stringify(state));

    const result = submitSeerInspection(
      state,
      { actionId: 'seer-action-1', targetPlayerId: 'wolf' },
      { allowSelfInspect: false, investigationMode: 'TEAM' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.state.pendingActions).toHaveLength(1);
    expect(result.state.pendingEffects).toEqual([
      {
        payload: { mode: 'TEAM', teamId: 'WEREWOLF' },
        sourcePlayerIds: ['seer'],
        sourceRoleId: 'SEER',
        targetPlayerIds: ['wolf'],
        type: 'INVESTIGATION_RESULT',
        visibility: 'PRIVATE',
      },
    ]);
    expect(result.events).toEqual([
      {
        action: expect.objectContaining({ type: 'SEER_INSPECT' }),
        type: 'ACTION_SUBMITTED',
      },
    ]);
    expect(state).toEqual(snapshot);
  });

  it('rejects a dead target without changing state', () => {
    const state = markTestPlayerDead(createNightTestState('SEER'), 'villager');

    const result = submitSeerInspection(
      state,
      { actionId: 'seer-action-dead-target', targetPlayerId: 'villager' },
      { allowSelfInspect: false, investigationMode: 'ROLE' },
    );

    expect(result).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
    expect(result.state).toBe(state);
  });

  it('rejects self-inspection when disabled', () => {
    const state = createNightTestState('SEER');

    const result = submitSeerInspection(
      state,
      { actionId: 'seer-action-self', targetPlayerId: 'seer' },
      { allowSelfInspect: false, investigationMode: 'TEAM' },
    );

    expect(result).toMatchObject({
      error: { code: 'INVALID_TARGET' },
      ok: false,
    });
  });

  it('does not accept an action from a dead Seer DECOY turn', () => {
    const state = markTestPlayerDead(
      createNightTestState('SEER', 'DECOY'),
      'seer',
    );

    const result = submitSeerInspection(
      state,
      { actionId: 'dead-seer-action', targetPlayerId: 'wolf' },
      { allowSelfInspect: false, investigationMode: 'TEAM' },
    );

    expect(result).toMatchObject({
      error: { code: 'ACTION_NOT_AVAILABLE' },
      ok: false,
    });
  });

  it('does not accept an action from a cursed Seer', () => {
    const state = markTestPlayerCursed(createNightTestState('SEER'), 'seer');

    const result = submitSeerInspection(
      state,
      { actionId: 'cursed-seer-action', targetPlayerId: 'wolf' },
      { allowSelfInspect: false, investigationMode: 'TEAM' },
    );

    expect(result).toMatchObject({
      error: { code: 'ROLE_NOT_ELIGIBLE' },
      ok: false,
    });
  });

  it('rejects inspection outside an active night role turn', () => {
    const state = createNightTestState('SEER');
    state.phase = { type: 'DISCUSSION', dayNumber: 1 };

    const result = submitSeerInspection(
      state,
      { actionId: 'seer-wrong-phase', targetPlayerId: 'wolf' },
      { allowSelfInspect: false, investigationMode: 'TEAM' },
    );

    expect(result).toMatchObject({
      error: { code: 'INVALID_PHASE' },
      ok: false,
    });
  });
});
