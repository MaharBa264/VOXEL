# Posproceso monofónico opcional

**Estado:** propuesta — solicitada por el usuario el 2026-11-26. No implementada.

## Problema y contexto

M01-A transcribe una sola voz con Spotify Basic Pitch 0.4.0, un modelo
polifónico. En la aceptación manual del 2026-11-26 el resultado fue reconocible
pero con errores audibles:

- En la toma `244b80dc` el modelo emitió D#5 sobre un D#4 y G4/D5 sobre un G3.
- En la toma `7d376213` agregó C#5 y G#5 como 2.º y 3.er armónico de C#4.
- Las notas menores de 127,7 ms se descartan por el valor predeterminado de
  `minimum_note_length`.

El usuario aceptó M01-A con estas limitaciones y pidió un posproceso monofónico
opcional para mejorar la fidelidad sin abandonar el modelo actual.

## Alternativas

1. **Filtro posterior en `python/transcribe.py`.** Partir de los eventos del
   modelo y eliminar duplicados de octava/quinta cuando se solapan y uno es
   armónico del otro; opcionalmente fusionar fragmentos contiguos. Ventaja:
   cambio local, sin dependencias nuevas. Riesgo: heurísticas que borren notas
   reales o elijan la octava equivocada.
2. **Estimador monofónico para voz.** Usar un rastreador de f0 (por ejemplo
   pyin de librosa, ya presente como dependencia de Basic Pitch) y derivar notas
   con segmentación. Ventaja: adecuado a una sola voz. Riesgo: otro
   comportamiento, latencia y calibración; deja de aprovechar Basic Pitch.
3. **Cambiar de modelo.** Un modelo específicamente melódico o entrenado para
   voz. Ventaja: podría ser más preciso. Riesgo: tamaño, licencia, runtime local
   y empaquetado; queda fuera de una corrección acotada.

## Recomendación

Implementar la alternativa 1 como opción **desactivada por defecto**, con un
interruptor en la interfaz y pruebas sobre listas de eventos. Antes de
activarla por defecto, comparar tomas reales con y sin filtro y registrar el
resultado. No modificar el contrato v1: el filtro produce las mismas notas PPQ.

## Riesgos y límites

- No existe una verdad de referencia grabada; la evaluación depende de escucha
  humana y de un rastreador independiente.
- Un armónico puede ser la única señal detectable de una nota; eliminarlo por
  regla puede dejar silencio.
- Las notas cortas y el vibrato seguirán siendo límites del modelo.
- El filtro no debe alterar el audio original ni impedir reintentar.

## Validación prevista

- Pruebas unitarias de Python con listas de eventos sintéticas: duplicado de
  octava, quinta, notas simultáneas legítimas y notas sin solapamiento.
- Repetir una toma cantada conocida y comparar alturas, omisiones y octavas.
- Confirmar que el MIDI y el proyecto siguen validando con `parseProject`.
- Medir que el flujo siga funcionando sin conexión.

## Decisiones pendientes

- ¿Interruptor visible o aplicación automática sólo para entradas de voz?
- ¿Se conserva también la salida cruda del modelo para comparar?
- Umbrales de solapamiento, relación de armónico y amplitud.
- Prioridad frente a las demás propuestas posteriores a M01-A.
