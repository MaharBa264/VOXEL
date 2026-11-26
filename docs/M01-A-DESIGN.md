# M01-A — integración mínima

Alcance autorizado: grabar melodía, conservar fuente, transcribir localmente,
notas PPQ, exportación MIDI y reproducción con piano. Sin percusión ni armonización.

Se mantiene React/Tauri/Python/Tone y contrato de proyecto v1. Captura con
MediaRecorder (hasta 30 segundos), conservando el blob original. Web Audio
decodifica y genera un derivado WAV PCM16 mono; no sustituye el original.
Tempo editable 40–240 BPM, PPQ 480, compás 4/4, piano GM programa 0. Este
documento describe el alcance original de M01-A; desde el 2026-11-26 el compás
se puede elegir por toma, según
[la propuesta](proposals/2026-11-26-time-signature.md).

Rust crea carpetas `projects/<UUID>` dentro del workspace de desarrollo en D:;
no acepta rutas arbitrarias del frontend. Guarda `audio/original.<ext>`,
`audio/analysis.wav`, `project.json` y `melody.mid`. Debe validar tamaño y
metadatos, impedir traversal y escapes por enlaces, y guardar JSON mediante
reemplazo atómico. Los originales nunca se sobrescriben. El paquete final y
la selección de carpeta de usuario permanecen fuera de esta entrega de desarrollo.

IPC frontend→host:

- `save_take({original: number[], mimeType: string, wav: number[], sampleRateHz: number,
  channels: number, durationSeconds: number, analysisDurationSeconds: number,
  tempoBpm: number})` → Project v1 vacío de notas pero con pista.
- `transcribe_take({projectId: string})` → Project v1 con notas; trabajo exclusivo cancelable.
- `cancel_transcription()` → void.
- `list_projects()` → `{id: string, name: string}[]`.
- `load_project({projectId: string})` → Project v1.
- `get_original_audio({projectId: string})` → `{bytes: number[], mimeType: string}`.

Rust invoca exclusivamente `.venv/Scripts/python.exe -I python/transcribe.py`
con `--input <analysis.wav> --output <result.json> --midi <melody.mid>
--tempo <BPM> --ppq 480`. Sin shell ni servidor HTTP. Python escribe
`{protocolVersion: 1, notes: MidiNote[], silence: boolean}`. Los tiempos se
redondean al tick más cercano, se limitan a la duración de entrada y tienen
duración mínima de un tick. Velocity se redondea y limita a 1–127. Se ignora
pitch bend en v1. El MIDI se genera desde esas notas convertidas, no desde
tiempos distintos. Silencio se detecta antes de llamar al modelo.

Se limita un trabajo a la vez; cancelación y timeout matan y recogen el proceso
hijo. Un fallo no sustituye el último proyecto válido. La UI valida respuestas
con parseProject y muestra errores; operaciones incompatibles se deshabilitan.

Tone.Sampler reproduce samples de piano locales con atribución/licencia incluida;
se inicia desde un gesto del usuario y libera recursos al detener/cerrar.
No descarga samples o modelos al transcribir o reproducir.

## Plan y pruebas

1. Python: CLI de trabajo y conversión PPQ, pruebas de límites/silencio y prueba
   real de La4 con exportación MIDI. Propiedad: worker Python.
2. Rust: almacenamiento, validación, proceso cancelable y comandos, con pruebas
   de rutas/datos/persistencia y ejecución del worker. Propiedad: worker Rust.
3. React: captura, WAV, estados y piano a través de IPC. Propiedad: worker UI.
4. Integración: assets de piano con licencia, contratos entre módulos, pruebas
   completas JS/Python/Rust, build nativo y documentación. Propiedad: agente principal.

No se borran cambios existentes ni se hacen commits/push. Las pruebas con
fixtures no acreditan precisión vocal ni escucha real: se registran por separado
los pasos que necesitan verificación manual en Windows.
