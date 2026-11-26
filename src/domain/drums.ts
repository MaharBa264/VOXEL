import type { MidiNote } from './project';

/**
 * Reduced General MIDI drum map used by the local percussion line.
 * The user chooses the instrument of a whole line; the detected hits keep
 * their timing and velocity while their pitch is replaced by the GM note.
 */
export interface DrumInstrument {
  id: string;
  label: string;
  note: number;
}

export const DRUM_INSTRUMENTS: readonly DrumInstrument[] = [
  { id: 'kick', label: 'Bombo', note: 36 },
  { id: 'snare', label: 'Redo', note: 38 },
  { id: 'clap', label: 'Palmas', note: 39 },
  { id: 'tom-low', label: 'Tom bajo', note: 41 },
  { id: 'tom-mid', label: 'Tom medio', note: 43 },
  { id: 'tom-high', label: 'Tom alto', note: 45 },
  { id: 'hat-closed', label: 'Hi-hat cerrado', note: 42 },
  { id: 'hat-open', label: 'Hi-hat abierto', note: 46 },
  { id: 'ride', label: 'Ride', note: 51 },
  { id: 'crash', label: 'Crash', note: 49 },
];

export function drumInstrument(id: string): DrumInstrument | undefined {
  return DRUM_INSTRUMENTS.find((instrument) => instrument.id === id);
}

export function drumInstrumentByNote(note: number): DrumInstrument | undefined {
  return DRUM_INSTRUMENTS.find((instrument) => instrument.note === note);
}

/** Copies percussion notes with a new drum pitch; IDs, ticks and velocity stay. */
export function reassignDrumNotes(notes: readonly MidiNote[], note: number): MidiNote[] {
  if (!Number.isInteger(note) || note < 0 || note > 127) throw new RangeError('Nota de batería inválida.');
  return notes.map((item) => ({ ...item, pitch: note }));
}
