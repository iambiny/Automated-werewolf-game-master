import { describe, expect, it } from 'vitest';

import { makeSecretNightState } from '../test-fixtures';
import { toPrivateTurnView, toPublicGameView } from './game-view';

describe('game view projections', () => {
  it('omits all hidden role and night data from the public view', () => {
    const view = toPublicGameView(makeSecretNightState());

    expect(view.players.map((player) => player.displayName)).toEqual([
      'An',
      'Binh',
      'Chi',
    ]);
    expect(view).not.toHaveProperty('roleAssignments');
    expect(view).not.toHaveProperty('roleState');
    expect(view).not.toHaveProperty('nightContext');
    expect(JSON.stringify(view)).not.toContain('WEREWOLF');
    expect(JSON.stringify(view)).not.toContain('healPotionRemaining');
  });

  it('returns the current active Seer result only in the private view', () => {
    expect(toPrivateTurnView(makeSecretNightState())).toEqual({
      instruction: 'Complete the private SEER turn.',
      mode: 'ACTIVE',
      privateResult: {
        result: { mode: 'ROLE', roleId: 'WEREWOLF' },
        targetPlayerId: 'player-2',
      },
      roleId: 'SEER',
    });
  });

  it('never includes a private result for a decoy turn', () => {
    const state = makeSecretNightState();
    state.nightContext!.queue[0] = {
      mode: 'DECOY',
      order: 10,
      roleId: 'SEER',
    };

    expect(toPrivateTurnView(state)).toEqual({
      instruction: 'Complete the private SEER handoff.',
      mode: 'DECOY',
      roleId: 'SEER',
    });
  });
});
