import type { MidiNote, TimeSignature } from '../domain/project';

export function ticksToSeconds(ticks: number, ppq: number, tempoBpm: number): number {
  return ticks / ppq * 60 / tempoBpm;
}

function vlq(value: number): number[] {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0x0fffffff) throw new Error('Intervalo MIDI fuera de rango.');
  const bytes = [value % 128];
  while ((value = Math.floor(value / 128)) > 0) bytes.unshift((value % 128) | 128);
  return bytes;
}

export function encodeMidi(notes: readonly MidiNote[], ppq: number, tempoBpm: number, timeSignature: TimeSignature): Uint8Array<ArrayBuffer> {
  if (!Number.isInteger(ppq) || ppq < 1 || ppq > 32767 || tempoBpm < 40 || tempoBpm > 240) throw new Error('Tempo o PPQ inválido.');
  const numerator = Math.trunc(timeSignature.numerator);
  const denominator = Math.trunc(timeSignature.denominator);
  const validDenominators = [1, 2, 4, 8, 16, 32, 64, 128];
  if (!Number.isInteger(numerator) || numerator < 1 || numerator > 255 || !validDenominators.includes(denominator)) {
    throw new Error('Compás inválido.');
  }
  const tempo = Math.round(60_000_000 / tempoBpm);
  const denominatorExponent = Math.round(Math.log2(denominator));
  const track = [0,255,81,3,(tempo >> 16) & 255,(tempo >> 8) & 255,tempo & 255,
    0,255,88,4,numerator,denominatorExponent,24,8, 0,192,0];
  const events = notes.flatMap((note) => [
    { tick: note.startTick, order: 1, bytes: [0x90, note.pitch, note.velocity] },
    { tick: note.startTick + note.durationTicks, order: 0, bytes: [0x80, note.pitch, 0] },
  ]).sort((a, b) => a.tick - b.tick || a.order - b.order);
  let previous = 0;
  for (const event of events) {
    track.push(...vlq(event.tick - previous), ...event.bytes);
    previous = event.tick;
  }
  track.push(0,255,47,0);
  const output = new Uint8Array(22 + track.length);
  output.set([77,84,104,100,0,0,0,6,0,0,0,1,ppq >> 8,ppq & 255,77,84,114,107]);
  new DataView(output.buffer).setUint32(18, track.length);
  output.set(track, 22);
  return output;
}
