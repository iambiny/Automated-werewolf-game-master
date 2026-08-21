import { describe, expect, it } from 'vitest';

import type { RoleCatalog } from '../domain/role-definition';
import { createMatch } from './create-match';
import { transitionPhase } from './phase-engine';
import {
  completeRoleRegistration,
  registerRole,
  resetRoleRegistration,
  startFirstNight,
} from './role-registration';

const catalog: RoleCatalog = {
  VILLAGER: {
    canPerformAction: () => false,
    description: 'Village role',
    hasPhysicalCard: true,
    id: 'VILLAGER',
    name: 'Villager',
    shouldNarrateTurn: () => false,
    teamId: 'VILLAGE',
  },
  WEREWOLF: {
    canPerformAction: () => true,
    description: 'Wolf role',
    hasPhysicalCard: true,
    id: 'WEREWOLF',
    name: 'Werewolf',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 30,
    },
    shouldNarrateTurn: () => true,
    teamId: 'WEREWOLF',
  },
};

function registrationState() {
  const setup = createMatch({
    id: 'registration-match',
    initialPhaseId: 'setup',
    players: [
      { displayName: 'An', id: 'player-1', seatIndex: 0 },
      { displayName: 'Binh', id: 'player-2', seatIndex: 1 },
    ],
    roleComposition: [
      { count: 1, roleId: 'VILLAGER' },
      { count: 1, roleId: 'WEREWOLF' },
    ],
    rulesetId: 'test',
    rulesetVersion: '1',
  });
  const result = transitionPhase(setup, {
    phase: { type: 'ROLE_REGISTRATION' },
    phaseId: 'registration',
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.state;
}

function assign(
  state: ReturnType<typeof registrationState>,
  playerId: string,
  roleId: 'VILLAGER' | 'WEREWOLF',
) {
  return registerRole(
    state,
    { playerId, roleId, roleState: { data: {}, playerId, roleId } },
    catalog,
  );
}

describe('role registration', () => {
  it('registers assignments without enforcing partial deck counts', () => {
    const first = assign(registrationState(), 'player-1', 'WEREWOLF');
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = assign(first.state, 'player-2', 'WEREWOLF');
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    const complete = completeRoleRegistration(second.state, 'validation');
    expect(complete).toMatchObject({
      error: {
        message:
          'Role registration does not match the selected deck. Please re-register roles.',
      },
      ok: false,
    });
  });

  it('clears every secret assignment when registration restarts', () => {
    const registered = assign(registrationState(), 'player-1', 'VILLAGER');
    if (!registered.ok) throw new Error(registered.error.message);

    const reset = resetRoleRegistration(registered.state);

    expect(reset.ok).toBe(true);
    if (reset.ok) {
      expect(reset.state.roleAssignments).toEqual({});
      expect(reset.state.roleState).toEqual({});
    }
  });

  it('starts Night 1 only after a matching registration', () => {
    const first = assign(registrationState(), 'player-1', 'VILLAGER');
    if (!first.ok) throw new Error(first.error.message);
    const second = assign(first.state, 'player-2', 'WEREWOLF');
    if (!second.ok) throw new Error(second.error.message);
    const complete = completeRoleRegistration(second.state, 'validation');
    if (!complete.ok) throw new Error(complete.error.message);

    const started = startFirstNight(complete.state, 'night-1', catalog);

    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(started.state.status).toBe('ACTIVE');
      expect(started.state.phase).toEqual({
        nightNumber: 1,
        subphase: 'PREPARE_QUEUE',
        type: 'NIGHT',
      });
      expect(started.state.nightContext?.queue).toEqual([
        { mode: 'ACTIVE', order: 30, roleId: 'WEREWOLF' },
      ]);
    }
  });
});
