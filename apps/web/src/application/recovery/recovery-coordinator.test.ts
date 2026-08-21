import type {
  MatchRepository,
  PersistedMatchEnvelope,
} from '../persistence/match-repository';
import { createPersistedMatchEnvelope } from '../persistence/match-repository';
import { makeSecretNightState } from '../test-fixtures';
import { describe, expect, it } from 'vitest';

import { RecoveryCoordinator } from './recovery-coordinator';

class FixedRepository implements MatchRepository {
  constructor(private envelope: PersistedMatchEnvelope | null) {}

  async delete(): Promise<void> {
    this.envelope = null;
  }

  async getActive(): Promise<PersistedMatchEnvelope | null> {
    return this.envelope;
  }

  async save(envelope: PersistedMatchEnvelope): Promise<void> {
    this.envelope = envelope;
  }
}

describe('RecoveryCoordinator', () => {
  it.each([
    [
      { type: 'ROLE_REGISTRATION' } as const,
      'ROLE_REGISTRATION_PLAYER_HANDOFF',
    ],
    [{ dayNumber: 1, type: 'DISCUSSION' } as const, 'DAY_DISCUSSION'],
    [{ dayNumber: 1, round: 2, type: 'VOTING' } as const, 'DAY_VOTING'],
  ])('recovers %s at its safe checkpoint', async (phase, checkpoint) => {
    const state = makeSecretNightState();
    state.phase = phase;
    const result = await new RecoveryCoordinator(
      new FixedRepository(createPersistedMatchEnvelope(state, 100)),
    ).loadActive();

    expect(result).toMatchObject({ checkpoint, status: 'READY' });
  });

  it('recovers a submitted role action after the private result screen', async () => {
    const state = makeSecretNightState();
    const coordinator = new RecoveryCoordinator(
      new FixedRepository(createPersistedMatchEnvelope(state, 100)),
    );

    const result = await coordinator.loadActive();

    expect(result.status).toBe('READY');
    if (result.status === 'READY') {
      expect(result.checkpoint).toBe('NIGHT_AFTER_ROLE_SLEEP');
      expect(result.match).toEqual(state);
    }
  });

  it('recovers a completed night resolution', async () => {
    const state = makeSecretNightState();
    state.phase = { nightNumber: 1, subphase: 'RESOLUTION', type: 'NIGHT' };
    state.nightContext!.resolution = {
      attackPrevented: false,
      curseOutcome: 'NONE',
      deaths: [{ causes: ['WEREWOLF_ATTACK'], playerId: 'player-3' }],
      nightNumber: 1,
    };
    const coordinator = new RecoveryCoordinator(
      new FixedRepository(createPersistedMatchEnvelope(state, 100)),
    );

    const result = await coordinator.loadActive();

    expect(result.status).toBe('READY');
    if (result.status === 'READY') {
      expect(result.checkpoint).toBe('NIGHT_AFTER_ROLE_SLEEP');
      expect(result.match.nightContext?.resolution).toEqual(
        state.nightContext?.resolution,
      );
    }
  });

  it('fails safely for unsupported or malformed persisted schemas', async () => {
    const unsupported = createPersistedMatchEnvelope(
      makeSecretNightState(),
      100,
    );
    unsupported.schemaVersion = 999;
    await expect(
      new RecoveryCoordinator(new FixedRepository(unsupported)).loadActive(),
    ).resolves.toMatchObject({ code: 'UNSUPPORTED_SCHEMA', status: 'INVALID' });

    const malformed = createPersistedMatchEnvelope(makeSecretNightState(), 100);
    malformed.match = { id: 'broken' } as typeof malformed.match;
    await expect(
      new RecoveryCoordinator(new FixedRepository(malformed)).loadActive(),
    ).resolves.toMatchObject({
      code: 'INVALID_PERSISTED_MATCH',
      status: 'INVALID',
    });

    const invalidPhase = createPersistedMatchEnvelope(
      makeSecretNightState(),
      100,
    );
    invalidPhase.match.phase = {
      type: 'NIGHT',
      subphase: 'PRIVATE_RESULT',
    } as unknown as typeof invalidPhase.match.phase;
    await expect(
      new RecoveryCoordinator(new FixedRepository(invalidPhase)).loadActive(),
    ).resolves.toMatchObject({ status: 'INVALID' });
  });

  it('reports unavailable storage without throwing', async () => {
    const repository: MatchRepository = {
      delete: async () => undefined,
      getActive: async () => {
        throw new Error('blocked');
      },
      save: async () => undefined,
    };
    await expect(
      new RecoveryCoordinator(repository).loadActive(),
    ).resolves.toMatchObject({
      message: expect.stringContaining('storage is unavailable'),
      status: 'INVALID',
    });
  });
});
