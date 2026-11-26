import { z } from 'zod';

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const name = z.string().min(1).max(256).regex(/\S/);
const tick = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const MidiNoteSchema = z.strictObject({
  id,
  pitch: z.number().int().min(0).max(127),
  velocity: z.number().int().min(1).max(127),
  startTick: tick,
  durationTicks: tick.min(1),
}).superRefine((note, ctx) => {
  if (!Number.isSafeInteger(note.startTick + note.durationTicks)) {
    ctx.addIssue({ code: 'custom', path: ['durationTicks'], message: 'Note end exceeds safe integer range' });
  }
});

const AudioAssetSchema = z.strictObject({
  id,
  path: z.string().min(1).max(1024),
  mimeType: z.enum(['audio/wav', 'audio/webm', 'audio/ogg']),
  sampleRateHz: z.number().int().min(1).max(384000),
  channels: z.number().int().min(1).max(32),
  durationSeconds: z.number().positive(),
});

const TrackSchema = z.strictObject({
  id,
  name,
  midiChannel: z.number().int().min(0).max(15),
  program: z.number().int().min(0).max(127),
  sourceAudioId: id.optional(),
  notes: z.array(MidiNoteSchema),
});

// Lexical portability only. The native host must later enforce containment on disk.
function isPortableAudioPath(path: string): boolean {
  const segments = path.split('/');
  return segments.length >= 2 && segments[0] === 'audio' && segments.every((segment) =>
    segment.length > 0 && segment !== '.' && segment !== '..' &&
    !/[<>:"\\|?*%\x00-\x1f\x7f]/.test(segment) &&
    !/^[ .]|[ .]$/.test(segment) &&
    !/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(segment),
  );
}

export const TimeSignatureSchema = z.strictObject({
  numerator: z.number().int().min(1).max(255),
  denominator: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8),
    z.literal(16), z.literal(32), z.literal(64), z.literal(128)]),
});

export const ProjectSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id,
  name,
  ppq: z.number().int().min(1).max(32767),
  tempoBpm: z.number().positive(),
  timeSignature: TimeSignatureSchema,
  audioAssets: z.array(AudioAssetSchema),
  tracks: z.array(TrackSchema),
}).superRefine((project, ctx) => {
  const unique = (ids: string[], path: (string | number)[]) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path, message: 'Duplicate IDs' });
    }
  };
  unique(project.audioAssets.map((asset) => asset.id), ['audioAssets']);
  unique(project.tracks.map((track) => track.id), ['tracks']);
  const audioIds = new Set(project.audioAssets.map((asset) => asset.id));
  project.audioAssets.forEach((asset, index) => {
    if (!isPortableAudioPath(asset.path)) {
      ctx.addIssue({ code: 'custom', path: ['audioAssets', index, 'path'], message: 'Expected portable audio/ relative path' });
    }
  });
  project.tracks.forEach((track, index) => {
    unique(track.notes.map((note) => note.id), ['tracks', index, 'notes']);
    if (track.sourceAudioId !== undefined && !audioIds.has(track.sourceAudioId)) {
      ctx.addIssue({ code: 'custom', path: ['tracks', index, 'sourceAudioId'], message: 'Unknown audio asset' });
    }
  });
});

export type MidiNote = z.infer<typeof MidiNoteSchema>;
export type TimeSignature = z.infer<typeof TimeSignatureSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Project = z.infer<typeof ProjectSchema>;

export function parseProject(input: unknown): Project {
  return ProjectSchema.parse(input);
}
