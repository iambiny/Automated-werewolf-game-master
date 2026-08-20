import { transitionPhase } from '@werewolf/game-engine';
import { describe, expect, it } from 'vitest';

import { makeMatchState } from '../test-fixtures';
import { toRoleRegistrationView } from './role-registration-view';

describe('role registration projection', () => {
  it('identifies the next seat without exposing prior role choices', () => {
    const transitioned = transitionPhase(makeMatchState(), {
      phase: { type: 'ROLE_REGISTRATION' },
      phaseId: 'registration',
    });
    if (!transitioned.ok) throw new Error(transitioned.error.message);
    const state = {
      ...transitioned.state,
      roleAssignments: {
        'player-1': {
          currentRoleId: 'SEER',
          originalRoleId: 'SEER',
          teamId: 'VILLAGE',
        },
      },
    };

    const view = toRoleRegistrationView(state);

    expect(view?.currentPlayer).toMatchObject({
      displayName: 'Binh',
      playerId: 'player-2',
    });
    expect(JSON.stringify(view)).not.toContain('SEER');
  });
});
