# VOXEL — Voice to Music Studio

## Estado de desarrollo

Objetivo final: aplicación independiente para Windows 11 x64. La base inicial
evolucionó a M01-A de desarrollo: captura, transcripción local, PPQ/MIDI, piano
y persistencia. El flujo nativo pasó con señal sintética; micrófono físico,
escucha y precisión vocal requieren aceptación manual. Sin percusión ni armonización.

## Límites de los módulos

```text
React (src/app) → contratos puros (src/domain)
     ↓ IPC con comandos tipados y validación
Tauri/Rust (src-tauri) → archivos locales / proceso Python
     ↓ proceso local cancelable, resultado versionado v1
Python + Basic Pitch (python/transcribe.py)

React → src/audio/piano.ts → Tone.Sampler → Web Audio / salida del equipo
```

- `src/app`: presentación. No importa Python ni controla el sistema de archivos.
- `src/domain`: contratos sin React, Tauri, red ni Web Audio. Zod valida datos
  externos e infiere los tipos TypeScript; no se confía en un cast de JSON.
- `src/audio`: captura MediaRecorder, WAV mono PCM16, exportador SMF y piano.
  El permiso y Web Audio parten de gestos del usuario.
- `src/services`: IPC y validación de proyectos con parseProject.
- `src-tauri/src/host.rs`: almacenamiento, validación de límites y rutas,
  comandos explícitos y un proceso Python exclusivo con cancelación/timeout.
- `python/transcribe.py`: valida WAV, filtra silencio, ejecuta el modelo CPU
  local y convierte a PPQ. Publica resultado JSON v1 y MIDI de esas mismas notas.
- Piano: cinco samples Salamander CC BY 3.0 incluidos en `public/piano`.
  Tone.Part programa ataques/finales; detener cancela eventos y libera voces.

No hay servidor HTTP de inferencia, telemetría ni servicios de IA remotos.
El servidor Vite es sólo de desarrollo y escucha en loopback. Las instalaciones
de dependencias requieren red; el producto deberá procesar audio sin red.
La política CSP de producción restringe recursos al paquete y no abre acceso general a red.

## Contrato de proyecto v1

Fuente única: `src/domain/project.ts`. JSON Schema Draft 2020-12 generado en
`schemas/`, con tipos inferidos `Project` y `MidiNote`.
Los esquemas exportados cubren la estructura; `parseProject(unknown)` aplica
además las reglas relacionales y de rutas. Python deberá replicar estas reglas
o delegar la validación final al host; JSON Schema solo no es suficiente.
Versiones distintas de `schemaVersion: 1` y campos desconocidos se rechazan.
Una migración futura deberá ser explícita y preservar el original antes de escribir.

| Campo | Semántica |
| --- | --- |
| `schemaVersion` | Versión del formato, independiente de la versión de la app |
| `id`, `name` | Identificador estable opaco y nombre visible no vacío |
| `ppq` | Entero 1–32767, ticks por negra (compatible con división PPQ de SMF) |
| `tempoBpm` | Número positivo finito, un único tempo en v1 |
| `timeSignature` | Numerador 1–255; denominador potencia de dos 1–128 |
| `audioAssets` | Referencias y metadatos del audio original, sin bytes en JSON |
| `tracks` | Pistas de notas con canal MIDI y programa GM en base cero |

Cada nota tiene `id`, `pitch` entero 0–127, `velocity` entero 1–127,
`startTick` entero seguro ≥0 y `durationTicks` entero seguro >0.
El extremo final también debe ser entero seguro. Velocity 0 es note-off en MIDI
y no representa una nota persistida. Canal 0–15 y programa 0–127; piano GM = 0.
La afinación expresiva/pitch bend, cambios de tempo y controladores quedan fuera de v1.
Los solapamientos son válidos. No se cuantiza ni redondea al cargar.
En tempo constante: segundos = ticks × 60 / (ppq × tempoBpm).
La conversión implementada redondea al tick más cercano, con empates hacia arriba;
limita notas a la duración de análisis y asegura al menos un tick. Exporta SMF0.
La UI M01-A limita tempo a 40–240 BPM, PPQ a 480 y compás a 4/4.

`sourceAudioId` es opcional en cada pista; si existe debe resolver a un asset.
IDs de assets y pistas son únicos en sus respectivas colecciones; IDs de notas
son únicos dentro de cada pista. Un audio puede originar varias pistas.

## Conservación del audio

Formato físico previsto: carpeta de proyecto con `project.json` y `audio/`.
`examples/empty-project.json` es un ejemplo sin archivos externos.
Cada asset declara ID, ruta `audio/...`, MIME, sample rate, canales y duración.
Se permiten WAV, WebM y Ogg como metadatos; esto no garantiza codecs de captura
ni decodificación. M01-A debe probar el formato realmente emitido por WebView2.
No borrar ni sobrescribir el audio original al editar/transcribir notas. Crear
derivados separados para resampling y conversión mono, manteniendo la fuente.

Rutas con `/`, relativas a la carpeta del proyecto; se rechazan rutas absolutas,
UNC, traversal, barras inversas, segmentos vacíos, nombres reservados de Windows
y caracteres no portables. El contrato por sí solo no comprueba archivos.
El host M01-A valida proyectos propios con UUID, una pista y un original;
rechaza reparse points y escapes. No es un importador arbitrario del formato.
La metadata de fuente refleja su decodificación Web Audio (sample rate del
contexto y canales decodificados), no una inspección del header comprimido.

## Guardado y ejecución M01-A

Cada toma se conserva en `projects/<UUID>` bajo el workspace compilado:
`audio/original.webm|ogg|wav`, `audio/analysis.wav`, `project.json` y `melody.mid`.
El original se crea una vez. El derivado es mono PCM16 de máximo 30 s; el
original puede conservar hasta 32 s por colas del codec y demora de stop.
El host valida duración, RIFF/PCM, IDs, notas y tamaño máximo de 16 MiB por audio.

Se ejecuta sólo el Python/worker del workspace, sin shell ni servidor HTTP.
Cada intento crea `job-<UUID>` con resultados y log. Timeout: 180 s. Cancelar
o cerrar mata y recoge el hijo antes de liberar el trabajo. Los originales
y los diagnósticos se conservan, también ante errores.

JSON y MIDI se reemplazan atómicamente por archivo; se intenta revertir el
MIDI si falla JSON. No hay transacción conjunta frente a corte de energía.
La UI exporta MIDI desde las notas del JSON, que es el estado autoritativo.
La biblioteca abre tomas propias; selección de carpeta, importación externa,
edición de notas, gestión de espacio y coordinación multiinstancia están pendientes.
El runtime depende de rutas del workspace de desarrollo; falta el empaquetado final.

## Decisiones y alternativas

Se adopta un solo paquete npm con módulos por responsabilidad: permite probar
contratos sin arrancar el escritorio. Un monorepo añadiría coordinación sin
un segundo paquete real. Zod evita mantener manualmente tipos y validadores
duplicados; los JSON Schema generados permiten futuros consumidores Python.
Se conserva audio por archivos frente a base64 en JSON para evitar inflación
y permitir derivados. La carpeta exige diseñar guardado atómico y traslado;
un contenedor ZIP queda diferido, no se presenta como soporte actual.

Se verificó Python 3.11.15 x64 con Basic Pitch 0.4.0, TensorFlow CPU 2.14.0,
NumPy 1.26.4 y setuptools 81.0.0. El entorno se instala en el proyecto y usa
el modelo local de Basic Pitch; las pruebas no simulan su inferencia.
No usar los Python 3.12/3.14 locales para forzar otra combinación sin soporte.
La app final deberá incluir runtime y modelo locales: exigir Python instalado
al usuario final no cumple la independencia prevista. El bootstrap con uv
es una herramienta de desarrollo, no una solución de distribución final.

## Criterios del siguiente hito

1. Probar micrófono, permiso y formato de audio en la aplicación Windows real.
2. Conservar grabación original, producir un derivado apto para Basic Pitch.
3. Resolver y fijar Python/runtime/modelo con inferencia local reproducible.
4. Definir errores, cancelación y protocolo Rust↔Python; validar todas las entradas.
5. Convertir tiempos a PPQ con política explícita de redondeo y exportar SMF.
6. Reproducir con piano local y probar latencia; samples y licencias sin CDN.
7. Guardar/reabrir el proyecto sin perder notas ni audio; probar sin conexión.
