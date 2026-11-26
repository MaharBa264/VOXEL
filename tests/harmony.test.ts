import { describe, expect, it } from 'vitest';
import type { MidiNote } from '../src/domain/project';
import {
  analyzeHarmony, buildPopBacktrack, chordLabel, diatonicChords,
  readChordsFromNotes, ticksPerBar, type Chord,
} from '../src/domain/harmony';

const FOUR_FOUR = { numerator: 4, denominator: 4 } as const;

function note(pitch: number, startTick: number, durationTicks = 480, id = `${pitch}-${startTick}`): MidiNote {
  return { id, pitch, velocity: 90, startTick, durationTicks };
}

describe('lectura armónica local', () => {
  it('divide en compases según PPQ y compás', () => {
    expect(ticksPerBar(480, FOUR_FOUR)).toBe(1920);
    expect(ticksPerBar(480, { numerator: 3, denominator: 4 })).toBe(1440);
    expect(ticksPerBar(480, { numerator: 6, denominator: 8 })).toBe(1440);
  });

  it('detecta la tonalidad a partir de las duraciones de las clases de pitch', () => {
    const cMajor = [note(60, 0, 960), note(64, 960), note(67, 1440), note(60, 1920)];
    const aMinor = [note(69, 0, 960), note(60, 960), note(64, 1440), note(69, 1920)];
    expect(analyzeHarmony(cMajor, 480, 120, FOUR_FOUR).key).toEqual({ tonic: 0, mode: 'major' });
    expect(analyzeHarmony(aMinor, 480, 120, FOUR_FOUR).key).toEqual({ tonic: 9, mode: 'minor' });
  });

  it('propone un acorde por compás y ofrece sólo acordes diatónicos', () => {
    const notes = [note(60, 0, 960), note(64, 0, 960), note(67, 0, 960),
      note(69, 1920, 960), note(72, 1920, 960), note(76, 1920, 960)];
    const proposal = analyzeHarmony(notes, 480, 120, FOUR_FOUR);
    expect(proposal.key).toEqual({ tonic: 0, mode: 'major' });
    expect(proposal.bars.map((bar) => bar.chord)).toEqual([
      { root: 0, quality: 'major' }, { root: 9, quality: 'minor' },
    ]);
    expect(diatonicChords(proposal.key).map((chord) => chord.label)).toEqual(
      ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'],
    );
    expect(chordLabel({ root: 9, quality: 'minor' })).toBe('Am');
  });

  it('acepta la corrección por compás y genera pistas MIDI válidas', () => {
    const chords: Chord[] = [{ root: 0, quality: 'major' }, { root: 9, quality: 'minor' }];
    const tracks = buildPopBacktrack(chords, 480, FOUR_FOUR, 3840);
    expect(tracks.map((track) => track.id)).toEqual(['backtrack-chords', 'backtrack-bass']);
    expect(tracks.map((track) => track.midiChannel)).toEqual([1, 2]);
    expect(tracks[0]?.notes).toHaveLength(6);
    expect(tracks[1]?.notes).toHaveLength(4);
    for (const track of tracks) {
      for (const item of track.notes) {
        expect(item.pitch).toBeGreaterThanOrEqual(0);
        expect(item.pitch).toBeLessThanOrEqual(127);
        expect(item.velocity).toBeGreaterThanOrEqual(1);
        expect(item.startTick + item.durationTicks).toBeLessThanOrEqual(3840);
      }
    }
    expect(readChordsFromNotes(tracks[0]?.notes ?? [], 480, FOUR_FOUR)).toEqual(chords);
  });

  it('recorta las notas al final del audio en lugar de excederlo', () => {
    const tracks = buildPopBacktrack([{ root: 0, quality: 'major' }], 480, FOUR_FOUR, 200);
    expect(tracks.every((track) => track.notes.every((item) => item.startTick + item.durationTicks <= 200))).toBe(true);
    expect(tracks[1]?.notes).toHaveLength(1);
  });
});
