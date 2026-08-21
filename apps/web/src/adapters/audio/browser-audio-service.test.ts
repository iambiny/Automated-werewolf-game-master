// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BrowserAudioService } from './browser-audio-service';

class FakeOscillator extends EventTarget {
  frequency = { value: 0 };
  type: OscillatorType = 'sine';
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.dispatchEvent(new Event('ended')));
}

class FakeAudioContext {
  static oscillators: FakeOscillator[] = [];
  currentTime = 0;
  destination = {} as AudioDestinationNode;
  state: AudioContextState = 'running';
  createGain() {
    return { connect: vi.fn(), gain: { value: 0 } } as unknown as GainNode;
  }
  createOscillator() {
    const oscillator = new FakeOscillator();
    FakeAudioContext.oscillators.push(oscillator);
    return oscillator as unknown as OscillatorNode;
  }
  resume = vi.fn(async () => undefined);
}

describe('BrowserAudioService', () => {
  beforeEach(() => {
    FakeAudioContext.oscillators = [];
    vi.stubGlobal('AudioContext', FakeAudioContext);
  });

  it('unlocks once and completes bundled offline cues', async () => {
    const service = new BrowserAudioService();

    await expect(service.unlock()).resolves.toBeUndefined();
    await expect(service.play('DAWN')).resolves.toBeUndefined();

    expect(FakeAudioContext.oscillators).toHaveLength(6);
    expect(
      FakeAudioContext.oscillators.every(
        (item) => item.start.mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it('falls back cleanly before browser audio is unlocked', async () => {
    await expect(new BrowserAudioService().play('DAWN')).rejects.toThrow(
      'Audio has not been unlocked',
    );
  });
});
