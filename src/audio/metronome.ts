/**
 * Metronome timing and audible count-in.
 *
 * Clicks are synthesized with Web Audio, so they add no assets and work
 * offline. The timing helpers take the clock as an argument, which keeps them
 * testable without an audio device.
 */

export const BEATS_PER_BAR = 4;

export interface BeatClockOptions {
  bpm: number;
  /** `performance.now()` value of beat 0. It may be in the future. */
  origin: number;
  onBeat: (index: number) => void;
  now?: () => number;
}

export interface Metronome {
  /** Creates and resumes the audio clock while the page still has user activation. */
  prepare(): void;
  /**
   * Plays `beats` audible clicks, accents the first one and resolves with the
   * `performance.now()` value of the following downbeat. The clicks are
   * scheduled before that downbeat so the recorder can start without them.
   */
  countIn(bpm: number, beats: number, signal: AbortSignal, onBeat?: (beat: number) => void): Promise<number>;
  dispose(): void;
}

export function beatPeriodMs(bpm: number): number {
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError('El tempo debe ser un número mayor que cero.');
  return 60_000 / bpm;
}

export function countInMilliseconds(bpm: number, beats: number = BEATS_PER_BAR): number {
  if (!Number.isInteger(beats) || beats < 1) throw new RangeError('El conteo necesita al menos un pulso entero.');
  return beatPeriodMs(bpm) * beats;
}

/** Calls `onBeat` once per beat index, computed from the clock to avoid drift. */
export function startBeatClock({ bpm, origin, onBeat, now = () => performance.now() }: BeatClockOptions): () => void {
  const period = beatPeriodMs(bpm);
  let last = -1;
  const tick = () => {
    const index = Math.floor((now() - origin) / period);
    if (index === last) return;
    last = index;
    if (index >= 0) onBeat(index);
  };
  tick();
  const timer = setInterval(tick, Math.max(16, Math.min(50, period / 8)));
  return () => clearInterval(timer);
}

/** Resolves at `target` on the given clock and rejects if the signal aborts. */
export function waitUntil(target: number, signal: AbortSignal, now: () => number = () => performance.now()): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Grabación cancelada.')); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', onAbort); };
    const onAbort = () => { cleanup(); reject(new Error('Grabación cancelada.')); };
    const check = () => {
      const remaining = target - now();
      if (remaining <= 1) { cleanup(); resolve(); return; }
      timer = setTimeout(check, Math.min(remaining, 1000));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    check();
  });
}

export function createMetronome(): Metronome {
  let context: AudioContext | undefined;
  let active: OscillatorNode[] = [];

  const audio = (): AudioContext => (context ??= new AudioContext());
  const silence = () => {
    for (const oscillator of active) {
      try { oscillator.stop(); } catch { /* already stopped */ }
    }
    active = [];
  };
  const click = (when: number, accent: boolean) => {
    const ctx = audio();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(accent ? 1568 : 1046, when);
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(accent ? 0.32 : 0.18, when + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(when);
    oscillator.stop(when + 0.06);
    oscillator.addEventListener('ended', () => {
      active = active.filter((node) => node !== oscillator);
      gain.disconnect();
    });
    active.push(oscillator);
  };

  return {
    prepare() {
      const ctx = audio();
      if (ctx.state === 'suspended') void ctx.resume();
    },
    async countIn(bpm, beats, signal, onBeat) {
      const ctx = audio();
      if (ctx.state === 'suspended') await ctx.resume();
      if (signal.aborted) throw new Error('Grabación cancelada.');
      const periodSeconds = beatPeriodMs(bpm) / 1000;
      const contextAtSchedule = ctx.currentTime;
      const performanceAtSchedule = performance.now();
      const first = contextAtSchedule + 0.15;
      for (let index = 0; index < beats; index += 1) click(first + index * periodSeconds, index === 0);
      const periodMs = periodSeconds * 1000;
      const firstBeat = performanceAtSchedule + (first - contextAtSchedule) * 1000;
      const downbeat = firstBeat + beats * periodMs;
      const stopClock = onBeat
        ? startBeatClock({ bpm, origin: firstBeat, onBeat: (index) => { if (index < beats) onBeat(index); } })
        : undefined;
      try {
        await waitUntil(downbeat, signal);
      } catch (error) {
        silence();
        throw error;
      } finally {
        stopClock?.();
      }
      return downbeat;
    },
    dispose() {
      silence();
      const closing = context;
      context = undefined;
      if (closing) void closing.close().catch(() => {});
    },
  };
}
