# VOXEL — Punto de partida y objetivos

Revisión del 25 de noviembre de 2026.

## De dónde partimos

VOXEL nació de una idea de composición por capas: cantar, tararear, silbar o marcar un ritmo con golpes y convertir esas tomas en material musical editable. El primer hito, M01-A, redujo esa idea a un recorrido concreto para Windows 11 x64: grabar una línea melódica, convertirla a MIDI, escucharla con un piano y poder recuperarla después.

La base publicada incluye la aplicación de desarrollo en Tauri 2 y React/TypeScript, el procesamiento local con Python y Spotify Basic Pitch, y la reproducción con Tone.js y muestras de piano incluidas. El proyecto conserva el original de cada toma y crea un WAV derivado para el análisis. Guarda las notas como posiciones y duraciones en ticks PPQ, exporta MIDI y permite reabrir tomas propias. En esta etapa cada toma crea un proyecto con una pista, tempo fijo y hasta 30 segundos de captura. Para ejecutar la aplicación todavía se necesita el entorno de desarrollo. [Arquitectura](ARCHITECTURE.md) · [Estado y evidencias](STATUS.md)

| Aspecto | Estado al 25 de noviembre |
| --- | --- |
| Recorrido nativo | La prueba registrada en Windows/WebView2 usó una señal sintética de 440 Hz e hizo inferencia real. Verificó guardado, notas, descarga MIDI, señal de piano, cancelación y recuperación. |
| Aceptación musical | Sigue pendiente comprobar el micrófono físico, la fidelidad de alturas y tiempos con una melodía humana, la escucha del piano, la apertura del MIDI en una DAW y la recuperación después de reiniciar. |
| Uso sin conexión | El procesamiento está diseñado para ser local. Falta la prueba manual de extremo a extremo con el equipo desconectado. |
| Edición y distribución | La edición de notas, la composición multipista y el instalador independiente siguen pendientes. |

Los resultados de pruebas corresponden a las ejecuciones registradas por el proyecto. Esta revisión fue de lectura y no repitió las pruebas. [Protocolo de aceptación](M01-A-TESTING.md)

## Objetivo inmediato

Cerrar M01-A con una melodía real corta y sin acompañamiento, siguiendo el protocolo de Windows. Comprobar que se conserva y puede escucharse la toma original, que el MIDI generado representa razonablemente lo cantado, que el piano se oye y se detiene correctamente, que el archivo abre en una DAW y que al reiniciar se recuperan la toma y sus notas. Repetir el recorrido con la red desconectada y dejar los resultados en `STATUS.md`. Si aparece un bloqueo, corregirlo y repetir la prueba antes de abrir otro hito. [Decisión vigente](DECISIONS.md) · [Roadmap](ROADMAP.md)

## Objetivo de producto

Crear un estudio local para Windows 11 que permita componer por capas en una línea de tiempo compartida:

- Partir de una toma cantada, tarareada o silbada y convertirla en notas editables, conservando razonablemente la altura, el ritmo y la duración. Usarla como melodía, bajo u otra parte instrumental.
- Partir de una progresión de acordes, reproducirla y grabar nuevas capas encima. También poder pedir una propuesta de armonía a partir de una melodía y luego escucharla, elegirla o editarla.
- Convertir golpes o palmas grabados con el micrófono en patrones de percusión editables y escucharlos junto al resto del proyecto.
- Conservar el audio original junto a los resultados editables y operar localmente. La distribución final debe incluir el runtime y el modelo, sin exigir una instalación manual de Python.

La secuencia de los hitos posteriores, los métodos de detección y la edición de acordes quedan por definir después de la aceptación de M01-A. [Visión confirmada](VISION.md) · [Roadmap](ROADMAP.md)

## Referencia entre equipos

GitHub es el registro compartido de fuentes, decisiones y propuestas. Al comenzar esta revisión, `main` en GitHub tenía tres commits de documentación por delante de la copia local `f01eb3f`: la visión, el registro de decisiones y sus enlaces desde el README. La comparación no mostró cambios de código entre ambas referencias. Los resultados de aceptación deben quedar en GitHub; las tomas personales permanecen en el equipo. [Comparación de partida](https://github.com/MaharBa264/VOXEL/compare/f01eb3fd5c0ae7057dcbb6d91d54368eb82cc737...main) · [Flujo de desarrollo](DEVELOPMENT.md)
