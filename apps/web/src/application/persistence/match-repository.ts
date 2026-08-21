import type { JsonObject, MatchId, MatchState } from '@werewolf/game-engine';

export const PERSISTED_MATCH_SCHEMA_VERSION = 1;
export const ENGINE_VERSION = '0.0.0';

export interface PersistedMatchEnvelope {
  configuration?: JsonObject;
  engineVersion: string;
  match: MatchState;
  runtime?: JsonObject;
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
  configuration?: JsonObject,
  runtime?: JsonObject,
): PersistedMatchEnvelope {
  return {
    ...(configuration ? { configuration: structuredClone(configuration) } : {}),
    engineVersion: ENGINE_VERSION,
    match,
    ...(runtime ? { runtime: structuredClone(runtime) } : {}),
    rulesetId: match.rulesetId,
    rulesetVersion: match.rulesetVersion,
    savedAt,
    schemaVersion: PERSISTED_MATCH_SCHEMA_VERSION,
  };
}
