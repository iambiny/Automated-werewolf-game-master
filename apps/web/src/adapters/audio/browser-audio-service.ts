export type NarrationKey =
  | 'DAWN'
  | 'DISCUSSION_START'
  | 'GAME_OVER'
  | 'HUNTER_ACTION'
  | 'MAYOR_VOTE_START'
  | 'NIGHT_START'
  | 'TEST_SOUND'
  | 'VOTE_START';

export type NightRoleId =
  'DEMON_WOLF' | 'GUARD' | 'SEER' | 'WEREWOLF' | 'WITCH';
export type RoleNarrationStage = 'ACTION' | 'SLEEP' | 'WAKE';
export type EffectKey =
  | 'DEMON_CURSE'
  | 'GUARD_SHIELD'
  | 'HUNTER_SHOT'
  | 'SEER_VISION'
  | 'WEREWOLF_BITE'
  | 'WITCH_HEAL'
  | 'WITCH_POISON';
export type MusicKey = 'DAY' | 'NIGHT' | 'VOTE';
export type AudioLocale = 'en' | 'vi';

export type AudioCue =
  | { key: NarrationKey; kind: 'NARRATION'; locale: AudioLocale }
  | {
      kind: 'ROLE_NARRATION';
      locale: AudioLocale;
      roleId: NightRoleId;
      stage: RoleNarrationStage;
    }
  | { key: EffectKey; kind: 'EFFECT' };

export interface AudioService {
  play(cue: AudioCue): Promise<void>;
  playInterfaceBeep(): Promise<void>;
  preload(cues: AudioCue[]): Promise<void>;
  setBackgroundMusic(key: MusicKey | null): Promise<void>;
  setEffectsVolume(value: number): void;
  setMusicVolume(value: number): void;
  setNarrationVolume(value: number): void;
  stopAll(): void;
  unlock(): Promise<void>;
}

const PHASE_FILES: Record<NarrationKey, string> = {
  DAWN: 'dawn',
  DISCUSSION_START: 'discussion',
  GAME_OVER: 'game_over',
  HUNTER_ACTION: 'hunter_action',
  MAYOR_VOTE_START: 'mayor_vote',
  NIGHT_START: 'night_start',
  TEST_SOUND: 'test',
  VOTE_START: 'vote',
};
const EFFECT_FILES: Record<EffectKey, string> = {
  DEMON_CURSE: 'demon_curse',
  GUARD_SHIELD: 'guard_shield',
  HUNTER_SHOT: 'hunter_shot',
  SEER_VISION: 'seer_vision',
  WEREWOLF_BITE: 'werewolf_bite',
  WITCH_HEAL: 'witch_heal',
  WITCH_POISON: 'witch_poison',
};

/** Offline-first audio pack with separate narration, effects, music, and UI channels. */
export class BrowserAudioService implements AudioService {
  private context: AudioContext | null = null;
  private currentMusic: HTMLAudioElement | null = null;
  private currentMusicKey: MusicKey | null = null;
  private effectsVolume = 0.7;
  private musicVolume = 0.38;
  private narration: HTMLAudioElement | null = null;
  private narrationVolume = 0.85;
  private playing = new Set<HTMLAudioElement>();
  private preloaded = new Map<string, string>();
  private sources = new Set<OscillatorNode>();

  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
    await this.playInterfaceBeep();
  }

  async preload(cues: AudioCue[]): Promise<void> {
    const paths = [
      ...cues.map(audioPath),
      ...(['DAY', 'NIGHT', 'VOTE'] as const).map(musicPath),
    ];
    await Promise.all(
      [...new Set(paths)].map(async (path) => {
        if (this.preloaded.has(path)) return;
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Audio asset failed: ${path}`);
        const blob = await response.blob();
        this.preloaded.set(path, URL.createObjectURL(blob));
      }),
    );
  }

  async play(cue: AudioCue): Promise<void> {
    this.assertUnlocked();
    const path = audioPath(cue);
    const element = new Audio(this.preloaded.get(path) ?? path);
    if (cue.kind !== 'EFFECT') {
      this.narration?.pause();
      this.narration = element;
    }
    element.volume =
      cue.kind === 'EFFECT' ? this.effectsVolume : this.narrationVolume;
    this.playing.add(element);
    await playToCompletion(element, () => {
      this.playing.delete(element);
      if (this.narration === element) this.narration = null;
    });
  }

  async playInterfaceBeep(): Promise<void> {
    const context = this.context;
    if (!context || context.state !== 'running') {
      throw new Error('Audio has not been unlocked.');
    }
    await new Promise<void>((resolve) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 520;
      oscillator.type = 'sine';
      gain.gain.value = this.effectsVolume * 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.addEventListener('ended', () => {
        this.sources.delete(oscillator);
        resolve();
      });
      this.sources.add(oscillator);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.055);
    });
  }

  async setBackgroundMusic(key: MusicKey | null): Promise<void> {
    if (key === this.currentMusicKey) return;
    this.stopMusic();
    this.currentMusicKey = key;
    if (!key || !this.context || this.context.state !== 'running') return;
    const path = musicPath(key);
    const music = new Audio(this.preloaded.get(path) ?? path);
    music.loop = true;
    music.volume = this.musicVolume;
    this.currentMusic = music;
    try {
      await music.play();
    } catch {
      this.currentMusic = null;
      this.currentMusicKey = null;
      throw new Error('Background music could not start.');
    }
  }

  stopAll(): void {
    for (const element of this.playing) {
      element.pause();
      element.currentTime = 0;
    }
    this.playing.clear();
    this.narration = null;
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // A source that has already ended is safe to ignore.
      }
    }
    this.sources.clear();
    this.stopMusic();
  }

  setNarrationVolume(value: number): void {
    this.narrationVolume = clampVolume(value);
  }
  setEffectsVolume(value: number): void {
    this.effectsVolume = clampVolume(value);
  }
  setMusicVolume(value: number): void {
    this.musicVolume = clampVolume(value);
    if (this.currentMusic) this.currentMusic.volume = this.musicVolume;
  }

  private assertUnlocked() {
    if (!this.context || this.context.state !== 'running') {
      throw new Error('Audio has not been unlocked.');
    }
  }
  private stopMusic() {
    this.currentMusic?.pause();
    if (this.currentMusic) this.currentMusic.currentTime = 0;
    this.currentMusic = null;
    this.currentMusicKey = null;
  }
}

export function roleNarrationCues(
  locale: AudioLocale,
  roleIds: readonly NightRoleId[],
): AudioCue[] {
  return roleIds.flatMap((roleId) =>
    (['WAKE', 'ACTION', 'SLEEP'] as const).map((stage) => ({
      kind: 'ROLE_NARRATION' as const,
      locale,
      roleId,
      stage,
    })),
  );
}

function audioPath(cue: AudioCue): string {
  if (cue.kind === 'EFFECT') {
    return `/audio/effects/${EFFECT_FILES[cue.key]}.wav`;
  }
  if (cue.kind === 'ROLE_NARRATION') {
    const extension = cue.locale === 'vi' ? 'wav' : 'mp3';
    return `/audio/voice/${cue.locale}/${cue.roleId.toLowerCase()}-${cue.stage.toLowerCase()}.${extension}`;
  }
  const extension = cue.locale === 'vi' ? 'wav' : 'mp3';
  return `/audio/voice/${cue.locale}/${PHASE_FILES[cue.key]}.${extension}`;
}

function musicPath(key: MusicKey): string {
  return `/audio/music/${key.toLowerCase()}.wav`;
}

function playToCompletion(
  element: HTMLAudioElement,
  finish: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const complete = () => {
      if (settled) return;
      settled = true;
      finish();
      resolve();
    };
    element.addEventListener('ended', complete, { once: true });
    element.addEventListener('pause', complete, { once: true });
    element.addEventListener(
      'error',
      () => {
        if (settled) return;
        settled = true;
        finish();
        reject(new Error('Audio playback failed.'));
      },
      { once: true },
    );
    void element.play().catch((error: unknown) => {
      if (settled) return;
      if (isPlaybackInterruption(error)) {
        complete();
        return;
      }
      settled = true;
      finish();
      reject(
        error instanceof Error ? error : new Error('Audio playback failed.'),
      );
    });
  });
}

function isPlaybackInterruption(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, value));
}
