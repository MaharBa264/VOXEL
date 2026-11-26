# Compás configurable por toma

**Estado:** implementado y confirmado manualmente el 2026-11-26, con 4/4 como
valor por defecto. Lo pidió el usuario el 2026-11-26 como detalle previo a las
propuestas posteriores a M01-A («poder cambiar el compás, aparte del tempo»).
La unidad quedó cerrada tras la prueba del usuario en la aplicación de
escritorio.

## Problema y contexto

M01-A fijaba el compás en 4/4 en la interfaz, en el metrónomo y en el exportador
MIDI. El contrato v1 ya tenía `timeSignature` con numerador y denominador, pero
ninguna capa permitía elegirlo: el host lo escribía siempre 4/4 y el worker
emitía el metaevento de compás fijo. El usuario pidió seleccionarlo junto al
tempo para poder grabar melodías en otros compases.

## Alternativas

1. **Selector por toma en la captura (elegida).** El compás se elige antes de
   grabar, se persiste en el proyecto y se envía al worker para el MIDI. Es
   coherente con el tempo, que ya se elige por toma.
2. Compás global de la aplicación. Descartada: impediría tomas distintas en el
   mismo archivo.
3. Editar el compás después de transcribir. Descartada por ahora: implicaría
   reinterpretar los ticks y las notas ya guardadas, y queda fuera del alcance
   de esta unidad.

## Decisiones tomadas

- Opciones ofrecidas: 2/4, 3/4, 4/4, 6/8, 9/8 y 12/8. Valor por defecto 4/4.
- El BPM sigue refiriéndose a la negra. El conteo audible y la marca visual
  usan la unidad indicada por el denominador: período = `60 s / BPM × 4 /
  denominador`. Un compás de conteo tiene `numerador` pulsos y acento en el
  primero.
- El compás elegido se guarda en `timeSignature` del proyecto v1: no cambia
  `schemaVersion` ni la semántica de los ticks de las notas.
- El comando Tauri `save_take` recibe el compás como cadena `n/d`; el host lo
  valida (numerador 1–255, denominador potencia de dos de 1 a 128) antes de
  persistir. El worker recibe `--time-signature n/d` y escribe el mismo compás
  en el metaevento 0x58 del MIDI, tanto en el archivo del proyecto como en la
  descarga.
- Los valores no soportados se rechazan con error explícito tanto en Rust como
  en Python; no se intenta una inferencia con un compás inválido.

## Validación ejecutada

- Unitarias JS: `encodeMidi` emite `numerador` y exponente del denominador del
  compás pedido (3/4), y el reloj de pulsos respeta 6/8 con seis pulsos por
  compás.
- Unitarias Python: validación de `n/d`, MIDI con 3/4 y 6/8, y compás por defecto
  sin cambiar el comportamiento anterior.
- Unitarias Rust: persistencia de 6/8 y rechazo de compases inválidos; la prueba
  real del worker con 3/4 comprueba el metaevento en el MIDI generado.
- `npm.cmd run check` (84 pruebas), `npm.cmd run test:python` (13 pruebas),
  `cargo check/test` (13 pruebas) y `npm.cmd run test:desktop` en verde. En el
  E2E se eligió 3/4 antes de grabar y `project.json` conservó
  `{"numerator":3,"denominator":4}`.
- El usuario confirmó manualmente el funcionamiento del selector en la
  aplicación de escritorio el 2026-11-26.
- Pendiente: verificación auditiva humana del conteo en compases compuestos
  (6/8, 9/8, 12/8) y decidir si se permite cambiar el compás de una toma ya
  guardada.
