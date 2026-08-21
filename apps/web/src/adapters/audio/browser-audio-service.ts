export type AudioKey =
  | 'GAME_INTRO'
  | 'NIGHT_START'
  | 'ROLE_WAKE'
  | 'ROLE_SLEEP'
  | 'DAWN'
  | 'DISCUSSION_START'
  | 'VOTE_START'
  | 'GAME_OVER'
  | 'TEST_SOUND';

export interface AudioService {
  play(key: AudioKey): Promise<void>;
  preload(keys: AudioKey[]): Promise<void>;
  setEffectsVolume(value: number): void;
  setNarrationVolume(value: number): void;
  stopAll(): void;
  unlock(): Promise<void>;
}

const CUES: Record<AudioKey, readonly number[]> = {
  DAWN: [392, 523, 659],
  DISCUSSION_START: [440, 554],
  GAME_INTRO: [220, 330, 440],
  GAME_OVER: [523, 440, 349],
  NIGHT_START: [330, 247, 196],
  ROLE_SLEEP: [330, 247],
  ROLE_WAKE: [247, 330],
  TEST_SOUND: [440, 554, 659],
  VOTE_START: [392, 392, 523],
};

/** Offline-safe MVP cue pack. Every cue is synthesized locally after one unlock. */
export class BrowserAudioService implements AudioService {
  private context: AudioContext | null = null;
  private effectsVolume = 0.7;
  private narrationVolume = 0.85;
  private sources = new Set<OscillatorNode>();

  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    await this.play('TEST_SOUND');
  }

  async preload(keys: AudioKey[]): Promise<void> {
    // Cues are bundled as frequency data, so there is no network preload.
    keys.forEach((key) => CUES[key]);
    await Promise.resolve();
  }

  async play(key: AudioKey): Promise<void> {
    const context = this.context;
    if (!context || context.state !== 'running') {
      throw new Error('Audio has not been unlocked.');
    }
    const frequencies = CUES[key];
    const volume =
      key === 'TEST_SOUND' ? this.effectsVolume : this.narrationVolume;
    const startAt = context.currentTime;

    await new Promise<void>((resolve) => {
      let completed = 0;
      frequencies.forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        gain.gain.value = Math.max(0, Math.min(1, volume)) * 0.12;
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.addEventListener('ended', () => {
          this.sources.delete(oscillator);
          completed += 1;
          if (completed === frequencies.length) resolve();
        });
        this.sources.add(oscillator);
        oscillator.start(startAt + index * 0.14);
        oscillator.stop(startAt + index * 0.14 + 0.12);
      });
    });
  }

  stopAll(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // A source that has already ended is safe to ignore.
      }
    }
    this.sources.clear();
  }

  setNarrationVolume(value: number): void {
    this.narrationVolume = clampVolume(value);
  }

  setEffectsVolume(value: number): void {
    this.effectsVolume = clampVolume(value);
  }
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
