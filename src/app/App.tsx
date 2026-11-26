import { useEffect, useRef, useState } from 'react';
import type { Project } from '../domain/project';
import { prepareAnalysis, startRecording, type Recording } from '../audio/capture';
import { BEATS_PER_BAR, createMetronome, startBeatClock, type Metronome } from '../audio/metronome';
import { encodeMidi, ticksToSeconds } from '../audio/midi';
import { PianoPlayer } from '../audio/piano';
import * as projects from '../services/projects';

type Phase = 'idle' | 'requesting' | 'counting' | 'recording' | 'saving' | 'loading' | 'transcribing' | 'canceling' | 'piano-loading' | 'playing';
const statuses: Record<Phase, string> = {
  idle: 'Listo para crear', requesting: 'Esperando permiso del micrófono…', counting: 'Conteo del metrónomo',
  recording: 'Grabando tu melodía', saving: 'Preparando y guardando audio…', loading: 'Abriendo proyecto…',
  transcribing: 'Transcribiendo localmente…', canceling: 'Cancelando transcripción…',
  'piano-loading': 'Cargando piano…', playing: 'Reproduciendo piano',
};
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export function App() {
  const [native] = useState(projects.nativeAvailable);
  const [phase, setPhase] = useState<Phase>('idle');
  const [tempo, setTempo] = useState('120');
  const [metronomeOn, setMetronomeOn] = useState(true);
  const [beat, setBeat] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [project, setProject] = useState<Project>();
  const [saved, setSaved] = useState<{ id: string; name: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Grabá una melodía de hasta 30 segundos para comenzar.');
  const mounted = useRef(true);
  const recording = useRef<Recording | undefined>(undefined);
  const captureAbort = useRef<AbortController | undefined>(undefined);
  const recordRun = useRef(0);
  const cancelAck = useRef<Promise<void> | undefined>(undefined);
  const piano = useRef(new PianoPlayer());
  const metronome = useRef<Metronome | undefined>(undefined);
  const beatClock = useRef<(() => void) | undefined>(undefined);
  const playRun = useRef(0);
  const audio = useRef<HTMLAudioElement>(null);
  const phaseRef = useRef<Phase>('idle');
  const changePhase = (next: Phase) => { phaseRef.current = next; if (mounted.current) setPhase(next); };
  const currentPhase = (): Phase => phaseRef.current;
  const getMetronome = () => (metronome.current ??= createMetronome());
  const stopBeatClock = () => {
    beatClock.current?.();
    beatClock.current = undefined;
    if (mounted.current) setBeat(-1);
  };
  const idle = phase === 'idle';
  const notes = project?.tracks.flatMap((track) => track.notes) ?? [];
  const tempoValid = Number.isFinite(Number(tempo)) && Number(tempo) >= 40 && Number(tempo) <= 240;
  const duration = project?.audioAssets[0]?.durationSeconds ?? 0;

  useEffect(() => {
    mounted.current = true;
    if (native) void projects.listProjects().then((items) => { if (mounted.current) setSaved(items); })
      .catch((failure: unknown) => { if (mounted.current) setError(errorText(failure)); });
    return () => {
      mounted.current = false; playRun.current++; recordRun.current++; captureAbort.current?.abort(); recording.current?.abort();
      beatClock.current?.(); metronome.current?.dispose(); piano.current.dispose(); audio.current?.pause();
      if (phaseRef.current === 'transcribing' || phaseRef.current === 'canceling') void projects.cancelTranscription().catch(() => {});
    };
  }, [native]);
  useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);
  useEffect(() => {
    if (phase !== 'recording') return;
    const started = performance.now();
    const timer = setInterval(() => setElapsed(Math.min(30, (performance.now() - started) / 1000)), 100);
    return () => clearInterval(timer);
  }, [phase]);

  const refresh = async () => {
    try { const items = await projects.listProjects(); if (mounted.current) setSaved(items); }
    catch (failure) { if (mounted.current) setError(`No se pudo actualizar la lista: ${errorText(failure)}`); }
  };
  const record = async () => {
    if (!native || phaseRef.current !== 'idle' || !tempoValid) return;
    audio.current?.pause(); setError(''); setElapsed(0); setBeat(-1); changePhase('requesting');
    const controller = new AbortController(); captureAbort.current = controller;
    const run = ++recordRun.current;
    const takeTempo = Number(tempo);
    const withMetronome = metronomeOn;
    let downbeat = 0;
    try {
      if (withMetronome) getMetronome().prepare();
      const take = await startRecording(controller.signal, withMetronome ? {
        beforeStart: async (countSignal) => {
          changePhase('counting');
          downbeat = await getMetronome().countIn(takeTempo, BEATS_PER_BAR, countSignal, (index) => {
            if (mounted.current) setBeat(index);
          });
        },
      } : undefined);
      if (!mounted.current || run !== recordRun.current) { take.abort(); await take.finished.catch(() => {}); return; }
      recording.current = take;
      await take.started;
      if (!mounted.current || run !== recordRun.current) { take.abort(); await take.finished.catch(() => {}); return; }
      changePhase('recording');
      if (withMetronome) beatClock.current = startBeatClock({
        bpm: takeTempo, origin: downbeat,
        onBeat: (index) => { if (mounted.current) setBeat(index % BEATS_PER_BAR); },
      });
      const original = await take.finished; recording.current = undefined;
      if (!mounted.current) return;
      stopBeatClock();
      changePhase('saving'); const analysis = await prepareAnalysis(original);
      if (!mounted.current) return;
      const next = await projects.saveTake(original, analysis, takeTempo);
      if (!mounted.current) return;
      setProject(next); setSelected(next.id); setSourceUrl(URL.createObjectURL(original));
      setNotice('Grabación guardada. Ya podés transcribirla.'); await refresh();
    } catch (failure) { if (mounted.current && run === recordRun.current) setError(errorText(failure)); }
    finally {
      stopBeatClock();
      if (run === recordRun.current) { recording.current = undefined; captureAbort.current = undefined; changePhase('idle'); }
    }
  };
  const open = async () => {
    if (!native || phaseRef.current !== 'idle' || !selected) return;
    audio.current?.pause(); setError(''); changePhase('loading');
    try {
      const [next, original] = await Promise.all([projects.loadProject(selected), projects.originalAudio(selected)]);
      if (!mounted.current) return;
      setProject(next); setSourceUrl(URL.createObjectURL(original)); setTempo(String(next.tempoBpm));
      setNotice(next.tracks.some((track) => track.notes.length) ? 'Proyecto recuperado con su audio y sus notas.' : 'Proyecto recuperado. Podés transcribir su audio.');
    } catch (failure) { if (mounted.current) setError(errorText(failure)); }
    finally { changePhase('idle'); }
  };
  const transcribe = async () => {
    if (!project || !native || phaseRef.current !== 'idle') return;
    audio.current?.pause(); setError(''); changePhase('transcribing');
    try {
      const next = await projects.transcribeTake(project.id);
      if (!mounted.current) return;
      setProject(next); setNotice(next.tracks.some((track) => track.notes.length)
        ? 'Transcripción guardada. Escuchá las notas o descargá el MIDI.'
        : 'No se detectaron notas. La toma puede contener silencio: probá una melodía clara y sin acompañamiento.');
    } catch (failure) { if (mounted.current) setError(errorText(failure)); }
    finally { await cancelAck.current; cancelAck.current = undefined; changePhase('idle'); }
  };
  const cancel = async () => {
    if (phaseRef.current !== 'transcribing') return;
    changePhase('canceling');
    const cancellation = projects.cancelTranscription();
    cancelAck.current = cancellation.catch(() => {});
    try { await cancellation; }
    catch (failure) { if (mounted.current) { setError(errorText(failure)); if (currentPhase() === 'canceling') changePhase('transcribing'); } }
  };
  const play = async () => {
    if (!project || !notes.length || phaseRef.current !== 'idle') return;
    audio.current?.pause(); setError(''); changePhase('piano-loading');
    const run = ++playRun.current;
    try {
      await piano.current.play(notes, project.ppq, project.tempoBpm, () => changePhase('idle'));
      if (mounted.current && run === playRun.current && currentPhase() === 'piano-loading') changePhase('playing');
    } catch (failure) { if (mounted.current && run === playRun.current) { setError(errorText(failure)); changePhase('idle'); } }
  };
  const download = () => {
    if (!project || !notes.length || !idle) return;
    try {
      const url = URL.createObjectURL(new Blob([encodeMidi(notes, project.ppq, project.tempoBpm)], { type: 'audio/midi' }));
      const link = document.createElement('a'); link.href = url; link.download = 'melody.mid'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) { setError(errorText(failure)); }
  };

  return <main>
    <header><div><p className="eyebrow">VOICE TO MUSIC STUDIO</p><h1>VOXEL<span> / 01</span></h1></div><span className="tag">MELODÍA → MIDI</span></header>
    <div className="intro"><h2>Tu voz es el principio.</h2><p>Grabá una melodía. Encontrá sus notas. Escuchala en piano.</p></div>
    {!native && <div className="web-notice" role="status"><strong>Abrí VOXEL en la aplicación de escritorio</strong><p>Esta vista web muestra la interfaz. La grabación, la transcripción local y los proyectos requieren la aplicación de escritorio.</p></div>}
    <div className="workspace">
      <section className="capture" aria-labelledby="capture-title">
        <div className="section-top"><span className="step">01 / CAPTURAR</span><span className="muted">Máx. 30 s</span></div>
        <h3 id="capture-title">Una idea, una toma.</h3><p className="muted">Cantá o tarareá una sola melodía, sin acompañamiento.</p>
        <div className={`record-display ${phase === 'recording' ? 'is-recording' : ''} ${phase === 'counting' ? 'is-counting' : ''}`}>
          <div className="wave" aria-hidden="true">{Array.from({ length: 29 }, (_, i) => <i key={i} style={{ height: `${14 + ((i * 17 + 9) % 57)}%`, animationDelay: `${i * 0.04}s` }} />)}</div>
          <div className="beats" aria-hidden="true">{Array.from({ length: BEATS_PER_BAR }, (_, index) => <i key={index} className={beat === index && (phase === 'counting' || phase === 'recording') ? 'is-beat' : ''} />)}</div>
          <p className="time">{phase === 'recording' ? elapsed.toFixed(1).padStart(4, '0') : '00.0'}<span> / 30 s</span></p>
          <p className="meter-label">{phase === 'counting' ? `Conteo ${Math.max(beat + 1, 1)} de ${BEATS_PER_BAR} · empezá a cantar después del ${BEATS_PER_BAR}`
            : phase === 'recording' ? (metronomeOn ? 'Grabación activa · pulso visual' : 'Grabación activa · sin monitor de nivel')
            : metronomeOn ? 'Un compás de conteo y después la toma' : 'El micrófono se activa al grabar'}</p>
        </div>
        <div className="capture-actions">
          {phase === 'requesting' ? <button className="primary stop" onClick={() => { recordRun.current++; captureAbort.current?.abort(); captureAbort.current = undefined; changePhase('idle'); setNotice('Solicitud cancelada. El micrófono se liberará si se concede el permiso pendiente.'); }}>Cancelar solicitud</button>
            : phase === 'counting' ? <button className="primary stop" onClick={() => { recordRun.current++; captureAbort.current?.abort(); captureAbort.current = undefined; recording.current = undefined; stopBeatClock(); changePhase('idle'); setNotice('Conteo cancelado. No se guardó ninguna toma.'); }}>Cancelar conteo</button>
            : phase === 'recording' ? <button className="primary stop" onClick={() => recording.current?.stop()}>■ Detener grabación</button>
            : <button className="primary" disabled={!native || !idle || !tempoValid} onClick={() => void record()}>● Grabar melodía</button>}
          <label className="tempo">Tempo <span><input aria-label="Tempo en BPM para la próxima grabación" type="number" min="40" max="240" step="1" value={tempo} disabled={!native || !idle} onChange={(event) => setTempo(event.target.value)} /> BPM</span></label>
        </div>
        <label className="metronome-option"><input type="checkbox" checked={metronomeOn} disabled={!native || !idle} onChange={(event) => setMetronomeOn(event.target.checked)} /> <span>Conteo audible y pulso visual del metrónomo</span></label>
        {!tempoValid && <p className="validation">Ingresá un tempo entre 40 y 240 BPM.</p>}
        <p className="fine-print">Cada toma se guarda como un proyecto nuevo. El audio original se conserva.{metronomeOn ? ' Usá auriculares para que el clic no entre en la toma.' : ''}</p>
      </section>
      <section className="result" aria-labelledby="result-title">
        <div className="section-top"><span className="step">02 / TRANSFORMAR</span><span className="muted">Piano · 4/4</span></div>
        <h3 id="result-title">De melodía a notas.</h3><p className="muted">{project ? `${duration.toFixed(1)} s · ${project.tempoBpm} BPM · ${project.ppq} PPQ` : 'Tu próxima melodía comienza acá.'}</p>
        <div className="notes-preview" aria-label={notes.length ? `${notes.length} notas detectadas` : 'Todavía no hay notas'}>
          {notes.length && project ? <svg viewBox="0 0 600 130" role="img" aria-label="Vista de las notas transcritas">
            {notes.map((note, index) => <rect key={`${note.id}-${index}`} x={ticksToSeconds(note.startTick, project.ppq, project.tempoBpm) / Math.max(duration, .1) * 590} y={112 - note.pitch / 127 * 104} width={Math.max(2, ticksToSeconds(note.durationTicks, project.ppq, project.tempoBpm) / Math.max(duration, .1) * 590)} height="5" rx="2" />)}
          </svg> : <div className="empty-notes"><span aria-hidden="true">♩</span><p>{project ? 'Audio listo para transcribir' : 'Todavía no hay una toma'}</p></div>}
        </div>
        <div className="result-actions">
          {phase === 'transcribing' || phase === 'canceling' ? <button disabled={phase === 'canceling'} onClick={() => void cancel()}>{phase === 'canceling' ? 'Cancelando…' : 'Cancelar transcripción'}</button>
            : <button disabled={!native || !project || !idle} onClick={() => void transcribe()}>Transcribir melodía</button>}
          {phase === 'playing' || phase === 'piano-loading' ? <button onClick={() => { playRun.current++; piano.current.stop(); changePhase('idle'); }}>■ Detener piano</button>
            : <button disabled={!native || !notes.length || !idle} onClick={() => void play()}>▶ Escuchar piano</button>}
          <button className="download" disabled={!native || !notes.length || !idle} onClick={download}>↓ Descargar MIDI</button>
        </div>
        <p className="fine-print">{notes.length ? `${notes.length} notas · ` : ''}Piano: <a href="/piano/ATTRIBUTION.txt" target="_blank" rel="noreferrer">Alexander Holm · CC BY 3.0</a></p>
      </section>
    </div>
    <div className="status-line" role="status" aria-live="polite"><span className={`status-dot ${idle ? '' : 'active'}`} /><span>{statuses[phase]}</span><span className="status-detail">{idle ? notice : phase === 'transcribing' ? 'La primera ejecución puede tardar. Podés cancelarla.' : phase === 'counting' ? 'El conteo no forma parte de la toma.' : 'Esperá a que termine esta operación.'}</span></div>
    {error && <div className="error" role="alert"><strong>No se pudo completar la operación.</strong><p>{error}</p></div>}
    <section className="library" aria-labelledby="library-title">
      <div><span className="step">TU ARCHIVO</span><h3 id="library-title">Retomá una idea.</h3><p className="muted">Recuperá una toma guardada en este equipo.</p></div>
      <div className="library-controls"><label htmlFor="saved-project">Proyecto guardado</label><div className="project-select"><select id="saved-project" value={selected} disabled={!native || !idle} onChange={(event) => setSelected(event.target.value)}><option value="">{saved.length ? 'Elegí un proyecto' : 'Sin proyectos guardados'}</option>{saved.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button disabled={!native || !idle || !selected} onClick={() => void open()}>Abrir</button></div></div>
    </section>
    {sourceUrl && <section className="source" aria-labelledby="source-title"><div><span className="step">AUDIO ORIGINAL</span><h3 id="source-title">{project?.name}</h3><p className="muted">Escuchá la fuente de esta melodía.</p></div><audio ref={audio} src={sourceUrl} controls={idle} preload="metadata" aria-label="Escuchar grabación original" /></section>}
    <footer><span>VOXEL / ESTUDIO LOCAL</span><span>Una voz. Una melodía. Un comienzo.</span></footer>
  </main>;
}
