# Selector del tipo de entrada: voz, silbido o percusión

**Estado:** selector conectado al worker vía `--input-kind`. `voice` y
`percussion` están operativos desde el 2026-11-26; `whistle` sigue deshabilitado
y etiquetado «sin motor aún». Ver
[STATUS](../STATUS.md#motor-de-percusión--2026-11-26).

## Problema y contexto

M01-A trata toda captura como una melodía cantada o tarareada. En la aceptación
del 2026-11-26 se comprobó que esa suposición no cubre dos entradas que el
usuario quiere usar:

- **Silbido:** dos tomas agudas produjeron 8 y 2 notas. El espectro era casi un
  tono puro de 1,2–1,7 kHz, sin los ataques y armónicos que espera Basic Pitch.
- **Percusión** (golpes en un escritorio o mesa): no tiene altura musical; el
  modelo de transcripción melódica no es el adecuado.

El usuario pidió un interruptor para declarar si la grabación es tarareo vocal,
silbido o percusión.

## Alternativas

1. **Perfil de procesamiento por tipo de entrada.**
   - Voz/tarareo: Basic Pitch, con el posproceso monofónico opcional.
   - Silbido: estimador monofónico de f0 y segmentación de notas.
   - Percusión: detección de ataques (por ejemplo, flujo espectral) y mapeo a
     instrumentos de percusión General MIDI, sin pitch melódico.
2. **Un solo motor con parámetros distintos.** Ajustar umbrales y rangos de
   frecuencia según el tipo. Menos código nuevo, pero el silbido y la percusión
   siguen fuera del dominio del modelo.
3. **Motores separados por tipo, elegidos en la interfaz.** Más claro para el
   usuario y más fácil de evaluar; implica más superficie de mantenimiento.

## Impacto en el contrato y la persistencia

El proyecto v1 no declara el tipo de entrada ni un tipo de pista. Cualquier
cambio debe decidirse explícitamente:

- agregar un campo opcional `inputKind` sin romper proyectos v1, o
- subir `schemaVersion` con migración y validación mediante `parseProject`.

No se debe migrar sobre el único original ni cambiar el esquema en silencio.
La percusión probablemente necesite una pista con semántica propia (canal 10 de
General MIDI o un `kind` de pista) y un editor distinto del piano.

## Riesgos y límites

- El silbido y la percusión requieren calibración con grabaciones reales.
- La percusión depende de la mesa, el micrófono y el ruido de fondo; la latencia
  y la detección de ataques cambian el resultado.
- Agregar dependencias o modelos afecta el tamaño, las licencias y el
  empaquetado futuro.
- El selector no debe inducir a prometer calidad que todavía no se midió.

## Validación prevista

- Tomas sintéticas y reales por tipo, con resultados registrados por separado.
- Para percusión: comparar cantidad y posición de golpes contra el audio.
- Para silbido: comparar la melodía con un rastreador de f0 independiente.
- Verificar que proyectos existentes sigan abriendo y exportando.

## Decisiones pendientes

- ¿Qué tipos entran en el próximo hito y en qué orden?
- ¿La percusión es una pista de percusión General MIDI o samples propios?
- ¿El tipo de entrada se guarda en el proyecto o sólo selecciona el motor?
- ¿Se admite cambiar el tipo después de grabar?

## Resultado de la implementación

Decisiones tomadas para esta unidad:

- Se agregó el selector de tipo de entrada a la interfaz (voz/tarareo, silbido,
  percusión) y se pasa al worker con el flag `--input-kind`.
- El worker valida el valor: acepta `voice` y `percussion`; `whistle` devuelve
  error explícito sin tocar la inferencia.
- El tipo se envía por petición de transcripción, no se guarda en el proyecto
  (el contrato v1 no varió).
- El 2026-11-26, después de que el usuario informara un error al elegir una
  opción sin motor, se desactivó `Silbido`; `Percusión` se implementó después y
  volvió a habilitarse. La validación del worker se conserva como segunda barrera.
- La percusión usa detección local de ataques (flujo espectral positivo y tres
  bandas de frecuencia) sin cargar Basic Pitch, y escribe notas GM 36/38/42 en
  canal 9 (canal 10 para el DAW). El host crea una pista `percussion` con ese
  canal; el proyecto pasa a admitir hasta cuatro pistas sin cambiar
  `schemaVersion`.

## Validación ejecutada

- `python/test_transcribe.py` cubre golpes sintéticos a 80 Hz, clasificación
  como bombo y escritura en canal 9 sin invocar el modelo.
- `cargo test` incluye una toma real sintética con golpes: crea la pista de
  percusión, comprueba el canal 9 y que la pista de melodía quede intacta.
- `npm.cmd run check`, `npm.cmd run test:python` (15 pruebas),
  `cargo check/test` (15 pruebas) y el E2E nativo en verde. El E2E verifica que
  `Silbido` sigue deshabilitado y que transcribir como percusión crea la pista.
- Pendiente: calibrar con escritorio/micrófono reales, ampliar voces de batería
  y definir el motor de silbido y la persistencia del tipo de entrada.
