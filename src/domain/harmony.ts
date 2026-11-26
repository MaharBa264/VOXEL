import type { MidiNote, TimeSignature, Track } from './project';

/**
 * Deterministic, local harmonic reading and pop backtrack generation.
 *
 * Everything here works on PPQ ticks and pitch classes only: no wall-clock
 * seconds, no audio and no external services. The result is a proposal that
 * the user can correct per bar before any MIDI is written.
 */

export type ChordQuality = 'major' | 'minor' | 'diminished';

export interface Chord {
  root: number;
  quality: ChordQuality;
}

export interface Key {
  tonic: number;
  mode: 'major' | 'minor';
}

export interface BarChord {
  bar: number;
  chord: Chord;
}

export interface HarmonyProposal {
  key: Key;
  bars: BarChord[];
  ticksPerBar: number;
}

export interface ChordOption extends Chord {
  degree: string;
  label: string;
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const TRIADS: Record<ChordQuality, readonly number[]> = {
  major: [0, 4, 7], minor: [0, 3, 7], diminished: [0, 3, 6],
};

export function chordLabel(chord: Chord): string {
  const suffix = chord.quality === 'major' ? '' : chord.quality === 'minor' ? 'm' : 'dim';
  return `${NOTE_NAMES[chord.root % 12]}${suffix}`;
}

export function keyLabel(key: Key): string {
  return `${NOTE_NAMES[key.tonic % 12]} ${key.mode === 'major' ? 'mayor' : 'menor'}`;
}

export function ticksPerBar(ppq: number, timeSignature: TimeSignature): number {
  const ticks = ppq * 4 * timeSignature.numerator / timeSignature.denominator;
  if (!Number.isSafeInteger(ticks) || ticks < 1) throw new RangeError('Compás no representable con este PPQ.');
  return ticks;
}

export function diatonicChords(key: Key): ChordOption[] {
  const tonic = key.tonic % 12;
  const patterns = key.mode === 'major'
    ? [['I', 0, 'major'], ['ii', 2, 'minor'], ['iii', 4, 'minor'], ['IV', 5, 'major'],
       ['V', 7, 'major'], ['vi', 9, 'minor'], ['vii°', 11, 'diminished']]
    : [['i', 0, 'minor'], ['ii°', 2, 'diminished'], ['III', 3, 'major'], ['iv', 5, 'minor'],
       ['v', 7, 'minor'], ['VI', 8, 'major'], ['VII', 10, 'major']];
  return patterns.map(([degree, interval, quality]) => {
    const chord: Chord = { root: (tonic + (interval as number)) % 12, quality: quality as ChordQuality };
    return { ...chord, degree: degree as string, label: chordLabel(chord) };
  });
}

function pitchWeights(notes: readonly MidiNote[]): number[] {
  const weights = new Array<number>(12).fill(0);
  for (const note of notes) weights[note.pitch % 12] = (weights[note.pitch % 12] ?? 0) + note.durationTicks;
  return weights;
}

function detectKey(notes: readonly MidiNote[]): Key {
  const weights = pitchWeights(notes);
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { tonic: 0, mode: 'major' };
  const normalized = weights.map((value) => value / total);
  let best: Key = { tonic: 0, mode: 'major' };
  let bestScore = -Infinity;
  for (let tonic = 0; tonic < 12; tonic += 1) {
    for (const mode of ['major', 'minor'] as const) {
      const profile = mode === 'major' ? MAJOR_PROFILE : MINOR_PROFILE;
      let score = 0;
      for (let degree = 0; degree < 12; degree += 1) score += (normalized[(tonic + degree) % 12] ?? 0) * (profile[degree] ?? 0);
      if (score > bestScore) { bestScore = score; best = { tonic, mode }; }
    }
  }
  return best;
}

function proposeChord(notes: readonly MidiNote[], candidates: readonly Chord[]): Chord {
  const weights = pitchWeights(notes);
  let best = candidates[0] ?? { root: 0, quality: 'major' as ChordQuality };
  let bestScore = -1;
  for (const candidate of candidates) {
    const score = TRIADS[candidate.quality].reduce(
      (sum, interval) => sum + (weights[(candidate.root + interval) % 12] ?? 0), 0,
    );
    if (score > bestScore) { bestScore = score; best = candidate; }
  }
  return { root: best.root, quality: best.quality };
}

function chordsFromTriadNotes(key: Key, notes: readonly MidiNote[], ppq: number, timeSignature: TimeSignature): Chord[] {
  const barTicks = ticksPerBar(ppq, timeSignature);
  if (!notes.length) return [];
  const lastEnd = Math.max(...notes.map((note) => note.startTick + note.durationTicks));
  const candidates = diatonicChords(key);
  const result: Chord[] = [];
  for (let bar = 0, start = 0; start < lastEnd; bar += 1, start += barTicks) {
    const inBar = notes.filter((note) => note.startTick >= start && note.startTick < start + barTicks);
    result.push(proposeChord(inBar, candidates));
  }
  return result;
}

/** Reads a melody proposal: key plus one chord per bar, ordered from bar 0. */
export function analyzeHarmony(
  notes: readonly MidiNote[], ppq: number, _tempoBpm: number, timeSignature: TimeSignature,
): HarmonyProposal {
  const barTicks = ticksPerBar(ppq, timeSignature);
  const key = detectKey(notes);
  const candidates = diatonicChords(key);
  const lastEnd = notes.length ? Math.max(...notes.map((note) => note.startTick + note.durationTicks)) : 0;
  const bars: BarChord[] = [];
  for (let bar = 0, start = 0; start < lastEnd; bar += 1, start += barTicks) {
    const inBar = notes.filter((note) => note.startTick >= start && note.startTick < start + barTicks);
    bars.push({ bar, chord: proposeChord(inBar, candidates) });
  }
  return { key, bars, ticksPerBar: barTicks };
}

/** Recovers the chords that were written into a chord track, for display after reopening. */
export function readChordsFromNotes(
  notes: readonly MidiNote[], ppq: number, timeSignature: TimeSignature,
): Chord[] {
  return chordsFromTriadNotes(detectKey(notes), notes, ppq, timeSignature);
}

/**
 * Builds the two pop accompaniment tracks. `maxTick` keeps every generated
 * note inside the recorded audio, so the host's note validation still applies.
 */
export function buildPopBacktrack(
  chords: readonly Chord[], ppq: number, timeSignature: TimeSignature, maxTick: number,
): Track[] {
  const barTicks = ticksPerBar(ppq, timeSignature);
  const limit = Math.max(1, Math.floor(maxTick));
  const chordNotes: MidiNote[] = [];
  const bassNotes: MidiNote[] = [];
  chords.forEach((chord, index) => {
    const start = index * barTicks;
    if (start >= limit) return;
    const root = chord.root % 12;
    const chordTicks = Math.max(1, Math.floor(Math.min(barTicks * 0.9, limit - start)));
    TRIADS[chord.quality].forEach((interval, voice) => {
      chordNotes.push({
        id: `bt-c-${index}-${voice}`, pitch: 60 + root + interval, velocity: 68,
        startTick: start, durationTicks: chordTicks,
      });
    });
    const bassPitch = 36 + root;
    const half = Math.floor(barTicks / 2);
    const offsets = half > 0 && start + half < limit ? [0, half] : [0];
    offsets.forEach((offset, hit) => {
      const duration = Math.max(1, Math.floor(Math.min(Math.max(1, half - 12), limit - start - offset)));
      bassNotes.push({
        id: `bt-b-${index}-${hit}`, pitch: bassPitch, velocity: 88,
        startTick: start + offset, durationTicks: duration,
      });
    });
  });
  return [
    { id: 'backtrack-chords', name: 'Acordes', midiChannel: 1, program: 0, sourceAudioId: 'original', notes: chordNotes },
    { id: 'backtrack-bass', name: 'Bajo', midiChannel: 2, program: 32, sourceAudioId: 'original', notes: bassNotes },
  ];
}
