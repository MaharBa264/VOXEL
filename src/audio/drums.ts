import type { MidiNote } from '../domain/project';
import { ticksToSeconds } from './midi';

/** Onsets ready to be scheduled on a local audio clock. */
export interface DrumHit {
  time: number;
  pitch: number;
  velocity: number;
}

export function drumHits(notes: readonly MidiNote[], ppq: number, tempoBpm: number): DrumHit[] {
  return notes.map((note) => ({
    time: ticksToSeconds(note.startTick, ppq, tempoBpm),
    pitch: note.pitch,
    velocity: note.velocity / 127,
  })).sort((a, b) => a.time - b.time || a.pitch - b.pitch);
}

/**
 * Synthesized drum kit: oscillators and filtered noise only. No samples,
 * downloads or network access; everything is generated in the local context.
 */
export class DrumPlayer {
  private context: AudioContext | undefined;
  private noiseBuffer: AudioBuffer | undefined;
  private voices: AudioScheduledSourceNode[] = [];

  stop() {
    for (const voice of this.voices) {
      try { voice.stop(); } catch { /* already stopped */ }
    }
    this.voices = [];
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = undefined;
    this.noiseBuffer = undefined;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  private track(voice: AudioScheduledSourceNode) {
    this.voices.push(voice);
    voice.addEventListener('ended', () => {
      this.voices = this.voices.filter((item) => item !== voice);
    }, { once: true });
  }

  private oscillator(ctx: AudioContext, when: number, from: number, to: number,
    duration: number, gain: number, type: OscillatorType = 'sine') {
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, when);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), when + duration);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(gain, when + 0.004);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(envelope).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.01);
    this.track(osc);
  }

  private noise(ctx: AudioContext, when: number, duration: number, gain: number,
    filter: BiquadFilterType, frequency: number) {
    if (!this.noiseBuffer) {
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x9e3779b9;
      for (let index = 0; index < data.length; index += 1) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[index] = seed / 0xffffffff * 2 - 1;
      }
      this.noiseBuffer = buffer;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = filter;
    band.frequency.setValueAtTime(frequency, when);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.linearRampToValueAtTime(gain, when + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(band).connect(envelope).connect(ctx.destination);
    source.start(when);
    source.stop(when + duration + 0.01);
    this.track(source);
  }

  private strike(ctx: AudioContext, when: number, pitch: number, velocity: number) {
    const level = Math.max(0.05, Math.min(1, velocity));
    switch (pitch) {
      case 35:
      case 36:
        this.oscillator(ctx, when, 160, 48, 0.26, level * 0.9);
        break;
      case 38:
      case 40:
        this.noise(ctx, when, 0.16, level * 0.5, 'highpass', 1200);
        this.oscillator(ctx, when, 190, 120, 0.11, level * 0.35);
        break;
      case 39:
        for (let tap = 0; tap < 3; tap += 1) {
          this.noise(ctx, when + tap * 0.012, 0.035, level * 0.35, 'bandpass', 1400);
        }
        break;
      case 41:
        this.oscillator(ctx, when, 110, 60, 0.34, level * 0.7);
        break;
      case 43:
        this.oscillator(ctx, when, 140, 80, 0.30, level * 0.7);
        break;
      case 45:
        this.oscillator(ctx, when, 180, 110, 0.26, level * 0.7);
        break;
      case 42:
        this.noise(ctx, when, 0.055, level * 0.35, 'highpass', 7000);
        break;
      case 46:
        this.noise(ctx, when, 0.32, level * 0.3, 'highpass', 6000);
        break;
      case 49:
        this.noise(ctx, when, 0.85, level * 0.4, 'highpass', 5000);
        break;
      case 51:
        this.noise(ctx, when, 0.55, level * 0.3, 'highpass', 4000);
        this.oscillator(ctx, when, 900, 700, 0.35, level * 0.08, 'triangle');
        break;
      default:
        this.noise(ctx, when, 0.12, level * 0.4, 'bandpass', 1200);
    }
  }

  /** Schedules all hits and resolves with the audio-clock time of the last one. */
  async play(notes: readonly MidiNote[], ppq: number, tempoBpm: number): Promise<number> {
    const ctx = this.context ??= new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    this.stop();
    const start = ctx.currentTime + 0.1;
    const hits = drumHits(notes, ppq, tempoBpm);
    for (const hit of hits) this.strike(ctx, start + hit.time, hit.pitch, hit.velocity);
    return start + (hits.at(-1)?.time ?? 0) + 1;
  }
}
