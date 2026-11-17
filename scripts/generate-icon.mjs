import { mkdir, writeFile } from 'node:fs/promises';

// Temporary code-drawn development icon; not the final VOXEL identity.
// A single 32x32 BGRA DIB plus AND mask in the standard Windows ICO container.
const size = 32;
const pixels = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const mark = y >= 7 && y <= 25 && Math.abs(Math.abs(x - 15.5) - (25 - y) * 0.5) < 2;
    const color = mark ? [203, 224, 141, 255] : [32, 22, 16, 255];
    pixels.set(color, ((size - 1 - y) * size + x) * 4);
  }
}
const mask = Buffer.alloc(size * 4);
const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0);
dib.writeInt32LE(size, 4);
dib.writeInt32LE(size * 2, 8);
dib.writeUInt16LE(1, 12);
dib.writeUInt16LE(32, 14);
dib.writeUInt32LE(pixels.length + mask.length, 20);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = size;
header[7] = size;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(dib.length + pixels.length + mask.length, 14);
header.writeUInt32LE(header.length, 18);
const directory = new URL('../src-tauri/icons/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('icon.ico', directory), Buffer.concat([header, dib, pixels, mask]));
