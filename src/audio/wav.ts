/** PCM16 little endian; the original recording remains a separate asset. */
export function encodeMonoWav(channels: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  if (!channels.length || !Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > 384000) {
    throw new Error('Audio sin canales o frecuencia inválida.');
  }
  const frames = Math.min(channels[0]!.length, sampleRate * 30);
  if (!frames || channels.some((channel) => channel.length < frames)) throw new Error('Audio vacío o incompleto.');
  const buffer = new ArrayBuffer(44 + frames * 2);
  const view = new DataView(buffer);
  const label = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  label(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); label(8, 'WAVE');
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  label(36, 'data'); view.setUint32(40, frames * 2, true);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (const channel of channels) {
      const value = channel[frame]!;
      if (!Number.isFinite(value)) throw new Error('Audio contiene muestras inválidas.');
      sum += value;
    }
    const sample = Math.max(-1, Math.min(1, sum / channels.length));
    view.setInt16(44 + frame * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
  }
  return buffer;
}
