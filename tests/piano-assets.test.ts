import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import manifest from '../public/piano/manifest.json';

describe('samples locales de piano', () => {
  it.each(manifest)('$Name conserva el archivo distribuido con atribución', (asset) => {
    const data = readFileSync(new URL(`../public/piano/${asset.Name}`, import.meta.url));
    expect(data.length).toBe(asset.Bytes);
    expect(createHash('sha256').update(data).digest('hex').toUpperCase()).toBe(asset.SHA256);
  });
});
