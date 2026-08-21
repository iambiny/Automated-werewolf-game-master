export interface DeadlineTimerSnapshot {
  deadlineAt: number;
  paused: boolean;
  phaseId: string;
  remainingMs: number;
}

export function createDeadlineTimer(
  phaseId: string,
  durationMs: number,
  now = Date.now(),
): DeadlineTimerSnapshot {
  return {
    deadlineAt: now + durationMs,
    paused: false,
    phaseId,
    remainingMs: durationMs,
  };
}

export function getRemainingMs(
  timer: DeadlineTimerSnapshot,
  now = Date.now(),
): number {
  return timer.paused ? timer.remainingMs : Math.max(0, timer.deadlineAt - now);
}

export function pauseDeadlineTimer(
  timer: DeadlineTimerSnapshot,
  now = Date.now(),
): DeadlineTimerSnapshot {
  const remainingMs = getRemainingMs(timer, now);
  return { ...timer, paused: true, remainingMs };
}

export function resumeDeadlineTimer(
  timer: DeadlineTimerSnapshot,
  now = Date.now(),
): DeadlineTimerSnapshot {
  return {
    ...timer,
    deadlineAt: now + timer.remainingMs,
    paused: false,
  };
}

export function extendDeadlineTimer(
  timer: DeadlineTimerSnapshot,
  durationMs: number,
): DeadlineTimerSnapshot {
  return timer.paused
    ? { ...timer, remainingMs: timer.remainingMs + durationMs }
    : {
        ...timer,
        deadlineAt: timer.deadlineAt + durationMs,
        remainingMs: timer.remainingMs + durationMs,
      };
}

export function parseDeadlineTimer(
  value: unknown,
): DeadlineTimerSnapshot | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.phaseId !== 'string' ||
    typeof value.deadlineAt !== 'number' ||
    !Number.isFinite(value.deadlineAt) ||
    typeof value.paused !== 'boolean' ||
    typeof value.remainingMs !== 'number' ||
    !Number.isFinite(value.remainingMs) ||
    value.remainingMs < 0
  ) {
    return null;
  }
  return {
    deadlineAt: value.deadlineAt,
    paused: value.paused,
    phaseId: value.phaseId,
    remainingMs: value.remainingMs,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
