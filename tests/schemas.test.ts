import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MidiNoteSchema, ProjectSchema, parseProject } from '../src/domain/project';
import projectSchema from '../schemas/project.schema.json';
import noteSchema from '../schemas/midi-note.schema.json';
import example from '../examples/empty-project.json';
import tauriConfig from '../src-tauri/tauri.conf.json';

describe('artefactos interoperables', () => {
  const validator = new Ajv2020({ strict: true });
  const validateProject = validator.compile(projectSchema);
  const validateNote = validator.compile(noteSchema);

  it('el ejemplo cumple tanto JSON Schema como el contrato semántico', () => {
    expect(validateProject(example), JSON.stringify(validateProject.errors)).toBe(true);
    expect(parseProject(example)).toEqual(example);
  });
  it('JSON Schema rechaza una versión futura y notas MIDI fuera de rango', () => {
    expect(validateProject({ ...example, schemaVersion: 2 })).toBe(false);
    expect(validateNote({ id: 'n', pitch: 128, velocity: 100, startTick: 0, durationTicks: 480 })).toBe(false);
    expect(validateNote({ id: 'n', pitch: 60, velocity: 100, startTick: 0, durationTicks: 480 })).toBe(true);
  });
  it('los esquemas distribuidos están sincronizados con la fuente', () => {
    expect(projectSchema).toEqual(z.toJSONSchema(ProjectSchema, { target: 'draft-2020-12' }));
    expect(noteSchema).toEqual(z.toJSONSchema(MidiNoteSchema, { target: 'draft-2020-12' }));
  });
  it('Tauri acepta la estructura de configuración según el esquema de su CLI instalada', () => {
    const schemaPath = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/config.schema.json', import.meta.url));
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
    // The CLI schema includes escaped punctuation incompatible with JS /u.
    // Keep the installed upstream schema intact and use non-Unicode regex mode.
    const validate = new Ajv({ strict: false, unicodeRegExp: false }).compile(schema);
    expect(validate(tauriConfig), JSON.stringify(validate.errors)).toBe(true);
  });
});
