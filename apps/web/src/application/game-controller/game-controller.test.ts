import {
  transitionPhase,
  type EngineResult,
  type MatchState,
} from '@werewolf/game-engine';
import { describe, expect, it } from 'vitest';

import type {
  MatchRepository,
  PersistedMatchEnvelope,
} from '../persistence/match-repository';
import { GameController, type GameCommand } from './game-controller';

class RecordingRepository implements MatchRepository {
  envelopes: PersistedMatchEnvelope[] = [];
  failNextSave = false;

  async delete(id: string): Promise<void> {
    this.envelopes = this.envelopes.filter(
      (envelope) => envelope.match.id !== id,
    );
  }

  async getActive(): Promise<PersistedMatchEnvelope | null> {
    return this.envelopes.at(-1) ?? null;
  }

  async save(envelope: PersistedMatchEnvelope): Promise<void> {
    if (this.failNextSave) {
      this.failNextSave = false;
      throw new Error('disk full');
    }
    this.envelopes.push(envelope);
  }
}

function executeCommand(state: MatchState, command: GameCommand): EngineResult {
  if (command.type !== 'TRANSITION_PHASE') {
    throw new Error(`Unexpected command ${command.type}`);
  }
  return transitionPhase(
    state,
    command.payload as Parameters<typeof transitionPhase>[1],
  );
}

const createInput = {
  id: 'match-1',
  initialPhaseId: 'phase-setup',
  players: [
    { displayName: 'An', id: 'player-1', seatIndex: 0 },
    { displayName: 'Binh', id: 'player-2', seatIndex: 1 },
  ],
  roleComposition: [
    { count: 1, roleId: 'WEREWOLF' },
    { count: 1, roleId: 'VILLAGER' },
  ],
  rulesetId: 'boardgameviet-vn',
  rulesetVersion: '1.0.0',
};

describe('GameController', () => {
  it('persists create and successful domain commands before exposing state', async () => {
    const repository = new RecordingRepository();
    const controller = new GameController({
      clock: () => 1234,
      executeCommand,
      repository,
    });

    await expect(controller.createMatch(createInput)).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      controller.dispatch({
        payload: {
          phase: { type: 'ROLE_REGISTRATION' },
          phaseId: 'phase-registration',
        },
        type: 'TRANSITION_PHASE',
      }),
    ).resolves.toMatchObject({ ok: true });

    expect(repository.envelopes).toHaveLength(2);
    expect(repository.envelopes[1]?.savedAt).toBe(1234);
    expect(controller.getPublicView()?.phase.type).toBe('ROLE_REGISTRATION');
  });

  it('does not advance visible state when persistence fails', async () => {
    const repository = new RecordingRepository();
    const controller = new GameController({ executeCommand, repository });
    await controller.createMatch(createInput);
    repository.failNextSave = true;

    const result = await controller.dispatch({
      payload: {
        phase: { type: 'ROLE_REGISTRATION' },
        phaseId: 'phase-registration',
      },
      type: 'TRANSITION_PHASE',
    });

    expect(result).toEqual({
      error: {
        code: 'PERSISTENCE_FAILED',
        message:
          'The match could not be saved. The visible state was not advanced.',
      },
      ok: false,
    });
    expect(controller.getPublicView()?.phase.type).toBe('SETUP');
    expect(repository.envelopes).toHaveLength(1);
  });

  it('loads and exposes a persisted active match through safe projections', async () => {
    const repository = new RecordingRepository();
    const first = new GameController({ executeCommand, repository });
    await first.createMatch(createInput);

    const reloaded = new GameController({ executeCommand, repository });
    await expect(reloaded.loadActiveMatch()).resolves.toMatchObject({
      status: 'READY',
    });
    expect(reloaded.getPublicView()?.matchId).toBe('match-1');
    expect(reloaded.getPrivateTurnView()).toBeNull();
  });
});
