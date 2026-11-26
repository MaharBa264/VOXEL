# Hitos de VOXEL

Este documento registra el alcance solicitado y los criterios ya planteados
en la arquitectura. Las casillas pendientes no representan funciones disponibles.

## Inicialización

- [x] Shell React/TypeScript y configuración Tauri 2.
- [x] Contrato de proyecto JSON v1, notas MIDI en PPQ y referencias al audio original.
- [x] Tipos inferidos, validación Zod y JSON Schema generado.
- [x] Pruebas de contrato, build web y smoke HTTP.
- [x] Procedimiento Windows, convenciones de agentes y registro de riesgos.
- [x] Copia a D: verificada por hashes; pruebas repetidas en destino.
- [x] Preparar Rust local en D: y generar Cargo.lock.
- [x] Compilar el shell nativo debug en Windows con Tauri CLI.
- [x] Abrir el shell nativo y verificar visualmente la ventana (captura del usuario).
- [x] Preparar Python 3.11 y fijar dependencias Windows; probar el modelo con audio sintético.

La base web, el build nativo debug y la apertura visual están verificados.
El flujo integrado de captura, inferencia, piano y guardado pasó en WebView2
con stream sintético. Build release, voz real y escucha humana siguen pendientes.

## M01-A — grabar melodía, convertir a MIDI y reproducir piano

Integración implementada y aceptada manualmente el 2026-11-26 con las
limitaciones registradas en [STATUS](STATUS.md). Orden seguido:

1. **Preparar el entorno nativo.** Resolver Rust/Cargo y probar el shell Windows;
   validar Python 3.11 x64 con Basic Pitch 0.4.0 y fijar dependencias reales.
2. **Grabar y conservar.** Probar micrófono y permisos en WebView2, identificar
   el codec realmente emitido y conservar los bytes originales. Crear un
   derivado para el motor sin sobrescribir la toma.
3. **Transcribir localmente.** Definir el contrato de trabajos Rust↔Python,
   errores y cancelación; ejecutar el modelo local sobre una melodía real.
4. **Convertir a notas y MIDI.** Definir redondeo de segundos a PPQ, validar
   notas con el contrato y exportar un archivo MIDI que pueda abrirse externamente.
5. **Reproducir piano.** Iniciar Tone.js desde una interacción explícita,
   resolver recursos locales y sus licencias, y comprobar la salida audible.
6. **Conservar y recuperar.** Implementar el guardado necesario para el flujo
   de proyecto y reabrirlo sin perder fuente, notas ni referencias.

Criterios de aceptación:

- [x] Una grabación de melodía real se conserva y puede recuperarse.
- [x] Inferencia local, errores visibles y cancelación verificados.
- [x] Notas PPQ y MIDI legible, incluidos parser y descarga nativa.
- [x] La melodía se escucha con un piano cuyos recursos no dependen de CDN.
- [x] Guardar y reabrir conserva notas y fuente en el test sintético nativo.
- [x] El flujo se prueba sin conexión una vez aprovisionadas las dependencias y el modelo.
- [x] Se registran entorno, señal sintética, resultados y limitaciones.

La aceptación incluye límites conocidos: Basic Pitch descarta por defecto notas
menores de 127,7 ms y puede agregar armónicos como notas extra; el silbido no
está cubierto. El permiso denegado y la cancelación manual no se repitieron en
la sesión de aceptación, aunque el E2E sintético ya los cubría. Ver el detalle
en [STATUS](STATUS.md).

## Propuestas posteriores a M01-A — 2026-11-26

Solicitadas por el usuario. El metrónomo ya está implementado en desarrollo;
las otras tres siguen siendo propuestas:

- [ ] Posproceso monofónico opcional para reducir armónicos y octavas duplicadas.
  Ver [propuesta](proposals/2026-11-26-monophonic-postprocess.md).
- [ ] Selector del tipo de entrada: voz/tarareo, silbido o percusión.
  Ver [propuesta](proposals/2026-11-26-input-kind.md).
- [x] Metrónomo con conteo audible de un compás y pulso visual durante la toma,
  con interruptor y cancelación del conteo. Ver
  [propuesta](proposals/2026-11-26-metronome.md) y evidencia en
  [STATUS](STATUS.md). La escucha con micrófono real queda pendiente de
  confirmación manual.
- [ ] Armonías y backtracks por estilo (jazz, pop, rock, cumbia, cuarteto, folk)
  a partir de una o varias tomas. Ver [propuesta](proposals/2026-11-26-style-backtracks.md).

## Fuera del alcance actual

Reconocimiento de percusión, armonización, pitch bend, cambios de tempo,
instalador, firma y empaquetado final de Python/modelos necesitan trabajo
posterior explícito. El producto final deberá poder usarse sin exigir una
instalación manual de Python al usuario final. No se asignan fechas ni hitos
adicionales que todavía no se hayan acordado.
