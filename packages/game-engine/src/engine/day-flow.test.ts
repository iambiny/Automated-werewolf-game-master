import { describe, expect, it } from 'vitest';

import type { RoleCatalog } from '../domain/role-definition';
import { createNightTestState } from '../testing/night-state';
import { announcePendingDeaths, startNextNight } from './day-flow';

const catalog: RoleCatalog = {
  SEER: {
    canPerformAction: () => true,
    description: 'Seer',
    hasPhysicalCard: true,
    id: 'SEER',
    name: 'Seer',
    night: {
      activation: 'EVERY_NIGHT',
      narratorAlwaysCallsIfInComposition: true,
      order: 10,
    },
    shouldNarrateTurn: () => true,
    teamId: 'VILLAGE',
  },
};

describe('day flow', () => {
  it('marks public deaths announced without changing their causes', () => {
    const state = createNightTestState('SEER');
    state.phase = { dayNumber: 1, subphase: 'ANNOUNCEMENT', type: 'MORNING' };
    state.players.villager = {
      ...state.players.villager!,
      death: {
        announced: false,
        causes: ['WEREWOLF_ATTACK'],
        phaseId: 'night-resolution',
      },
      lifeState: 'DEAD',
    };

    const result = announcePendingDeaths(state);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players.villager?.death).toEqual({
        announced: true,
        causes: ['WEREWOLF_ATTACK'],
        phaseId: 'night-resolution',
      });
    }
  });

  it('builds a fresh queue only after daytime triggers clear', () => {
    const state = createNightTestState('SEER');
    state.phase = { dayNumber: 1, type: 'DAY_DEATH_RESOLUTION' };
    state.pendingTriggers = [];

    const result = startNextNight(state, 'night-2-prepare', catalog);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.phase).toEqual({
        nightNumber: 2,
        subphase: 'PREPARE_QUEUE',
        type: 'NIGHT',
      });
      expect(result.state.nightContext).toMatchObject({
        actions: [],
        currentTurnIndex: 0,
        nightNumber: 2,
      });
    }
  });
});
