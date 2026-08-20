import { createMatch } from '@werewolf/game-engine';
import type {
  CreateMatchInput,
  DomainEvent,
  DomainError,
  EngineResult,
  MatchState,
} from '@werewolf/game-engine';

import {
  createPersistedMatchEnvelope,
  type MatchRepository,
} from '../persistence/match-repository';
import {
  toPrivateTurnView,
  toPublicGameView,
  type PrivateTurnView,
  type PublicGameView,
} from '../projections/game-view';
import {
  RecoveryCoordinator,
  type RecoveryResult,
} from '../recovery/recovery-coordinator';

export interface GameCommand<TPayload = unknown> {
  payload: TPayload;
  type: string;
}

export type GameCommandExecutor = (
  state: MatchState,
  command: GameCommand,
) => EngineResult;

export type GameCommandResult =
  | { events: DomainEvent[]; ok: true }
  | { error: DomainError; ok: false }
  | {
      error: {
        code: 'NO_ACTIVE_MATCH' | 'PERSISTENCE_FAILED';
        message: string;
      };
      ok: false;
    };

export interface GameControllerOptions {
  clock?: () => number;
  executeCommand: GameCommandExecutor;
  repository: MatchRepository;
}

export class GameController {
  private readonly clock: () => number;
  private readonly executeCommand: GameCommandExecutor;
  private readonly recovery: RecoveryCoordinator;
  private readonly repository: MatchRepository;
  private state: MatchState | null = null;

  constructor(options: GameControllerOptions) {
    this.clock = options.clock ?? Date.now;
    this.executeCommand = options.executeCommand;
    this.repository = options.repository;
    this.recovery = new RecoveryCoordinator(options.repository);
  }

  async createMatch(input: CreateMatchInput): Promise<GameCommandResult> {
    const match = createMatch(input);
    const saved = await this.persist(match);
    if (!saved.ok) return saved;

    this.state = match;
    return { events: match.events, ok: true };
  }

  async loadActiveMatch(): Promise<RecoveryResult> {
    const result = await this.recovery.loadActive();
    if (result.status === 'READY') this.state = result.match;
    return result;
  }

  async dispatch(command: GameCommand): Promise<GameCommandResult> {
    if (!this.state) {
      return {
        error: {
          code: 'NO_ACTIVE_MATCH',
          message: 'No active match is loaded.',
        },
        ok: false,
      };
    }

    const result = this.executeCommand(this.state, command);
    if (!result.ok) return { error: result.error, ok: false };

    const saved = await this.persist(result.state);
    if (!saved.ok) return saved;

    this.state = result.state;
    return { events: result.events, ok: true };
  }

  getPublicView(): PublicGameView | null {
    return this.state ? toPublicGameView(this.state) : null;
  }

  getPrivateTurnView(): PrivateTurnView | null {
    return this.state ? toPrivateTurnView(this.state) : null;
  }

  private async persist(state: MatchState): Promise<GameCommandResult> {
    try {
      await this.repository.save(
        createPersistedMatchEnvelope(state, this.clock()),
      );
      return { events: [], ok: true };
    } catch {
      return {
        error: {
          code: 'PERSISTENCE_FAILED',
          message:
            'The match could not be saved. The visible state was not advanced.',
        },
        ok: false,
      };
    }
  }
}
