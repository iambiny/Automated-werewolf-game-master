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

class FakeAudio extends EventTarget {
  static enforcePerElementAuthorization = false;
  static holdNextPlay = false;
  static instances: FakeAudio[] = [];
  static userActivation = false;
  private source = '';
  private authorized = false;
  currentTime = 0;
  loop = false;
  preload = '';
  private rejectPendingPlay: ((reason?: unknown) => void) | null = null;
  pause = vi.fn(() => {
    if (!this.rejectPendingPlay) return;
    const interruption = new Error('Playback was interrupted.');
    interruption.name = 'AbortError';
    this.rejectPendingPlay(interruption);
    this.rejectPendingPlay = null;
  });
  play = vi.fn(() => {
    if (
      FakeAudio.enforcePerElementAuthorization &&
      !this.authorized &&
      !FakeAudio.userActivation
    ) {
      const rejection = new Error('Playback requires user activation.');
      rejection.name = 'NotAllowedError';
      return Promise.reject(rejection);
    }
    if (FakeAudio.userActivation) this.authorized = true;
    if (FakeAudio.holdNextPlay) {
      FakeAudio.holdNextPlay = false;
      return new Promise<void>((_resolve, reject) => {
        this.rejectPendingPlay = reject;
      });
    }
    return Promise.resolve().then(() => {
      this.dispatchEvent(new Event('ended'));
    });
  });
  srcHistory: string[] = [];
  volume = 1;

  constructor(src: string) {
    super();
    this.src = src;
    FakeAudio.instances.push(this);
  }

  get src() {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    this.srcHistory.push(value);
  }
}

describe('BrowserAudioService', () => {
  beforeEach(() => {
    FakeAudio.enforcePerElementAuthorization = false;
    FakeAudio.holdNextPlay = false;
    FakeAudioContext.oscillators = [];
    FakeAudio.instances = [];
    FakeAudio.userActivation = false;
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('Audio', FakeAudio);
  });

  it('keeps a short synthesized beep for interface feedback', async () => {
    const service = new BrowserAudioService();

    await expect(service.unlock()).resolves.toBeUndefined();
    await expect(service.playInterfaceBeep()).resolves.toBeUndefined();

    expect(FakeAudioContext.oscillators).toHaveLength(2);
    expect(
      FakeAudioContext.oscillators.every(
        (item) => item.start.mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it('plays role narration and effects from the local audio pack', async () => {
    const service = new BrowserAudioService();
    await service.unlock();

    await service.play({
      kind: 'ROLE_NARRATION',
      locale: 'vi',
      roleId: 'SEER',
      stage: 'ACTION',
    });
    await service.play({ key: 'SEER_VISION', kind: 'EFFECT' });

    expect(FakeAudio.instances).toHaveLength(3);
    expect(FakeAudio.instances[0]?.src).toBe('/audio/voice/vi/seer-action.wav');
    expect(FakeAudio.instances[1]?.src).toBe('/audio/effects/seer_vision.wav');
  });

  it('uses distinct narration for mayor and execution voting', async () => {
    const service = new BrowserAudioService();
    await service.unlock();

    await service.play({
      key: 'MAYOR_VOTE_START',
      kind: 'NARRATION',
      locale: 'vi',
    });
    await service.play({ key: 'VOTE_START', kind: 'NARRATION', locale: 'vi' });

    expect(FakeAudio.instances[0]?.srcHistory.slice(-2)).toEqual([
      '/audio/voice/vi/mayor_vote.wav',
      '/audio/voice/vi/vote.wav',
    ]);
  });

  it('uses the documented MP3 format for English phase narration', async () => {
    const service = new BrowserAudioService();
    await service.unlock();

    await service.play({
      key: 'HUNTER_ACTION',
      kind: 'NARRATION',
      locale: 'en',
    });

    expect(FakeAudio.instances[0]?.src).toBe(
      '/audio/voice/en/hunter_action.mp3',
    );
  });

  it('does not fail when a new cue interrupts narration that is still starting', async () => {
    const service = new BrowserAudioService();
    await service.unlock();
    FakeAudio.holdNextPlay = true;

    const interrupted = service.play({
      key: 'NIGHT_START',
      kind: 'NARRATION',
      locale: 'en',
    });
    await vi.waitFor(() =>
      expect(FakeAudio.instances[0]?.play).toHaveBeenCalledTimes(2),
    );

    await expect(
      service.play({
        kind: 'ROLE_NARRATION',
        locale: 'en',
        roleId: 'SEER',
        stage: 'WAKE',
      }),
    ).resolves.toBeUndefined();
    await expect(interrupted).resolves.toBeUndefined();
  });

  it('does not fail when a music change interrupts a pending music start', async () => {
    const service = new BrowserAudioService();
    await service.unlock();
    FakeAudio.holdNextPlay = true;

    const interrupted = service.setBackgroundMusic('NIGHT');
    await vi.waitFor(() =>
      expect(FakeAudio.instances[2]?.play).toHaveBeenCalledTimes(2),
    );

    await expect(service.setBackgroundMusic('DAY')).resolves.toBeUndefined();
    await expect(interrupted).resolves.toBeUndefined();
    expect(FakeAudio.instances[2]?.src).toBe('/audio/music/day.wav');
  });

  it('reuses the media elements authorized by the unlock gesture', async () => {
    const service = new BrowserAudioService();
    FakeAudio.enforcePerElementAuthorization = true;
    FakeAudio.userActivation = true;
    const unlock = service.unlock();
    FakeAudio.userActivation = false;
    await expect(unlock).resolves.toBeUndefined();
    const authorizedChannels = [...FakeAudio.instances];

    await service.play({
      key: 'NIGHT_START',
      kind: 'NARRATION',
      locale: 'en',
    });
    await service.play({ key: 'SEER_VISION', kind: 'EFFECT' });
    await service.setBackgroundMusic('NIGHT');

    expect(FakeAudio.instances).toEqual(authorizedChannels);
    expect(FakeAudio.instances).toHaveLength(3);
    expect(FakeAudio.instances[2]?.src).toBe('/audio/music/night.wav');
  });

  it('falls back cleanly before browser audio is unlocked', async () => {
    await expect(
      new BrowserAudioService().play({
        key: 'DAWN',
        kind: 'NARRATION',
        locale: 'en',
      }),
    ).rejects.toThrow('Audio has not been unlocked');
  });
});
