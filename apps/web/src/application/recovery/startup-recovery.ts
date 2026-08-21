import type { RecoveryResult } from './recovery-coordinator';

const DEFAULT_RECOVERY_TIMEOUT_MS = 5_000;

export type StartupRecoveryResult =
  RecoveryResult | { message: string; status: 'TIMEOUT' };

export async function loadRecoveryWithTimeout(
  load: () => Promise<RecoveryResult>,
  timeoutMs = DEFAULT_RECOVERY_TIMEOUT_MS,
): Promise<StartupRecoveryResult> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<StartupRecoveryResult>((resolve) => {
    timeoutId = setTimeout(() => {
      resolve({
        message:
          'The saved match could not be checked. You can still start a new game.',
        status: 'TIMEOUT',
      });
    }, timeoutMs);
  });

  try {
    return await Promise.race([load(), timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
