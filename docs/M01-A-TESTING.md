# M01-A — pruebas y aceptación

## Estado

Integración implementada y comprobada en WebView2 con entrada sintética.
La aceptación con micrófono físico, voz humana, escucha y equipo desconectado
está pendiente. Sin percusión, armonización, edición de notas ni instalador.

## Repetir pruebas

Con los entornos locales preparados, desde la raíz:

```powershell
npm.cmd run check
npm.cmd run test:python
npm.cmd run rust:local -- cargo test --locked --manifest-path src-tauri/Cargo.toml
npm.cmd run desktop:build:local -- --debug
npm.cmd run test:desktop
```

Resultados actuales: 69 casos JS, 7 Python y 12 Rust. Python/Rust llaman al
modelo real y pueden tardar. `smoke:web` sólo comprueba HTTP y transformación.

`test:desktop` requiere debug actualizado y puerto loopback 9337 libre.
Playwright se conecta al WebView2 instalado vía CDP con un perfil exclusivo;
no descarga un navegador ni cambia variables persistentes. No activar CDP en
el uso normal. La entrada sustituye getUserMedia por un MediaStream real de
440 Hz generado con Web Audio: nunca solicita el micrófono físico.
MediaRecorder, decoder, IPC Tauri, almacenamiento Rust, Python/Basic Pitch,
exportación y Tone.Sampler son reales.

El test comprueba permiso denegado, cancelación de permiso con stream tardío,
tracks liberados, guardado de fuente/WAV, transcripción MIDI 69, señal de piano
no nula, parada, descarga MIDI, cancelación conservando notas y recuperación.
Falla ante excepciones, errores de consola/CSP o peticiones externas de página.

Guarda informe, captura y tomas en `.cache/desktop-test/<UUID>`; el host debug
acepta sólo UUID canónico en VOXEL_TEST_RUN_ID bajo ese prefijo fijo. Release
ignora la variable. Tres tomas de los primeros intentos se archivaron en
`.cache/desktop-test/legacy-synthetic-projects`, sin borrar archivos. Los
perfiles/logs se acumulan; no hay limpieza automática.

El bloqueo de página y el guard de sockets Python del smoke de runtime no
son un firewall de todo el SO. La nota sintética no mide precisión vocal.

## Aceptación manual Windows

1. Abrir `npm.cmd run desktop:dev:local`; probar permitir y denegar micrófono.
2. Grabar 5–10 s de una melodía clara sin acompañamiento. Detener y comprobar
   que se apaga el indicador de micrófono del sistema.
3. Escuchar el original y comprobar su archivo en `projects/<UUID>/audio`.
4. Transcribir; comparar alturas, notas omitidas/extra y tiempos con lo cantado.
5. Escuchar piano y detener a mitad: no deben quedar voces sonando.
6. Descargar MIDI y abrir en una DAW/editor independiente.
7. Cerrar y reabrir; recuperar fuente y notas. Cancelar otra transcripción y reintentar.
8. Con dependencias/modelo presentes, desconectar la red y repetir el flujo.

Registrar resultados reales en STATUS; no marcar estos pasos con el test sintético.
No enviar grabaciones a servicios remotos ni prometer transcripción perfecta.

## Límites

Guardado fijo en el workspace, un proyecto por toma, una pista y tempo constante.
La onda animada es decorativa y está etiquetada sin monitor de nivel. El host
permite hasta 32 s de fuente por colas del codec, con derivado de máximo 30 s.
El piano transpone cinco samples A2–A6; no incluye todas las capas del original.
JSON y MIDI son atómicos por archivo con rollback de MIDI si falla JSON, sin
transacción conjunta ante corte de energía. El JSON es autoritativo para exportar.
La aplicación requiere `.venv` y el workspace; falta distribución independiente.
