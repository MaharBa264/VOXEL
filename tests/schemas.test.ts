import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
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
  const schemaPath = fileURLToPath(new URL('../node_modules/@tauri-apps/cli/config.schema.json', import.meta.url));
  const tauriSchema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
  // The CLI schema escapes punctuation in patterns that JS rejects under /u.
  // Keep those patterns intact, but reject unknown formats and non-finite numbers.
  const tauriValidator = new Ajv({
    strict: false, strictSchema: true, strictNumbers: true, unicodeRegExp: false,
  });
  addFormats(tauriValidator);
  tauriValidator.addFormat('uint8', {
    type: 'number', validate: (value: number) => Number.isInteger(value) && value >= 0 && value <= 255,
  });
  tauriValidator.addFormat('uint32', {
    type: 'number', validate: (value: number) => Number.isInteger(value) && value >= 0 && value <= 4294967295,
  });
  const validateTauri = tauriValidator.compile(tauriSchema);

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
    expect(validateTauri(tauriConfig), JSON.stringify(validateTauri.errors)).toBe(true);
  });
  it('rechaza una URL de desarrollo sin formato URI', () => {
    expect(validateTauri({ ...tauriConfig, build: { ...tauriConfig.build, devUrl: 'not a URI' } })).toBe(false);
  });
  it('rechaza un upgradeCode de Windows que no sea UUID', () => {
    expect(validateTauri({ ...tauriConfig, bundle: { ...tauriConfig.bundle,
      windows: { wix: { upgradeCode: 'not-a-uuid' } } } })).toBe(false);
  });
  it.each([
    ['uint8', -1, false], ['uint8', 256, false], ['uint8', 1.5, false],
    ['uint8', 0, true], ['uint8', 255, true],
    ['uint32', -1, false], ['uint32', 4294967296, false], ['uint32', 1.5, false],
    ['uint32', 0, true], ['uint32', 4294967295, true],
  ] as const)('valida %s con valor %s → %s', (format, value, expected) => {
    const validate = tauriValidator.compile({ type: 'number', format });
    expect(validate(value)).toBe(expected);
  });
  it('rechaza dimensiones no finitas', () => {
    expect(validateTauri({ ...tauriConfig, app: { ...tauriConfig.app,
      windows: [{ ...tauriConfig.app.windows[0], width: NaN }] } })).toBe(false);
  });
  it('falla explícitamente si aparece un nuevo formato sin soporte', () => {
    expect(() => tauriValidator.compile({ type: 'string', format: 'voxel-unknown-format' })).toThrow(/unknown format/);
  });
});
