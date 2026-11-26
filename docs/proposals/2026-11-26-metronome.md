# Metrónomo con conteo audible y marca visual del tempo

**Estado:** implementada en desarrollo el 2026-11-26. Ver la evidencia en
[STATUS](../STATUS.md#metrónomo-conteo-audible-y-pulso-visual--2026-11-26).
La prueba automatizada es sintética; el usuario confirmó manualmente el conteo
y el pulso con micrófono real. Desde el 2026-11-26 el compás del conteo se puede
elegir: [propuesta](2026-11-26-time-signature.md).

## Problema y contexto

Hoy la grabación empieza apenas se concede el micrófono. El usuario no tiene
referencia de tempo antes de cantar y el tempo se fija con un campo numérico.
Para tomar melodías que después se acompañen, el usuario pidió:

- un conteo auditivo antes de grabar, y
- una marca visual del tempo durante la toma.

## Diseño propuesto

- **Conteo previo:** un compás (o la cantidad que se decida) de clics audibles
  al BPM elegido, con acento en el primer pulso. La grabación de la voz empieza
  después del conteo.
- **Pulso visual:** durante la toma, un indicador de pulso y de compás sigue el
  tempo sin emitir sonido, para no contaminar la grabación con el clic.
- **Sin clics en el original:** el audio guardado y el WAV derivado no deben
  incluir el conteo. El tempo del proyecto sigue siendo el ya declarado en el
  contrato v1.
- **Rango actual:** 40–240 BPM, 4/4, PPQ 480, sin cambios de tempo.

## Alternativas

1. **Web Audio/Tone.js con planificador de pulsos.** Usa la infraestructura
   local existente; el clic es sintético y no requiere archivos externos.
2. **Archivo de clic pregrabado.** Simple, pero agrega un recurso y no se adapta
   al acento ni al tempo con la misma precisión.
3. **Conteo sólo visual.** Evita el riesgo de que el micrófono capture el clic,
   pero no cumple el pedido de referencia auditiva.

## Riesgos y límites

- Si el usuario no usa auriculares, el micrófono puede captar el clic y
  confundir la transcripción. Debe advertirse en la interfaz.
- La latencia de salida y de entrada puede desalinear el primer pulso; conviene
  medirla y documentar que no hay compensación automática en esta etapa.
- Un conteo audible no corrige la deriva del usuario durante la toma.
- No se debe prometer detección automática de tempo: el tempo sigue siendo un
  valor elegido por el usuario.

## Validación prevista

- Prueba con clics sintéticos: medir intervalos y comparar con el BPM elegido.
- Verificar que el original y el WAV derivado no contengan el conteo.
- Grabar con y sin auriculares y registrar la diferencia.
- Confirmar que el flujo sigue funcionando sin conexión.

## Decisiones todavía abiertas

- ¿El conteo debe poder configurarse (medio compás, dos compases)?
- ¿Volumen y timbre del clic ajustables por el usuario?
- ¿Compensación de latencia automática cuando se conozca la del equipo?
- ¿Un modo de conteo sólo visual para tomas sin auriculares?

## Resultado de la implementación

Decisiones tomadas para esta unidad, revisables después de la prueba manual:

- Un compás de 4/4 (cuatro pulsos) al BPM elegido, con acento en el primero.
  El micrófono se pide antes del conteo y la grabación empieza en el quinto
  pulso.
- Clic sintetizado con Web Audio y programado sobre el reloj del
  `AudioContext`; no agrega archivos ni tráfico de red.
- El pulso visual sigue durante toda la toma y se calcula desde el
  `performance.now()` del downbeat, sin sonido y sin acumular deriva.
- El metrónomo está activado por defecto y se puede desactivar con un
  interruptor; al desactivarlo se conserva el flujo anterior.
- Volumen y timbre fijos por ahora. No hay compensación de latencia ni
  detección automática de tempo.
- Pruebas: cinco unitarias de temporización y un E2E nativo sintético que
  comprueba el estado visible, la cancelación del conteo, la liberación del
  micrófono, que el temporizador no avance durante el conteo y que los clics
  produzcan señal de audio (`countInPeak` 0.311).

