import type { MatchState } from '@werewolf/game-engine';
import type { MatchId } from '@werewolf/game-engine';

export const PERSISTED_MATCH_SCHEMA_VERSION = 1;
export const ENGINE_VERSION = '0.0.0';

export interface PersistedMatchEnvelope {
  engineVersion: string;
  match: MatchState;
  rulesetId: string;
  rulesetVersion: string;
  savedAt: number;
  schemaVersion: number;
}

export interface MatchRepository {
  delete(id: MatchId): Promise<void>;
  getActive(): Promise<PersistedMatchEnvelope | null>;
  save(envelope: PersistedMatchEnvelope): Promise<void>;
}

export function createPersistedMatchEnvelope(
  match: MatchState,
  savedAt: number,
): PersistedMatchEnvelope {
  return {
    engineVersion: ENGINE_VERSION,
    match,
    rulesetId: match.rulesetId,
    rulesetVersion: match.rulesetVersion,
    savedAt,
    schemaVersion: PERSISTED_MATCH_SCHEMA_VERSION,
  };
}
