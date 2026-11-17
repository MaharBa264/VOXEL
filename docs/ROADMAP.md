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
- [ ] Compilar y abrir el shell nativo en Windows: requiere Rust/Cargo.
- [ ] Generar y revisar Cargo.lock para reproducibilidad de dependencias Rust.

La base web está verificada; la base nativa tiene configuración preparada,
pero no está validada por compilación o apertura de la aplicación.

## M01-A — grabar melodía, convertir a MIDI y reproducir piano

Próximo hito solicitado; todavía sin implementación. Orden de trabajo previsto:

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

- [ ] Una grabación de melodía real se conserva y puede recuperarse.
- [ ] La inferencia se ejecuta sin servicios de IA remotos, con errores visibles.
- [ ] Las notas resultantes usan PPQ entero; el MIDI exportado puede abrirse.
- [ ] La melodía se escucha con un piano cuyos recursos no dependen de CDN.
- [ ] Guardar y reabrir conserva las notas y el audio original.
- [ ] El flujo se prueba sin conexión una vez aprovisionadas las dependencias y el modelo.
- [ ] Se registran entorno, muestras de prueba autorizadas, resultados y limitaciones.

La precisión de transcripción, latencia y recursos del piano deben medirse:
no hay cifras ni calidad garantizadas en esta etapa.

## Fuera del alcance actual

Reconocimiento de percusión, armonización, pitch bend, cambios de tempo,
instalador, firma y empaquetado final de Python/modelos necesitan trabajo
posterior explícito. El producto final deberá poder usarse sin exigir una
instalación manual de Python al usuario final. No se asignan fechas ni hitos
adicionales que todavía no se hayan acordado.
