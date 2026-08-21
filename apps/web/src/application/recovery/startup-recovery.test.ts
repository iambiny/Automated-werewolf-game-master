import { describe, expect, it, vi } from 'vitest';

import type { RecoveryResult } from './recovery-coordinator';
import { loadRecoveryWithTimeout } from './startup-recovery';

describe('loadRecoveryWithTimeout', () => {
  it('returns a completed recovery result', async () => {
    const result: RecoveryResult = { status: 'NONE' };

    await expect(
      loadRecoveryWithTimeout(() => Promise.resolve(result), 100),
    ).resolves.toBe(result);
  });

  it('stops waiting when browser storage never responds', async () => {
    vi.useFakeTimers();
    const recovery = loadRecoveryWithTimeout(
      () => new Promise<RecoveryResult>(() => undefined),
      100,
    );

    await vi.advanceTimersByTimeAsync(100);

    await expect(recovery).resolves.toMatchObject({
      status: 'TIMEOUT',
    });
    vi.useRealTimers();
  });
});
