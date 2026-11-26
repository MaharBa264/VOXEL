import { encodeMonoWav } from './wav';

export interface Recording {
  /** Resolves when the recorder is actually capturing; rejects if the count-in is cancelled. */
  started: Promise<void>;
  finished: Promise<Blob>;
  stop(): void;
  abort(): void;
}

export interface RecordingOptions {
  /** Runs after the microphone is granted and before the recorder starts (for a count-in). */
  beforeStart?: (signal: AbortSignal) => Promise<void>;
}

export async function startRecording(signal: AbortSignal, options: RecordingOptions = {}): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error('Este entorno no permite grabar audio.');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => stream.getTracks().forEach((track) => track.stop());
  if (signal.aborted) { release(); throw new Error('Grabación cancelada.'); }
  try {
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/wav'].find((mime) => MediaRecorder.isTypeSupported(mime));
    if (!mimeType) throw new Error('No hay un formato de grabación compatible (WebM, Ogg o WAV).');
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];
    let aborted = false;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let settled = false;
    let startSettled = false;
    let resolve!: (blob: Blob) => void;
    let reject!: (reason: Error) => void;
    let resolveStarted!: () => void;
    let rejectStarted!: (reason: Error) => void;
    const finished = new Promise<Blob>((yes, no) => { resolve = yes; reject = no; });
    const started = new Promise<void>((yes, no) => { resolveStarted = yes; rejectStarted = no; });
    // Callers may await only one of the two promises; keep the other rejection handled.
    finished.catch(() => {});
    started.catch(() => {});
    const cleanup = () => { clearTimeout(timer); release(); signal.removeEventListener('abort', abort); };
    const fail = (error: Error) => {
      if (!settled) { settled = true; cleanup(); reject(error); }
      if (!startSettled) { startSettled = true; rejectStarted(error); }
    };
    const stop = () => {
      stopped = true;
      // Release the microphone synchronously, before decoding or saving anything.
      release();
      if (recorder.state !== 'inactive') recorder.stop();
    };
    const abort = () => { aborted = true; stop(); fail(new Error('Grabación cancelada.')); };
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { fail(new Error('La grabación falló. Revisá el micrófono.')); if (recorder.state !== 'inactive') recorder.stop(); };
    recorder.onstop = () => {
      cleanup();
      if (aborted || settled) return;
      const blob = new Blob(chunks, { type: mimeType.split(';')[0]! });
      if (!blob.size) { fail(new Error('No se recibió audio del micrófono.')); return; }
      settled = true; resolve(blob);
    };
    signal.addEventListener('abort', abort, { once: true });
    // The microphone is already open, but the take only starts after the count-in.
    void (async () => {
      try {
        if (options.beforeStart) await options.beforeStart(signal);
        if (aborted || stopped || signal.aborted) throw new Error('Grabación cancelada.');
        recorder.start(250);
        timer = setTimeout(stop, 30_000);
        if (!startSettled) { startSettled = true; resolveStarted(); }
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
        if (recorder.state !== 'inactive') recorder.stop();
      }
    })();
    return { started, finished, stop, abort };
  } catch (error) { release(); throw error; }
}

export async function prepareAnalysis(original: Blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await original.arrayBuffer());
    const durationSeconds = decoded.duration;
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    return { wav: encodeMonoWav(channels, decoded.sampleRate), sampleRateHz: decoded.sampleRate,
      channels: decoded.numberOfChannels, durationSeconds, analysisDurationSeconds: Math.min(30, durationSeconds) };
  } finally { await context.close(); }
}
