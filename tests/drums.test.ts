import { describe, expect, it } from 'vitest';
import {
  DRUM_INSTRUMENTS, drumInstrument, drumInstrumentByNote, reassignDrumNotes,
} from '../src/domain/drums';
import { drumHits } from '../src/audio/drums';
import type { MidiNote } from '../src/domain/project';

const note = (pitch: number, startTick: number, id: string): MidiNote => ({
  id, pitch, velocity: 90, startTick, durationTicks: 96,
});

describe('batería local', () => {
  it('ofrece la lista GM reducida y la resuelve en ambos sentidos', () => {
    expect(DRUM_INSTRUMENTS).toHaveLength(10);
    expect(drumInstrument('tom-high')?.note).toBe(45);
    expect(drumInstrument('whistle')).toBeUndefined();
    expect(drumInstrumentByNote(36)?.id).toBe('kick');
    expect(drumInstrumentByNote(99)).toBeUndefined();
  });

  it('reasigna toda la línea sin alterar tiempo, velocity ni IDs', () => {
    const notes = [note(36, 0, 'a'), note(38, 480, 'b')];
    const assigned = reassignDrumNotes(notes, 45);
    expect(assigned.map((item) => item.pitch)).toEqual([45, 45]);
    expect(assigned.map((item) => item.id)).toEqual(['a', 'b']);
    expect(assigned.map((item) => item.startTick)).toEqual([0, 480]);
    expect(assigned.every((item) => item.velocity === 90 && item.durationTicks === 96)).toBe(true);
    expect(notes[0]?.pitch).toBe(36);
  });

  it('convierte los ticks a tiempo y ordena los golpes', () => {
    const hits = drumHits([note(38, 960, 'b'), note(36, 0, 'a')], 480, 120);
    expect(hits.map((hit) => hit.time)).toEqual([0, 1]);
    expect(hits.map((hit) => hit.pitch)).toEqual([36, 38]);
    expect(hits.every((hit) => hit.velocity > 0 && hit.velocity <= 1)).toBe(true);
  });
});
