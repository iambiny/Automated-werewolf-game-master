import { IDBKeyRange, indexedDB } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';

import { createPersistedMatchEnvelope } from '../../application/persistence/match-repository';
import { makeMatchState } from '../../application/test-fixtures';
import { IndexedDbMatchRepository } from './indexeddb-match-repository';

const repositories: Array<{
  name: string;
  repository: IndexedDbMatchRepository;
}> = [];

afterEach(async () => {
  for (const { name, repository } of repositories.splice(0)) {
    repository.close();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
});

function makeRepository(): IndexedDbMatchRepository {
  const name = `werewolf-test-${crypto.randomUUID()}`;
  const repository = new IndexedDbMatchRepository({
    databaseName: name,
    dexieOptions: { IDBKeyRange, indexedDB },
  });
  repositories.push({ name, repository });
  return repository;
}

describe('IndexedDbMatchRepository', () => {
  it('saves and reloads the newest active match', async () => {
    const repository = makeRepository();
    const older = createPersistedMatchEnvelope(makeMatchState(), 100);
    const newer = createPersistedMatchEnvelope(
      { ...makeMatchState(), id: 'match-2' },
      200,
    );

    await repository.save(older);
    await repository.save(newer);

    await expect(repository.getActive()).resolves.toEqual(newer);
  });

  it('does not return completed matches and supports deletion', async () => {
    const repository = makeRepository();
    const completed = createPersistedMatchEnvelope(
      { ...makeMatchState(), status: 'COMPLETED' },
      100,
    );
    await repository.save(completed);
    await expect(repository.getActive()).resolves.toBeNull();

    const active = createPersistedMatchEnvelope(makeMatchState(), 200);
    await repository.save(active);
    await repository.delete(active.match.id);
    await expect(repository.getActive()).resolves.toBeNull();
  });
});
