import { describe, expect, it } from 'vitest';

import { createNightTestState } from '../../../../../packages/game-engine/src/testing/night-state';
import { DEFAULT_SETUP_RULES } from '../setup/setup-model';
import { toMvpPublicGameView } from './mvp-public-game-view';

describe('MVP public daytime projection', () => {
  it('honors the configured death reveal policy without exposing causes', () => {
    const state = createNightTestState('SEER');
    state.phase = { dayNumber: 1, subphase: 'ANNOUNCEMENT', type: 'MORNING' };
    state.players.villager = {
      ...state.players.villager!,
      death: {
        announced: false,
        causes: ['WEREWOLF_ATTACK'],
        phaseId: 'night-1-resolution',
      },
      lifeState: 'DEAD',
    };

    const hidden = toMvpPublicGameView(state, {
      ...DEFAULT_SETUP_RULES,
      deathRevealPolicy: 'NONE',
    });
    const revealed = toMvpPublicGameView(state, DEFAULT_SETUP_RULES);

    expect(hidden.unannouncedDeaths?.[0]).not.toHaveProperty('revealedRoleId');
    expect(revealed.unannouncedDeaths?.[0]).toMatchObject({
      playerId: 'villager',
      revealedRoleId: 'VILLAGER',
    });
    expect(JSON.stringify(revealed)).not.toContain('WEREWOLF_ATTACK');
    expect(revealed).not.toHaveProperty('roleAssignments');
  });

  it('reveals all assignments only after GAME_OVER', () => {
    const state = createNightTestState('SEER');
    expect(toMvpPublicGameView(state, DEFAULT_SETUP_RULES).revealedRoles).toBe(
      undefined,
    );

    state.phase = { type: 'GAME_OVER' };
    state.status = 'COMPLETED';
    const view = toMvpPublicGameView(state, DEFAULT_SETUP_RULES);

    expect(view.revealedRoles).toHaveLength(8);
    expect(
      view.revealedRoles?.find((player) => player.playerId === 'wolf'),
    ).toMatchObject({
      roleId: 'WEREWOLF',
      teamId: 'WEREWOLF',
    });
  });
});
