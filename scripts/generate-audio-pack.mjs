import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(root, 'apps', 'web', 'public', 'audio');
const sine = (frequency, time, phase = 0) =>
  Math.sin(2 * Math.PI * frequency * time + phase);
const smooth = (value) => value * value * (3 - 2 * value);
const envelope = (time, duration, attack = 0.04, release = 0.2) =>
  Math.min(1, time / attack, (duration - time) / release);

function seededNoise(time, seed = 1) {
  const value =
    Math.sin((Math.floor(time * 22050) + seed) * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function writeWave(file, seconds, sample) {
  const sampleRate = 22050;
  const sampleCount = Math.floor(seconds * sampleRate);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const value = Math.max(
      -1,
      Math.min(1, sample(index / sampleRate, seconds)),
    );
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buffer);
}

const effects = {
  demon_curse: [
    1.6,
    (t, d) =>
      envelope(t, d) * (sine(95 - t * 28, t) * 0.32 + sine(190, t) * 0.08),
  ],
  guard_shield: [
    1.2,
    (t, d) =>
      envelope(t, d) * (sine(440 + t * 180, t) * 0.2 + sine(880, t) * 0.08),
  ],
  hunter_shot: [
    1.4,
    (t) =>
      t < 0.08
        ? seededNoise(t) * (1 - t / 0.08) * 0.72
        : seededNoise(t, 8) * Math.exp(-4.5 * t) * 0.2,
  ],
  seer_vision: [
    1.8,
    (t, d) =>
      envelope(t, d) *
      (sine(330 + t * 260, t) * 0.18 + sine(660 + t * 140, t) * 0.1),
  ],
  werewolf_bite: [
    1.25,
    (t, d) =>
      envelope(t, d, 0.01, 0.4) *
      (seededNoise(t, 4) * Math.exp(-3 * t) * 0.3 + sine(72, t) * 0.3),
  ],
  witch_heal: [
    1.5,
    (t, d) =>
      envelope(t, d) *
      (sine(392 + t * 110, t) * 0.17 + sine(523 + t * 70, t) * 0.12),
  ],
  witch_poison: [
    1.5,
    (t, d) =>
      envelope(t, d) *
      (sine(155 - t * 25, t) * 0.22 + seededNoise(t, 12) * 0.035),
  ],
};

for (const [name, [duration, sample]] of Object.entries(effects)) {
  writeWave(join(outputRoot, 'effects', `${name}.wav`), duration, sample);
}

const duration = 12;
const tracks = {
  day: (t) =>
    (0.7 + 0.3 * sine(1 / 6, t)) *
    (sine(196, t) * 0.055 + sine(247, t) * 0.04 + sine(294, t) * 0.03),
  night: (t) =>
    sine(82 + sine(1 / 12, t) * 3, t) * 0.075 +
    sine(123, t) * 0.035 +
    seededNoise(t, 20) * 0.008,
  vote: (t) => {
    const beat = t % 1.5;
    const drum =
      beat < 0.18
        ? sine(68 - beat * 80, beat) * Math.exp(-18 * beat) * 0.22
        : 0;
    return drum + sine(110, t) * 0.045 + sine(165, t) * 0.025;
  },
};

for (const [name, track] of Object.entries(tracks)) {
  writeWave(join(outputRoot, 'music', `${name}.wav`), duration, (time) => {
    const edge = Math.min(1, smooth(Math.min(time, duration - time) / 0.08));
    return track(time) * edge;
  });
}
