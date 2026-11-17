import { mkdir, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { MidiNoteSchema, ProjectSchema } from '../src/domain/project.ts';

await mkdir(new URL('../schemas/', import.meta.url), { recursive: true });
for (const [filename, schema] of [
  ['midi-note.schema.json', MidiNoteSchema],
  ['project.schema.json', ProjectSchema],
] as const) {
  const jsonSchema = z.toJSONSchema(schema, { target: 'draft-2020-12' });
  await writeFile(new URL(`../schemas/${filename}`, import.meta.url), `${JSON.stringify(jsonSchema, null, 2)}\n`, 'utf8');
}
