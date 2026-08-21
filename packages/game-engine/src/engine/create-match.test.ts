import { describe, expect, it } from 'vitest';

import { createMatch } from './create-match';

describe('createMatch', () => {
  it('creates a serializable setup state with living players', () => {
    const state = createMatch({
      id: 'match-1',
      initialPhaseId: 'setup-1',
      players: [
        { displayName: 'An', id: 'player-1', seatIndex: 0 },
        { displayName: 'Binh', id: 'player-2', seatIndex: 1 },
      ],
      roleComposition: [{ count: 2, roleId: 'VILLAGER' }],
      rulesetId: 'boardgameviet-vn',
      rulesetVersion: '1.0.0',
    });

    expect(state).toMatchObject({
      cycle: 0,
      id: 'match-1',
      phase: { type: 'SETUP' },
      phaseId: 'setup-1',
      publicOffice: { mayorElectionCompleted: false },
      status: 'SETUP',
    });
    expect(state.players['player-1']).toEqual({
      displayName: 'An',
      lifeState: 'ALIVE',
      playerId: 'player-1',
      publicFlags: [],
      seatIndex: 0,
    });
    expect(state.roleAssignments).toEqual({});
    expect(state.events).toEqual([
      { matchId: 'match-1', type: 'MATCH_CREATED' },
    ]);
  });

  it('round-trips through JSON without losing state', () => {
    const state = createMatch({
      id: 'match-serialization',
      initialPhaseId: 'setup-serialization',
      players: [{ displayName: 'Chi', id: 'player-1', seatIndex: 0 }],
      roleComposition: [{ count: 1, roleId: 'SEER' }],
      rulesetId: 'boardgameviet-vn',
      rulesetVersion: '1.0.0',
      schemaVersion: 3,
    });

    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
