import { describe, expect, it } from 'vitest';
import { encodeMonoWav } from '../src/audio/wav';
import { encodeMidi, ticksToSeconds } from '../src/audio/midi';
import { pianoEvents } from '../src/audio/piano';

describe('WAV para análisis', () => {
  it('escribe cabecera PCM16 mono y promedia canales antes de limitar amplitud', () => {
    const wav = encodeMonoWav([new Float32Array([1, -1, 4]), new Float32Array([0, -1, 2])], 48000);
    const view = new DataView(wav);
    expect(new TextDecoder().decode(wav.slice(0, 4))).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(42);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(48000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getInt16(44, true)).toBe(16384);
    expect(view.getInt16(46, true)).toBe(-32768);
    expect(view.getInt16(48, true)).toBe(32767);
  });
  it('limita el derivado a 30 segundos y rechaza datos inválidos', () => {
    expect(encodeMonoWav([new Float32Array(310)], 10).byteLength).toBe(644);
    expect(() => encodeMonoWav([], 48000)).toThrow();
    expect(() => encodeMonoWav([new Float32Array([NaN])], 48000)).toThrow();
  });
});

describe('secuencia PPQ y exportación MIDI', () => {
  it('programa ataques y finales separados para poder cancelar voces y eventos futuros', () => {
    expect(pianoEvents([{ id: 'a', pitch: 69, velocity: 64, startTick: 240, durationTicks: 480 }], 480, 120)).toEqual([
      [0.25, { pitch: 69, velocity: 64 / 127, attack: true }],
      [0.75, { pitch: 69, velocity: 0, attack: false }],
    ]);
  });
  it('convierte ticks sin cuantizar las notas a intervalos del reloj de UI', () => {
    expect(ticksToSeconds(720, 480, 120)).toBe(0.75);
    expect(ticksToSeconds(1, 480, 60)).toBeCloseTo(1 / 480);
  });
  it('exporta tempo y una nota con duración VLQ exacta en formato SMF 0', () => {
    const bytes = encodeMidi([{ id: 'n1', pitch: 69, velocity: 100, startTick: 0, durationTicks: 480 }], 480, 120, { numerator: 4, denominator: 4 });
    expect(Array.from(bytes.slice(0, 14))).toEqual([77,84,104,100,0,0,0,6,0,0,0,1,1,224]);
    expect(Array.from(bytes.slice(22))).toEqual([
      0,255,81,3,7,161,32, 0,255,88,4,4,2,24,8,
      0,192,0, 0,144,69,100, 131,96,128,69,0, 0,255,47,0,
    ]);
    expect(new DataView(bytes.buffer).getUint32(18)).toBe(bytes.length - 22);
  });
  it('exporta el compás pedido en lugar del 4/4 fijo', () => {
    const bytes = encodeMidi([{ id: 'n1', pitch: 69, velocity: 100, startTick: 0, durationTicks: 480 }], 480, 120, { numerator: 3, denominator: 4 });
    expect(Array.from(bytes.slice(22))).toEqual([
      0,255,81,3,7,161,32, 0,255,88,4,3,2,24,8,
      0,192,0, 0,144,69,100, 131,96,128,69,0, 0,255,47,0,
    ]);
  });
  it('ordena note-off antes del siguiente note-on en un mismo tick', () => {
    const bytes = encodeMidi([
      { id: 'b', pitch: 60, velocity: 90, startTick: 480, durationTicks: 480 },
      { id: 'a', pitch: 60, velocity: 90, startTick: 0, durationTicks: 480 },
    ], 480, 120, { numerator: 4, denominator: 4 });
    expect(Array.from(bytes.slice(44, 53))).toEqual([131,96,128,60,0,0,144,60,90]);
  });
});
