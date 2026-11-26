# Armonías y backtracks por estilo a partir de una o varias tomas

**Estado:** propuesta en evaluación — registrada el 2026-11-26. El usuario
confirmó ese día que quiere continuar con esta línea, pero el primer corte todavía
no está aprobado. No es una función disponible ni está implementada.

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
- El host valida hoy una sola pista por proyecto; F2 exige relajar ese límite
  manteniendo validación de IDs, canales y notas.
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

## Primer corte propuesto (requiere aprobación)

- **Alcance:** F1 + F2 con un solo estilo. Se recomienda **pop** por ser el más
  simple de formalizar en 4/4 (progresiones cortas y convenciones mínimas), no
  por ser el más interesante musicalmente.
- **Salida:** dos pistas MIDI nuevas (acordes y bajo) en el mismo proyecto v1;
  silenciables, reproducibles con el piano local y exportables junto a la
  melodía. El audio original y las notas de la melodía no se modifican.
- **Interfaz:** botón «Proponer acompañamiento», corrección de acordes por
  compás y selector de estilo; sin generación de audio ni percusión.
- **Criterio de aceptación:** con una melodía sintética de prueba se detecta la
  tonalidad correcta, los acordes son corregibles, el MIDI resultante abre con
  tres pistas en una DAW y la app sigue funcionando sin conexión.
- **Explícitamente fuera:** varias tomas, estilos múltiples, audio generado,
  modelos generativos, armonización automática de la melodía y reconocimiento
  de percusión.

## Decisiones pendientes

- ¿Aprobar el primer corte (F1 + F2, estilo pop, MIDI editable)?
- ¿Qué estilo se aborda primero y con qué referencia musical documentada?
- ¿Cuánto control manual se da sobre los acordes: por compás o entrada libre?
- ¿El acompañamiento se guarda como pistas del proyecto v1 o exige un nuevo
  artefacto de sesión?
- ¿Se parte sólo de la melodía o también de acordes ingresados por el usuario?
- ¿Cómo se evalúa la calidad musical y quién la aprueba?
