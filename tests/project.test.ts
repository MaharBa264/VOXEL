import { describe, expect, it } from 'vitest';
import { MidiNoteSchema, ProjectSchema, parseProject } from '../src/domain/project';

const note = { id: 'n1', pitch: 60, velocity: 100, startTick: 0, durationTicks: 480 };
const project = {
  schemaVersion: 1, id: 'p1', name: 'Melodía', ppq: 480,
  tempoBpm: 120, timeSignature: { numerator: 4, denominator: 4 },
  audioAssets: [{ id: 'a1', path: 'audio/original.wav', mimeType: 'audio/wav',
    sampleRateHz: 48000, channels: 1, durationSeconds: 2 }],
  tracks: [{ id: 't1', name: 'Voz', midiChannel: 0, program: 0,
    sourceAudioId: 'a1', notes: [note] }],
};

describe('contrato MIDI', () => {
  it('acepta límites MIDI y ticks enteros', () => {
    expect(MidiNoteSchema.parse({ ...note, pitch: 0, velocity: 1 })).toMatchObject({ pitch: 0 });
    expect(MidiNoteSchema.parse({ ...note, pitch: 127, velocity: 127 })).toMatchObject({ pitch: 127 });
  });
  it.each([
    { pitch: -1 }, { pitch: 128 }, { pitch: 60.5 }, { velocity: 0 }, { velocity: 128 },
    { startTick: -1 }, { startTick: 0.5 }, { durationTicks: 0 }, { durationTicks: 1.5 },
    { startTick: Number.MAX_SAFE_INTEGER, durationTicks: 1 }, { pitch: NaN },
  ])('rechaza nota inválida %j', (change) => {
    expect(MidiNoteSchema.safeParse({ ...note, ...change }).success).toBe(false);
  });
});

describe('proyecto v1', () => {
  it('conserva notas y referencia original al serializar', () => {
    const loaded = parseProject(JSON.parse(JSON.stringify(project)));
    expect(loaded).toEqual(project);
    expect(loaded.tracks[0]?.notes[0]?.durationTicks).toBe(480);
    expect(loaded.audioAssets[0]?.path).toBe('audio/original.wav');
  });
  it('acepta un proyecto sin grabaciones', () => {
    expect(ProjectSchema.safeParse({ ...project, tracks: [], audioAssets: [] }).success).toBe(true);
  });
  it.each([
    { schemaVersion: 2 }, { tempoBpm: 0 }, { tempoBpm: Infinity }, { ppq: 0 }, { ppq: 480.5 },
    { unexpected: true }, { timeSignature: { numerator: 4, denominator: 3 } },
  ])('rechaza versión, campos o tiempo inválidos %j', (change) => {
    expect(ProjectSchema.safeParse({ ...project, ...change }).success).toBe(false);
  });
  it.each(['../x.wav', 'audio/../x.wav', 'C:/x.wav', '/x.wav', '\\\\server\\x.wav',
    'audio\\x.wav', 'https://x/a.wav', 'audio//x.wav', 'audio/./x.wav', 'audio/CON.wav',
    'audio/x?.wav', 'audio/x.wav.', 'audio/x%2f.wav'])('rechaza ruta no portable %s', (path) => {
    expect(ProjectSchema.safeParse({ ...project, audioAssets: [{ ...project.audioAssets[0], path }] }).success).toBe(false);
  });
  it('rechaza referencia a un audio ausente', () => {
    expect(ProjectSchema.safeParse({ ...project, audioAssets: [] }).success).toBe(false);
  });
  it.each(['audio', 'track', 'note'])('rechaza IDs duplicados: %s', (kind) => {
    const bad = structuredClone(project);
    if (kind === 'audio') bad.audioAssets.push(bad.audioAssets[0]!);
    if (kind === 'track') bad.tracks.push(bad.tracks[0]!);
    if (kind === 'note') bad.tracks[0]!.notes.push(note);
    expect(ProjectSchema.safeParse(bad).success).toBe(false);
  });
  it('rechaza entradas que no son objetos', () => {
    expect(() => parseProject(null)).toThrow();
  });
});
