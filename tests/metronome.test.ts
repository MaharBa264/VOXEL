import { afterEach, describe, expect, it, vi } from 'vitest';
import { BEATS_PER_BAR, beatPeriodMs, countInMilliseconds, startBeatClock, waitUntil } from '../src/audio/metronome';

afterEach(() => vi.useRealTimers());

describe('tiempo del metrónomo', () => {
  it('deriva el pulso del BPM y el compás del conteo', () => {
    expect(beatPeriodMs(120)).toBe(500);
    expect(beatPeriodMs(60)).toBe(1000);
    expect(countInMilliseconds(120, BEATS_PER_BAR)).toBe(2000);
    expect(countInMilliseconds(240, 2)).toBe(500);
  });

  it('rechaza tempos y conteos inválidos', () => {
    expect(() => beatPeriodMs(0)).toThrow(RangeError);
    expect(() => beatPeriodMs(-120)).toThrow(RangeError);
    expect(() => beatPeriodMs(Number.NaN)).toThrow(RangeError);
    expect(() => countInMilliseconds(120, 0)).toThrow(RangeError);
    expect(() => countInMilliseconds(120, 2.5)).toThrow(RangeError);
  });
});

describe('reloj de pulsos', () => {
  it('avisa una sola vez por pulso y no repite al retrasarse el reloj', () => {
    vi.useFakeTimers();
    let now = 0;
    const beats: number[] = [];
    const stop = startBeatClock({ bpm: 120, timeSignature: { numerator: 4, denominator: 4 }, origin: 0, now: () => now, onBeat: (index) => beats.push(index) });
    expect(beats).toEqual([0]);

    now = 520;
    vi.advanceTimersByTime(60);
    expect(beats).toEqual([0, 1]);

    now = 1600;
    vi.advanceTimersByTime(60);
    expect(beats).toEqual([0, 1, 3]);

    stop();
    now = 5000;
    vi.advanceTimersByTime(500);
    expect(beats).toEqual([0, 1, 3]);
  });

  it('no avisa antes del primer pulso cuando el origen está en el futuro', () => {
    vi.useFakeTimers();
    let now = 0;
    const beats: number[] = [];
    startBeatClock({ bpm: 60, timeSignature: { numerator: 4, denominator: 4 }, origin: 1000, now: () => now, onBeat: (index) => beats.push(index) });
    vi.advanceTimersByTime(900);
    expect(beats).toEqual([]);
    now = 1000;
    vi.advanceTimersByTime(60);
    expect(beats).toEqual([0]);
  });

  it('usa el pulso del denominador y reinicia el acento según el numerador', () => {
    vi.useFakeTimers();
    let now = 0;
    const beats: number[] = [];
    const stop = startBeatClock({
      bpm: 120, timeSignature: { numerator: 6, denominator: 8 }, origin: 0,
      now: () => now, onBeat: (index) => beats.push(index),
    });
    expect(beats).toEqual([0]);
    now = 260;
    vi.advanceTimersByTime(60);
    expect(beats).toEqual([0, 1]);
    now = 1500;
    vi.advanceTimersByTime(60);
    expect(beats).toEqual([0, 1, 0]);
    stop();
  });
});

describe('espera hasta el pulso', () => {
  it('resuelve cuando el reloj alcanza el objetivo', async () => {
    vi.useFakeTimers();
    let now = 0;
    const waiting = waitUntil(100, new AbortController().signal, () => now);
    now = 100;
    await vi.advanceTimersByTimeAsync(100);
    await expect(waiting).resolves.toBeUndefined();
  });

  it('rechaza al cancelar y libera el temporizador', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const waiting = waitUntil(1000, controller.signal, () => 0);
    const assertion = expect(waiting).rejects.toThrow('cancelada');
    controller.abort();
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});
