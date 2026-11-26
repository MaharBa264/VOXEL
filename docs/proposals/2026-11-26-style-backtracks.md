# Armonías y backtracks por estilo a partir de una o varias tomas

**Estado:** primer corte aprobado e implementado el 2026-11-26 (F1 + F2, estilo
pop, MIDI editable, corrección de acordes por compás). El usuario aprobó el
alcance ese mismo día. Las fases F3 y F4 siguen como propuesta. Ver la evidencia
en [STATUS](../STATUS.md#backtracks-pop-primer-corte--2026-11-26).

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

Empezar por la alternativa 1 (reglas), sin modelos nuevos y sin modificar el
audio original. Producir primero acordes y bajo como pistas MIDI editables; el
audio y la instrumentación quedan para una unidad posterior. Evaluar con
melodías conocidas antes de prometer estilos.

### Diseño propuesto por fases

1. **F1 — lectura armónica (sin cambios de contrato).** A partir de las notas de
   una toma: detectar tonalidad con un histograma de clases de pitch, dividir en
   compases según tempo, PPQ y compás, y proponer acordes candidatos con una
   confianza simple. Mostrar el resultado para corregirlo; no generar sonido
   todavía.
2. **F2 — un estilo, una toma, pistas MIDI.** El contrato v1 ya admite varias
   pistas, pero el host exige exactamente una: habría que relajar esa validación
   sin cambiar `schemaVersion`. Generar una pista de acordes y otra de bajo en
   PPQ, de forma determinista, a partir de los acordes corregidos. Repetir con
   un único estilo de referencia; silenciar, escuchar y exportar un MIDI de
   varias pistas. Sin percusión y sin audio generado.
3. **F3 — línea de tiempo de varias tomas.** Nueva unidad de trabajo con varias
   tomas y desplazamiento en compases. Esto sí afecta al contrato (nuevo
   artefacto o `schemaVersion` 2 con migración explícita); no se haría sobre el
   único original sin decisión y respaldo.
4. **F4 — más estilos y variaciones.** Ampliar la biblioteca de estilos y evaluar
   la escucha comparativa antes de agregar cada uno.

### Qué significa "estilo" en este diseño

Un archivo de datos local, no una etiqueta: gramática de progresiones, patrones
rítmicos en PPQ, voicings y programas MIDI, registro y reglas de bajo. Se
versiona junto al proyecto, se puede comparar y editar. Cada estilo debe
documentar su referencia musical para evitar caricaturas.

## Prerrequisitos

- F1/F2 no requieren varias tomas: trabajan sobre una sola. F3 sí necesita un
  proyecto con varias tomas y una línea de tiempo compartida.
- El host validaba una sola pista; en F2 se relajó a un máximo de tres con IDs,
  nombres, canales, programas y notas restringidos (ya implementado).
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

## Primer corte implementado — decisiones aprobadas

- **Alcance:** F1 + F2 con un solo estilo, **pop**, aprobado por el usuario.
- **Salida:** dos pistas MIDI nuevas (`backtrack-chords` y `backtrack-bass`) en
  el mismo proyecto v1; se pueden silenciar al escuchar, regenerar, quitar y
  exportar en un SMF tipo 1 de tres pistas. El audio original y las notas de la
  melodía no se modifican.
- **Interfaz:** botón «Generar acompañamiento pop», un selector de acorde por
  compás y opción de incluir o no el acompañamiento en el piano; sin generación
  de audio ni percusión.
- **Corrección:** por compás, desde la lista diatónica de la tonalidad
  detectada (siete opciones). No hay entrada libre de acordes en este corte.
- **Persistencia:** las correcciones se conservan como notas MIDI en la pista
  de acordes; al reabrir, los acordes se recuperan de esas notas. No se agregó
  un campo de acordes ni se cambió `schemaVersion`.
- **Explícitamente fuera:** varias tomas, estilos múltiples, audio generado,
  modelos generativos, armonización automática de la melodía y reconocimiento
  de percusión.

## Resultado y límites conocidos

- La detección de tonalidad usa un histograma de clases de pitch con perfiles
  mayor/menor: las tonalidades relativas (p. ej. C mayor / A menor) pueden
  confundirse cuando la melodía no acentúa la tónica. El usuario puede corregir
  los acordes, pero no la tonalidad en este corte.
- Sólo se proponen tríadas diatónicas; no hay séptimas, acordes prestados ni
  sustituciones. El generador es determinista y no usa azar.
- Las notas generadas se recortan al final del audio medido para pasar la
  validación del host; en tomas muy cortas el acompañamiento puede sonar
  incompleto.
- «Pop» es una convención mínima de acordes y bajo, no una emulación de
  producción musical. No hay referencia externa ni descarga de estilos.

## Validación ejecutada

- Unitarias TS: detección de tonalidad con acentos de tónica, propuesta por
  compás, generación recortada al audio, recuperación de acordes desde la pista
  MIDI y exportación SMF tipo 1 con tres pistas.
- `npm.cmd run check`: 90 pruebas JS y build web en verde.
- `cargo check/test`: 14 pruebas; la nueva valida pistas de acompañamiento,
  rechaza IDs/canales inválidos y notas fuera del audio, y comprueba que se
  puedan quitar sin tocar la melodía.
- `npm.cmd run test:desktop`: E2E nativo en verde; generó tres pistas, descargó
  un MIDI con tres pistas y las quitó conservando la melodía.

## Decisiones pendientes (F3 en adelante)

- ¿Cómo se modela la línea de tiempo de varias tomas sin migrar el original?
- ¿Qué estilo se agrega después y con qué referencia musical documentada?
- ¿Se admite entrada libre de acordes o edición de la tonalidad detectada?
- ¿Cómo se evalúa la calidad musical y quién la aprueba?
