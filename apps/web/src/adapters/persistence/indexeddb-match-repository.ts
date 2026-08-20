import Dexie, { type DexieOptions, type EntityTable } from 'dexie';

import type {
  MatchRepository,
  PersistedMatchEnvelope,
} from '../../application/persistence/match-repository';
import type { MatchId, MatchStatus } from '@werewolf/game-engine';

interface MatchRecord {
  envelope: PersistedMatchEnvelope;
  id: MatchId;
  savedAt: number;
  status: MatchStatus;
}

interface PlaceholderRecord {
  id: string;
}

class WerewolfDatabase extends Dexie {
  deckPresets!: EntityTable<PlaceholderRecord, 'id'>;
  matches!: EntityTable<MatchRecord, 'id'>;
  settings!: EntityTable<PlaceholderRecord, 'id'>;

  constructor(name: string, options?: DexieOptions) {
    super(name, options);
    this.version(1).stores({
      deckPresets: '&id',
      matches: '&id,status,savedAt',
      settings: '&id',
    });
  }
}

export interface IndexedDbMatchRepositoryOptions {
  databaseName?: string;
  dexieOptions?: DexieOptions;
}

export class IndexedDbMatchRepository implements MatchRepository {
  private readonly database: WerewolfDatabase;

  constructor(options: IndexedDbMatchRepositoryOptions = {}) {
    this.database = new WerewolfDatabase(
      options.databaseName ?? 'werewolf-game-master',
      options.dexieOptions,
    );
  }

  async save(envelope: PersistedMatchEnvelope): Promise<void> {
    await this.database.matches.put({
      envelope,
      id: envelope.match.id,
      savedAt: envelope.savedAt,
      status: envelope.match.status,
    });
  }

  async getActive(): Promise<PersistedMatchEnvelope | null> {
    const records = await this.database.matches
      .where('status')
      .anyOf('SETUP', 'ACTIVE')
      .toArray();
    const newest = records.sort(
      (left, right) => right.savedAt - left.savedAt,
    )[0];

    return newest?.envelope ?? null;
  }

  async delete(id: MatchId): Promise<void> {
    await this.database.matches.delete(id);
  }

  close(): void {
    this.database.close();
  }
}
