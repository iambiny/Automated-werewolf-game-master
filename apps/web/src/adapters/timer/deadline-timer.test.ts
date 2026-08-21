import { describe, expect, it } from 'vitest';

import {
  createDeadlineTimer,
  extendDeadlineTimer,
  getRemainingMs,
  parseDeadlineTimer,
  pauseDeadlineTimer,
  resumeDeadlineTimer,
} from './deadline-timer';

describe('deadline timer', () => {
  it('derives remaining time from an absolute deadline', () => {
    const timer = createDeadlineTimer('discussion-1', 60_000, 1000);
    expect(getRemainingMs(timer, 21_000)).toBe(40_000);
    expect(getRemainingMs(timer, 70_000)).toBe(0);
  });

  it('persists pause, resume, and extension semantics', () => {
    const timer = createDeadlineTimer('discussion-1', 60_000, 1000);
    const paused = pauseDeadlineTimer(timer, 11_000);
    expect(getRemainingMs(paused, 99_000)).toBe(50_000);

    const extended = extendDeadlineTimer(paused, 30_000);
    const resumed = resumeDeadlineTimer(extended, 20_000);
    expect(resumed.deadlineAt).toBe(100_000);
    expect(getRemainingMs(resumed, 30_000)).toBe(70_000);
    expect(parseDeadlineTimer(resumed)).toEqual(resumed);
  });

  it('rejects malformed recovery data', () => {
    expect(parseDeadlineTimer({ deadlineAt: 'soon' })).toBeNull();
  });
});
