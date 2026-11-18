import type { MidiNote } from '../domain/project';
import { ticksToSeconds } from './midi';
import type { Context, Part, Sampler } from 'tone';

interface PianoEvent { pitch: number; velocity: number; attack: boolean }
export function pianoEvents(notes: readonly MidiNote[], ppq: number, tempoBpm: number): [number, PianoEvent][] {
  return notes.flatMap((note): [number, PianoEvent][] => [
    [ticksToSeconds(note.startTick, ppq, tempoBpm), { pitch: note.pitch, velocity: note.velocity / 127, attack: true }],
    [ticksToSeconds(note.startTick + note.durationTicks, ppq, tempoBpm), { pitch: note.pitch, velocity: 0, attack: false }],
  ]).sort((a, b) => a[0] - b[0] || Number(a[1].attack) - Number(b[1].attack));
}

export class PianoPlayer {
  private sampler: Sampler | undefined;
  private part: Part<[number, PianoEvent]> | undefined;
  private transport: ReturnType<typeof import('tone').getTransport> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private generation = 0;
  private context: Context | undefined;

  stop() {
    this.generation++;
    clearTimeout(this.timer);
    this.part?.dispose();
    this.part = undefined;
    this.transport?.stop();
    if (this.transport) this.transport.seconds = 0;
    this.sampler?.releaseAll();
    this.sampler?.dispose();
    this.sampler = undefined;
  }

  dispose() {
    this.stop();
    const context = this.context;
    this.context = undefined;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }

  async play(notes: readonly MidiNote[], ppq: number, tempoBpm: number, onEnded: () => void) {
    this.stop();
    const generation = this.generation;
    const Tone = await import('tone');
    if (generation !== this.generation) return;
    try {
    if (Tone.getContext().state === 'closed') Tone.setContext(new Tone.Context());
    const context = Tone.getContext();
    if (context instanceof Tone.Context) this.context = context;
    // This call originates in the play-button gesture; never request audio on mount.
    await Tone.start();
    if (generation !== this.generation) return;
    let sampler: Sampler;
    const loaded = new Promise<void>((resolve, reject) => {
      sampler = new Tone.Sampler({
        urls: { A2: 'A2.mp3', A3: 'A3.mp3', A4: 'A4.mp3', A5: 'A5.mp3', A6: 'A6.mp3' },
        baseUrl: '/piano/', release: 0.4,
        onload: resolve,
        onerror: () => reject(new Error('No se pudo cargar el piano local.')),
      }).toDestination();
      this.sampler = sampler;
    });
      await loaded;
      if (generation !== this.generation) return;
      const events = pianoEvents(notes, ppq, tempoBpm);
      this.transport = Tone.getTransport();
      this.transport.stop(); this.transport.seconds = 0;
      this.transport.PPQ = ppq; this.transport.bpm.value = tempoBpm;
      this.part = new Tone.Part<[number, PianoEvent]>((time, event) => {
        if (generation !== this.generation) return;
        const frequency = Tone.Frequency(event.pitch, 'midi').toFrequency();
        if (event.attack) sampler!.triggerAttack(frequency, time, event.velocity);
        else sampler!.triggerRelease(frequency, time);
      }, events).start(0);
      this.transport.start('+0.1');
      const end = events.at(-1)?.[0] ?? 0;
      this.timer = setTimeout(() => { if (generation === this.generation) { this.stop(); onEnded(); } }, (end + 0.6) * 1000);
    } catch (error) { if (generation === this.generation) this.dispose(); throw error; }
  }
}
