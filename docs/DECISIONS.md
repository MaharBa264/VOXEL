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
| 2026-11-26 | Aceptar M01-A con las limitaciones de transcripción documentadas. | El recorrido manual con voz real, piano, MIDI en MuseScore, reapertura y prueba sin conexión pasó. El usuario aceptó los límites del modelo y pidió registrar propuestas posteriores. |
| 2026-11-26 | Implementar el metrónomo con conteo audible y pulso visual. | El usuario pidió «grabar con un metrónomo que dé el inicio auditivo y que luego marque el tempo visualmente»; se implementó en el orden posterior de M01-A. |
| 2026-11-26 | Implementar el post-proceso monofónico opcional (filtro de armónicos). | El usuario pidió «agregar un postproceso monofónico opcional»; se implementó como filtro en el worker con interruptor desactivado por defecto, sin cambiar el contrato v1. |
| 2026-11-26 | Conectar el selector de tipo de entrada (voz, silbido, percusión) al worker. | El usuario pidió el switch de tarareo/silbido/percusión; se implementó el cableado con el motor actual atendiendo sólo `voice`. |
| 2026-11-26 | Hacer configurable el compás por toma, además del tempo. | El usuario lo pidió como detalle previo a los backtracks. Se eligió un selector en la captura, persistencia en el proyecto v1 y envío al worker para el MIDI; el BPM sigue refiriéndose a la negra y el conteo usa la unidad del denominador. |
| 2026-11-26 | Aprobar e implementar el primer corte de backtracks por estilo. | El usuario aprobó «pop + MIDI» y corrección de acordes por compás. Se implementó análisis armónico local, generación determinista de pistas de acordes y bajo en el proyecto v1 (sin cambiar `schemaVersion`), exportación SMF tipo 1 y opción de silenciar/quitar; quedan fuera varias tomas, audio y otros estilos. |
| 2026-11-26 | Deshabilitar las opciones de silbido y percusión del selector de entrada. | Tras un error del usuario con una opción sin motor, eligió desactivarlas con etiqueta «sin motor aún» en lugar de caer al motor de voz. Se conserva la validación estricta del worker como segunda barrera. |
| 2026-11-26 | Implementar el metrónomo con conteo audible de un compás y pulso visual. | El usuario pidió «grabar con un metrónomo que dé el inicio auditivo y que luego marque el tempo visualmente»; se implementó en el orden posterior de M01-A. |

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

## M01-A aceptado — 2026-11-26

La aceptación manual se completó con una melodía real y se registró en
[STATUS.md](STATUS.md). El usuario aceptó explícitamente M01-A con estas
limitaciones: Basic Pitch descarta por defecto notas menores de 127,7 ms, puede
agregar armónicos como notas extra y no transcribe bien el silbido. La
cancelación manual y el permiso denegado no se repitieron en esa sesión; el E2E
sintético anterior ya los cubría.

La aceptación habilita proponer el hito siguiente, no implementarlo
automáticamente. Las ideas registradas el 2026-11-26 son: posproceso monofónico
opcional, selector de tipo de entrada, metrónomo con conteo audible y
backtracks por estilo. El metrónomo se implementó en esa fecha; las demás viven
como propuestas con estado explícito en [docs/proposals](proposals/README.md).
Percusión, armonización y edición
multipista requieren su propio alcance y aprobación.
