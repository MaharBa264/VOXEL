# VOXEL — Voice to Music Studio

## Alcance de la inicialización

Aplicación independiente para Windows 11 x64. Esta entrega contiene un shell
React/TypeScript, configuración Tauri 2, contratos de proyecto y pruebas.
No graba, transcribe, genera MIDI, reproduce audio ni armoniza todavía.
El siguiente hito es M01-A: grabar una melodía, convertirla a MIDI y reproducirla con piano.

## Límites de los módulos

```text
React (src/app) → contratos puros (src/domain)
     ↓ futuro IPC con comandos tipados y validación
Tauri/Rust (src-tauri) → archivos locales / proceso Python
     ↓ futuro protocolo de trabajos versionado
Python + Basic Pitch (python, aún sin implementación)

React → futuro adaptador Tone.js → Web Audio / salida del equipo
```

- `src/app`: presentación. No importa Python ni controla el sistema de archivos.
- `src/domain`: contratos sin React, Tauri, red ni Web Audio. Zod valida datos
  externos e infiere los tipos TypeScript; no se confía en un cast de JSON.
- `src-tauri`: ciclo de vida nativo. No registra comandos ni plugins en esta etapa.
  Futuramente será responsable de rutas seguras, guardado atómico, trabajos,
  cancelación y arranque/cierre del proceso Python.
- `python`: reserva documental para el transcriptor local. La interfaz entre
  procesos, el empaquetado y el lock de dependencias se decidirán antes de M01-A.
- Tone.js está fijado como dependencia; aún no tiene adaptador ni instancias.
  El futuro adaptador debe iniciar Web Audio desde un gesto explícito y liberar recursos.

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
Esto documenta unidades; aún no implementa conversión ni exportación MIDI.

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
y caracteres no portables. El futuro host debe resolver rutas, comprobar que
permanecen dentro del proyecto (incluyendo enlaces/reparse points), verificar
existencia y contenido real. El contrato no comprueba archivos ni garantiza
que los metadatos coincidan con sus bytes. No hay persistencia implementada.

## Decisiones y alternativas

Se adopta un solo paquete npm con módulos por responsabilidad: permite probar
contratos sin arrancar el escritorio. Un monorepo añadiría coordinación sin
un segundo paquete real. Zod evita mantener manualmente tipos y validadores
duplicados; los JSON Schema generados permiten futuros consumidores Python.
Se conserva audio por archivos frente a base64 en JSON para evitar inflación
y permitir derivados. La carpeta exige diseñar guardado atómico y traslado;
un contenedor ZIP queda diferido, no se presenta como soporte actual.

Se reserva Python 3.11 x64 como candidato para Basic Pitch 0.4.0. No usar los
Python 3.12/3.14 locales para forzar una combinación sin soporte. No se instala
el motor ni se simula su resultado. La app final deberá incluir runtime y modelo
locales: exigir Python instalado al usuario final no cumple la independencia prevista.

## Criterios del siguiente hito

1. Probar micrófono, permiso y formato de audio en la aplicación Windows real.
2. Conservar grabación original, producir un derivado apto para Basic Pitch.
3. Resolver y fijar Python/runtime/modelo con inferencia local reproducible.
4. Definir errores, cancelación y protocolo Rust↔Python; validar todas las entradas.
5. Convertir tiempos a PPQ con política explícita de redondeo y exportar SMF.
6. Reproducir con piano local y probar latencia; samples y licencias sin CDN.
7. Guardar/reabrir el proyecto sin perder notas ni audio; probar sin conexión.
