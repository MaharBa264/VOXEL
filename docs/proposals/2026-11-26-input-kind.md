# Selector del tipo de entrada: voz, silbido o percusión

**Estado:** propuesta — solicitada por el usuario el 2026-11-26. No implementada.

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
