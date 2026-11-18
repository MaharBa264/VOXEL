# Decisiones de VOXEL

Este registro conserva las decisiones de producto y arquitectura entre equipos.
Las pruebas y sus límites se registran en [STATUS.md](STATUS.md). El alcance
está en el [roadmap](ROADMAP.md).

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-11-17 | Capturar en Windows con WebView2 y conservar el audio original con Tauri. | WebView2 ya forma parte de la aplicación y el original queda disponible para reintentar o generar derivados. |
| 2026-11-17 | Usar CPython 3.11 y Basic Pitch 0.4.0 para M01-A. | La combinación fijada permitió comprobar la inferencia local. |
| 2026-11-18 | Usar GitHub como registro compartido de código, decisiones y propuestas. | Permite retomar desde otro equipo con los cambios y su contexto. Las propuestas abiertas viven en [docs/proposals](proposals/README.md). |
| 2026-11-18 | Pausar funcionalidades nuevas hasta hacer la aceptación manual de M01-A. | El recorrido integrado ya pasó en WebView2 con audio simulado. El paso pendiente es probar el resultado con micrófono, oído y archivos reales. |

## Cierre de M01-A

En la versión de GitHub, verificar un solo recorrido completo con una melodía
corta y sin conexión. Confirmar que la interfaz indica que graba, que guarda el
original, que genera MIDI localmente, que el piano se oye, que el MIDI abre en
una DAW y que el proyecto conserva la toma y sus notas al reiniciar. Seguir
la [prueba manual](M01-A-TESTING.md) y registrar resultados en [STATUS.md](STATUS.md).

Si algo falla, corregir el bloqueo y repetir la prueba. Al pasar, cerrar M01-A
y decidir explícitamente si se abre otro hito. Percusión, armonización,
empaquetado e instalador quedan para una decisión posterior.

En la copia anterior de este equipo apareció un segundo WebM después de la
prueba sintética conocida. Eso confirma un guardado adicional. Su origen y
contenido audible no se verificaron, por lo que no acredita la aceptación.
