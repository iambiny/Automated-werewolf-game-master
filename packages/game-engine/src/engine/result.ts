import type { JsonObject } from '@werewolf/shared';

import type { MatchState } from '../domain/match-state';
import type { DomainEvent } from '../events/domain-event';

export type DomainErrorCode =
  | 'INVALID_MATCH_INPUT'
  | 'INVALID_PHASE'
  | 'INVALID_TARGET'
  | 'ACTION_NOT_AVAILABLE'
  | 'ROLE_NOT_ELIGIBLE'
  | 'MATCH_ALREADY_COMPLETED';

export interface DomainError {
  code: DomainErrorCode;
  details?: JsonObject;
  message: string;
}

export type EngineResult<T = MatchState> =
  | {
      events: DomainEvent[];
      ok: true;
      state: T;
    }
  | {
      error: DomainError;
      ok: false;
      state: MatchState;
    };
