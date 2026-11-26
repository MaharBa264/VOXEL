# Armonías y backtracks por estilo a partir de una o varias tomas

**Estado:** propuesta — idea del usuario registrada el 2026-11-26. No inmediata,
no implementada y sin decisión de diseño.

## Problema y contexto

La visión de producto es componer por capas. El usuario imagina partir de una
melodía —una sola toma o varias— y obtener un acompañamiento o backtrack con un
carácter reconocible: jazz, pop, rock, cumbia, cuarteto, folk, entre otros.
También imagina el camino inverso: partir de acordes y grabar encima.

M01-A sólo tiene un proyecto por toma, una pista y tempo fijo. Para esta idea
hacen falta, como mínimo, varias capas en una línea de tiempo común, análisis
armónico y un motor de acompañamiento.

## Alternativas

1. **Motor basado en reglas.**
   - Detectar tonalidad y acordes candidatos a partir de la melodía.
   - Elegir una progresión con gramática funcional y estilo.
   - Renderizar ritmo, voicings y bajo con Tone.js/MIDI.
   - Ventajas: local, transparente, editable, sin modelos grandes ni licencias
     de generación.
   - Riesgos: la calidad depende del diseño musical; los estilos pueden sonar
     genéricos.
2. **Modelo generativo local.**
   - Generar MIDI o audio acompañante con un modelo entrenado.
   - Ventajas: variedad y naturalidad potenciales.
   - Riesgos: tamaño, latencia, licencias, reproducibilidad, calidad variable y
     dificultad para editar el resultado.
3. **Híbrido.** Reglas para armonía y forma; modelo sólo para variaciones o
   instrumentación. Más complejo.

## Recomendación

Empezar por la alternativa 1 y por una sola capa de acompañamiento MIDI
editable, después de resolver varias tomas en una línea de tiempo común. Antes
de generar audio, producir notas y acordes que el usuario pueda escuchar,
silenciar y corregir. Evaluar el resultado con melodías conocidas antes de
prometer estilos.

## Prerrequisitos

- Proyecto con varias tomas y una línea de tiempo compartida.
- Pistas con semántica (melodía, acordes, bajo, percusión) y mezcla básica.
- Análisis de tonalidad y acordes, con corrección manual.
- Definición de qué significa "estilo": progresión, ritmo, voicing,
  instrumentación y mezcla, no sólo una etiqueta.
- Decisión sobre MIDI editable frente a audio generado.

## Riesgos y límites

- La calidad musical es subjetiva; hace falta una forma de evaluarla y de
  descartar resultados.
- Los estilos tienen convenciones culturales; evitar caricaturas y documentar
  las fuentes y decisiones.
- Un modelo generativo puede ser incompatible con el requisito de operar local
  y distribuir el runtime.
- No se debe presentar una propuesta como función aprobada ni prometer fechas.

## Validación prevista

- Progresiones y melodías conocidas con tonalidad y acordes esperados.
- Escucha comparativa de variantes por estilo.
- Verificar que el acompañamiento se pueda silenciar, editar y exportar.
- Confirmar funcionamiento sin conexión y con licencias compatibles.

## Decisiones pendientes

- ¿El acompañamiento es MIDI editable, audio, o ambos?
- ¿Qué estilos se abordan primero y con qué referencias?
- ¿Se parte de una melodía, de acordes, o de ambos?
- ¿Reglas, modelo o híbrido? ¿Qué licencia y tamaño se aceptan?
- ¿Cómo se evalúa la calidad y quién la aprueba?
