import { invoke, isTauri } from '@tauri-apps/api/core';
import { parseProject, type TimeSignature } from '../domain/project';

export const nativeAvailable = () => typeof window !== 'undefined' && isTauri();
export async function saveTake(original: Blob, analysis: { wav: ArrayBuffer; sampleRateHz: number; durationSeconds: number; channels: number; analysisDurationSeconds: number }, tempoBpm: number, timeSignature: TimeSignature) {
  return parseProject(await invoke('save_take', {
    original: Array.from(new Uint8Array(await original.arrayBuffer())), mimeType: original.type,
    wav: Array.from(new Uint8Array(analysis.wav)), sampleRateHz: analysis.sampleRateHz,
    durationSeconds: analysis.durationSeconds, channels: analysis.channels, analysisDurationSeconds: analysis.analysisDurationSeconds, tempoBpm,
    timeSignature: `${timeSignature.numerator}/${timeSignature.denominator}`,
  }));
}
export async function listProjects(): Promise<{ id: string; name: string }[]> {
  const result: unknown = await invoke('list_projects');
  if (!Array.isArray(result) || !result.every((item: unknown) => typeof item === 'object' && item !== null &&
    'id' in item && typeof item.id === 'string' && /^[A-Za-z0-9_-]+$/.test(item.id) &&
    'name' in item && typeof item.name === 'string')) throw new Error('Lista de proyectos inválida.');
  return result as { id: string; name: string }[];
}
export async function loadProject(projectId: string) { return parseProject(await invoke('load_project', { projectId })); }
export async function transcribeTake(projectId: string, monophonic: boolean, inputKind: string) { return parseProject(await invoke('transcribe_take', { projectId, monophonic, inputKind })); }
export async function cancelTranscription() { await invoke('cancel_transcription'); }
export async function originalAudio(projectId: string) {
  const result = await invoke<{ bytes: number[]; mimeType: string }>('get_original_audio', { projectId });
  if (!Array.isArray(result.bytes) || !result.bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255) ||
    !['audio/wav', 'audio/webm', 'audio/ogg'].includes(result.mimeType)) throw new Error('El audio guardado no es válido.');
  return new Blob([new Uint8Array(result.bytes)], { type: result.mimeType });
}
