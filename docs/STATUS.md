# Estado de la inicialización — 2026-11-17

## Estado actual

- Carpeta activa: `D:\Proyectos\VOXEL`; selección en Codex confirmada por el usuario.
- Repositorio canónico: https://github.com/MaharBa264/VOXEL.
- Base local: contratos v1 e integración M01-A de desarrollo, con pruebas y documentación.
- Publicación inicial autorizada por el usuario el 2026-11-17. Se inicializó
  Git local en D: y se configuró ese repositorio como `origin`; el historial
  de `main` y la comprobación de SHA local/remoto acreditan la publicación efectiva.
- Captura, transcripción local, MIDI, piano y persistencia implementados.
  Sin percusión, armonización ni edición de notas.
- Rust/Cargo 1.100.0 locales en D:; Cargo.lock generado y build Windows debug comprobado.
- Apertura visual del shell confirmada por captura del usuario.
- Flujo nativo completo comprobado con señal sintética, incluido piano y descarga.
  Aceptación manual con micrófono y escucha reales completada el 2026-11-26 con
  las limitaciones de transcripción documentadas en la sección de aceptación.
- Se retoma la copia M01-A de D: y se publica su respaldo en GitHub por nueva
  instrucción permanente del usuario del 2026-11-18. Ver registro de sincronización abajo.
- Metrónomo con conteo audible y pulso visual implementado en desarrollo el
  2026-11-26; ver la sección correspondiente. Sin cambios en el contrato v1 ni
  en la inferencia.
- Compás configurable por toma, confirmado manualmente el 2026-11-26; ver la
  sección correspondiente.
- Motor de percusión local implementado el 2026-11-26; ver la sección
  correspondiente. Silbido sigue sin motor.
- Backtracks por estilo: primer corte pop aprobado e implementado (acordes
  corregibles por compás y pistas MIDI de acordes y bajo); ver la sección
  correspondiente y [la propuesta](proposals/2026-11-26-style-backtracks.md).
  Las fases de varias tomas y otros estilos siguen sin implementar.

## Metrónomo: conteo audible y pulso visual — 2026-11-26

Primera unidad posterior a M01-A, en el orden acordado con el usuario. No
modifica `src/domain/project.ts`, la transcripción ni el formato de los
proyectos.

Alcance implementado:

- Un compás de conteo al tempo elegido (40–240 BPM; inicialmente 4/4 fijo y,
  desde el 2026-11-26, compás seleccionable: ver sección correspondiente) antes
  de abrir la toma. El primer pulso se acentúa.
- El micrófono se concede antes del conteo, pero `MediaRecorder.start()` se
  ejecuta recién en el quinto pulso: los clics no forman parte del audio
  grabado.
- Durante la grabación, las marcas visuales de un compás siguen el pulso sin
  emitir sonido. El reloj se calcula desde el `performance.now()` del downbeat
  para no acumular deriva.
- Interruptor «Conteo audible y pulso visual del metrónomo», activado por
  defecto. Al desactivarlo se conserva el comportamiento anterior: grabar de
  inmediato y sin marcas.
- «Cancelar conteo» aborta antes de crear la toma, libera el micrófono y no
  guarda un proyecto.
- El temporizador de 30 s empieza con la toma, no con el conteo.

Comandos y resultados:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0: TypeScript, 82 pruebas JS (5 nuevas de metrónomo) y build web |
| `npm.cmd run test:desktop` | Código 0: PASS del flujo nativo sintético completo |
| `curl http://127.0.0.1:1420/` | HTTP 200 |

Evidencia sintética (`.cache/desktop-test/3c2f0f1d-7515-414c-8817-501bbd82c75e/report.json`,
no publicada porque está bajo `/.cache`):

- `metronomeDefault: true`.
- `countingElapsed: "00.0 / 30 s"`: el conteo no avanza el temporizador.
- `countInPeak: 0.311` de señal Web Audio: los clics producen audio real.
- `countInCanceled: true` y todas las pistas del micrófono en `ended`: la
  cancelación del conteo no crea toma y libera el micrófono.
- Sin errores de página, de consola ni solicitudes externas.

Límites y pruebas pendientes:

- La verificación es sintética. La escucha del clic y del pulso con micrófono
  real quedó pendiente de confirmación manual del usuario.
- No hay compensación de latencia de salida ni de entrada: el primer pulso de
  la toma puede quedar unos milisegundos después del downbeat. No se promete
  alineación muestra a muestra.
- Con altavoces el micrófono puede captar el clic. La interfaz recomienda
  auriculares, pero no impide grabar sin ellos.
- El tempo sigue siendo un valor elegido por el usuario; no se detecta
  automáticamente y no hay cambios de tempo dentro de una toma.
- El conteo no se guarda como audio y no altera el PPQ ni el compás declarado
  en el proyecto.

Confirmación manual: el usuario probó el flujo con micrófono real y reportó
que el conteo audible y el pulso visual funcionan; la unidad quedó cerrada
sin nuevos errores de interfaz.

## Post-proceso monofónico opcional — 2026-11-26

Unidad posterior a M01-A, en el orden acordado. Filtro de armónicos y notas
duplicadas desactivado por defecto.

Alcance implementado:

- Filtro posterior `select_monophonic` en `python/transcribe.py`: descarta
  notas una octava o más por encima de un sustentante inferior con solapamiento
  temporal.
- Interruptor de la interfaz «Post-proceso monofónico: quitar armónicos y notas
  duplicadas», desactivado por defecto.
- Conexión del worker vía flag `--monophonic` en el comando Tauri
  `transcribe_take` (valor por defecto `false`).

Comandos y resultados:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0 |
| `npm.cmd run test:python` | Código 0 (8 pruebas, incluidas las del filtro) |
| `cargo check --locked` / `cargo test --locked` | Código 0 (12 pruebas) |
| `npm.cmd run test:desktop` | Código 0, PASS nativo |

Pendiente: comparar la misma toma real con y sin filtro antes de activar el
interruptor por defecto. El filtro se activó en la prueba sintética con el modo
off, por defecto.

## Selector de tipo de entrada — 2026-11-26

Unidad posterior a M01-A, en el orden acordado.

Alcance implementado:

- Selector en la interfaz con opciones voz/tarareo, silbido y percusión.
- Petición de transcripción con tipo de entrada (plumbing `transcribe_take` →
  worker con flag `--input-kind`).

Comportamiento actual:

- Sólo `voice` está soportado por el motor local. El 2026-11-26 el usuario eligió
  una opción no soportada y el worker devolvió `Unsupported input kind`; la toma
  quedó intacta y sin notas. El incidente se registró en
  `projects/d187f14b-01e1-4b97-943c-b8753a3bc351/job-51fbbfcb…/worker.log` y no
  se copió audio al repositorio.
- Tras el informe del usuario, `Silbido` y `Percusión` quedan **deshabilitadas**
  y etiquetadas «sin motor aún», con texto explicativo y una guarda en la
  interfaz que impide enviarlas al worker. El worker mantiene su validación
  estricta como segunda barrera.

Pendiente: motor de silbido y decisión sobre persistencia del tipo en el
proyecto (el contrato v1 no varió).

## Motor de percusión — 2026-11-26

Unidad pedida por el usuario tras el informe del error con una opción sin motor.
Ver [propuesta](proposals/2026-11-26-input-kind.md).

Alcance implementado:

- `--input-kind percussion` ejecuta un detector local de ataques en
  `python/transcribe.py`: flujo espectral positivo, ventanas Hann y tres bandas
  (40–250, 250–2500 y 2500–12000 Hz), con separación mínima de 80 ms entre
  golpes. No carga Basic Pitch ni modelos nuevos.
- Clasificación gruesa en bombo (36), caja (38) y hi-hat cerrado (42) según la
  energía de banda; velocity derivada de la energía del ataque; duración corta
  fija (máx. 80 ms) recortada al audio.
- El host crea una pista `percussion` en canal 9 (GM canal 10) y programa 0.
  El contrato v1 admite ahora hasta cuatro pistas sin cambiar `schemaVersion`.
  El MIDI generado por el worker y la descarga usan el mismo canal.
- Interfaz: opción «Percusión (golpes)» habilitada; «Silbido» sigue deshabilitada
  y etiquetada «sin motor aún». La vista previa, el piano y la descarga muestran
  las notas de percusión cuando existen.

Comandos y resultados:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0 (90 pruebas JS y build web) |
| `npm.cmd run test:python` | Código 0 (15 pruebas) |
| `cargo check --locked` / `cargo test --locked` | Código 0 (15 pruebas) |
| `npm.cmd run test:desktop` | Código 0, PASS nativo; pista de percusión en canal 9 |

Límites: detección por reglas y tres voces de batería, sin samples propios; el
piano local reproduce los golpes como referencia sonora, no como batería. Hace
falta calibración con golpes reales sobre escritorio/mesa y micrófono, y sigue
pendiente el motor de silbido.

## Compás configurable — 2026-11-26

Detalle pedido por el usuario antes de continuar con las propuestas de orden
posterior. Ver [propuesta](proposals/2026-11-26-time-signature.md).

Alcance implementado:

- Selector de compás para la próxima toma: 2/4, 3/4, 4/4, 6/8, 9/8 y 12/8,
  con 4/4 por defecto. Al abrir un proyecto se recupera su compás.
- `timeSignature` se persiste en el proyecto v1 y viaja al worker con
  `--time-signature`; el metaevento 0x58 del MIDI del proyecto y de la descarga
  usa el mismo compás.
- El conteo audible y el pulso visual siguen la unidad del denominador con BPM
  referido a la negra; el número de pulsos es el numerador.

Comandos y resultados:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0 (84 pruebas JS y build web) |
| `npm.cmd run test:python` | Código 0 (13 pruebas) |
| `cargo check --locked` / `cargo test --locked` | Código 0 (13 pruebas) |
| `npm.cmd run test:desktop` | Código 0, PASS nativo; compás 3/4 persistido |

Confirmación manual: el usuario probó el selector de compás en la aplicación de
escritorio y reportó que funcionó el 2026-11-26. La unidad quedó cerrada sin
nuevos errores de interfaz.

Pendiente: escucha humana del conteo en compases compuestos (6/8, 9/8, 12/8) y
decisión sobre cambiar el compás de una toma ya guardada.

## Backtracks pop (primer corte) — 2026-11-26

Unidad siguiente del orden acordado. El usuario aprobó F1 + F2 con estilo pop,
MIDI editable y corrección de acordes por compás. Ver
[propuesta](proposals/2026-11-26-style-backtracks.md).

Alcance implementado:

- Lectura armónica local y determinista en `src/domain/harmony.ts`: tonalidad
  por histograma de clases de pitch, un acorde diatónico por compás y lista
  reducida de siete acordes para corregir.
- Generación de dos pistas MIDI (`backtrack-chords`, `backtrack-bass`) en PPQ,
  recortadas al final del audio; comando Tauri `save_backtrack` con validación
  estricta de ID, nombre, canal, programa y notas.
- El host acepta hasta tres pistas (melodía, acordes y bajo) sin cambiar
  `schemaVersion`. La descarga MIDI pasa a SMF tipo 1 con tres pistas.
- Interfaz: botón «Generar acompañamiento pop», corrección por compás, opción
  de silenciar el acompañamiento al escuchar el piano, regeneración y
  eliminación. El audio original y las notas de la melodía no se tocan.

Comandos y resultados:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0 (90 pruebas JS y build web) |
| `cargo check --locked` / `cargo test --locked` | Código 0 (14 pruebas) |
| `npm.cmd run test:desktop` | Código 0: 3 pistas persistidas, MIDI con 3 pistas y acompañamiento quitado |

Límites: tonalidades relativas ambiguas, sólo tríadas diatónicas, una toma, un
estilo, sin audio generado ni percusión, sin edición libre de acordes ni de la
tonalidad. Quedan para F3/F4 la línea de tiempo de varias tomas y más estilos.
Falta escucha humana comparativa del resultado musical.

## Aceptación manual M01-A — 2026-11-26

El usuario aceptó M01-A con las limitaciones de transcripción documentadas más
abajo. El código de la aplicación probado fue `081fcee`; el ajuste de
`vite.config.ts` que impide que el servidor de desarrollo vigile entornos y
datos locales se publica junto con este registro. No se modificó
`src/domain/project.ts`, el contrato v1 ni la inferencia durante la prueba.

Entorno: Windows 11 Pro build 26300 x64; Node 24.19.0; npm 12.0.2;
Rust/Cargo 1.100.0 para `x86_64-pc-windows-msvc`; Python 3.11.15 en `.venv`;
Basic Pitch 0.4.0; TensorFlow 2.14.0 CPU; WebView2 158.0.4370.33. La aplicación
se abrió con `npm.cmd run desktop:dev:local`. Los proyectos quedaron en
`projects/<UUID>`; no se copió audio al repositorio ni a servicios externos.

Comandos ejecutados antes de la prueba:

| Comando | Resultado |
| --- | --- |
| `git fetch origin` y `git merge --ff-only origin/main` | Código 0: `f01eb3f..081fcee`, sólo documentación |
| `npm.cmd run python:check` | Código 0: Python 3.11.15, 66 paquetes compatibles |
| `npm.cmd run check` | Código 0: TypeScript, 76 pruebas JS y build web |
| `npm.cmd run test:python` | Código 0: 7 pruebas con el modelo real |
| `cargo test --locked --manifest-path src-tauri/Cargo.toml` | Código 0: 12 pruebas |
| `npm.cmd run check` tras el ajuste de Vite | Código 0 |
| `curl http://127.0.0.1:1420/` tras el ajuste | HTTP 200 en 7 ms |

Recorrido y resultado por criterio:

| Criterio | Resultado |
| --- | --- |
| Permiso de micrófono concedido | Cumplido en WebView2 con una toma real. |
| Indicador de grabación y liberación al detener | Indicador y detención observados. La liberación del micrófono del sistema no se comprobó de forma independiente; el E2E sintético previo sí verifica la liberación de tracks. |
| Original audible y conservado | Cumplido: el usuario escuchó su voz con claridad. `original.webm` y `analysis.wav` existen y el WAV coincide con una decodificación independiente (correlación 1,0). |
| Transcripción local y comparación | Cumplida con las limitaciones de abajo: la toma de referencia produjo 13 notas; el piano reproduce la melodía reconocible con octavas y omisiones puntuales. |
| Piano audible y parada completa | Cumplido: el usuario lo oyó afinado y no quedaron voces sonando tras detener. |
| MIDI descargado y abierto en una DAW | Cumplido: `melody.mid` de 163 B, 13 note-on, mismas notas que el MIDI del proyecto más un metaevento de compás 4/4; abierto en MuseScore 4 con 13 notas. |
| Cerrar y reabrir | Cumplido: tras cerrar el proceso y reabrir la app se recuperaron la toma, el audio original y las 13 notas. Los SHA-256 de `project.json`, `melody.mid` y `original.webm` no cambiaron. |
| Cancelar una transcripción y reintentar | No confirmado explícitamente por el usuario en esta sesión. El E2E sintético previo cubrió cancelación, reintento y conservación de notas. |
| Recorrido sin conexión | Cumplido en ejecución: el usuario desconectó la red y repitió grabación, transcripción, escucha y descarga. Todo el procesamiento fue local. La calidad de esa toma quedó dentro de las mismas limitaciones del modelo. |
| Permiso denegado | No repetido manualmente en esta sesión; cubierto por el E2E sintético previo. |

Evidencia local, sin publicar audio: la toma de referencia `7d376213` duró
6,72 s y produjo 13 notas; la toma offline `244b80dc` duró 5,46 s y produjo
14 notas; dos tomas posteriores de 14:15 y 14:16, en registro agudo, produjeron
8 y 2 notas. Esas dos últimas tienen un pico espectral de 1,2–1,7 kHz y son
compatibles con silbido, entrada que el protocolo de M01-A no cubre.

Limitaciones que motivan la aceptación con reservas:

- Basic Pitch usa `minimum_note_length` de 127,7 ms por defecto y descarta notas
  más cortas. Con el mismo audio y ese valor en 0 aparecieron 34 eventos, en su
  mayoría fragmentos y armónicos; no se cambió el parámetro.
- El modelo polifónico agrega armónicos como notas. En `244b80dc` emitió D#5
  sobre un D#4 y G4/D5 sobre un G3; en `7d376213` agregó C#5 y G#5 como 2.º y
  3.er armónico de C#4.
- El silbido no se transcribe con fiabilidad con este modelo.
- La descarga MIDI usa el mecanismo del navegador embebido: no muestra diálogo
  de carpeta ni estado de progreso.
- `melodia_trick=True` no explicó los duplicados: con ese valor en `False` los
  eventos fueron idénticos en las tomas revisadas.

Corrección de entorno encontrada durante la aceptación: al reiniciar la app
la ventana quedó blanca porque Vite vigilaba `.venv`, `.tools`, `.cache`,
`projects`, `src-tauri` y `dist`, y chocaba con temporales bloqueados
(`EBUSY` en `.cache/tmp`). El proceso quedaba sin responder a HTTP. Se excluyeron
esas carpetas de `server.watch.ignored` en `vite.config.ts`; después el servidor
respondió en milisegundos y la app volvió a abrir normalmente. La corrección es
sólo del servidor de desarrollo y no afecta al ejecutable ni a los datos.

Decisión: M01-A queda aceptado con estas limitaciones por decisión del usuario
del 2026-11-26. Las mejoras posteriores se registran como propuestas en
`docs/proposals/` y no se implementan dentro de esta unidad de trabajo.

Las secciones siguientes conservan la evidencia histórica de cada etapa.

## Inspección inicial

La carpeta estaba vacía. `git status --short --branch` devolvió código 1:
no existía un repositorio Git en ella ni en sus padres. Durante esa primera
entrega no se inicializó Git, no se crearon commits y no se publicaron cambios.

Node 24.19.0 y npm 12.0.2 disponibles. Python 3.12/3.14 detectados, sin 3.11.
`tauri info` detectó WebView2 157.0.4341.46 y Visual Studio Build Tools 2022;
no detectó rustc, Cargo ni rustup. Windows informa kernel 10.0.26300 x64;
el número de kernel no debe interpretarse por sí solo como edición comercial.

## Verificaciones ejecutadas

| Comando / comprobación | Resultado |
| --- | --- |
| `npm install --no-fund --no-audit` | Pasó; dependencias locales y lock generado |
| Primer `npm test`, antes del contrato | Falló como se esperaba: módulo `src/domain/project` ausente; 0 tests ejecutados |
| `npm test` tras contrato | 39 pruebas pasaron |
| Primer `npm run check` con tests de artefactos | 42 pasaron y 1 falló: patrón de esquema Tauri incompatible con regex JS Unicode |
| Reproducción del patrón con/sin flag `u` | Confirmó la causa; configurado Ajv no-Unicode sólo para esquema Tauri |
| `npm run schemas:generate` | Pasó; dos JSON Schema Draft 2020-12 generados |
| `npm ci --no-fund --no-audit` | Pasó desde lock, reinstalando dependencias locales |
| `npm run check` después de reinstalar y con configuración final | Pasó: TypeScript, 43 pruebas en 2 archivos y build Vite de producción |
| `npm run smoke:web` | Pasó: HTTP 200 para HTML, entrada TSX, App TSX y CSS; servidor cerrado al terminar |
| `npm ls --depth=0` | Pasó, sin conflictos de dependencias reportados |
| `npm audit --omit=dev --json` | Sin avisos de producción en la primera revisión |
| Primer `npm audit --json` completo | Detectó 1 aviso moderado en Ajv 8.17.1 (desarrollo); actualizado a 8.20.0 |
| `npm audit` final completo | Pasó: 0 vulnerabilidades conocidas reportadas |
| `npm install-scripts ls` | Informa esbuild postinstall bloqueado por política npm 12; verificaciones web pasaron sin habilitarlo |
| `npm run tauri -- info` | Diagnóstico ejecutado; detecta Rust/Cargo ausentes aunque retorna 0 |
| `npm run desktop:build` | Falló: no pudo ejecutar `cargo metadata`, programa no encontrado |
| `node scripts/generate-icon.mjs` | Generó el icono provisional de desarrollo |
| Decodificación ICO con `System.Drawing.Icon` | Pasó: icono Windows de 32×32 |
| Revisión independiente de código (sólo lectura) | Detectó versiones Rust abiertas; fijadas =2.12.6 y =2.7.5, mínimo Rust 1.90 según crates.io |
| Comparación automatizada del inventario con archivos reales | Pasó: 32 archivos de fuentes/configuración, sin faltantes ni extras |

Las 43 pruebas cubren rangos MIDI/PPQ, serialización de datos y referencia al
audio, proyecto vacío, versión/campos desconocidos, entradas inválidas, rutas,
IDs duplicados, referencias ausentes, esquemas generados y estructura Tauri.
La serialización probada es JSON en memoria, no guardado/reapertura desde disco.

En la primera entrega no se ejecutaron `cargo check`, `cargo test`, ejecutable Windows, instalador,
interfaz en navegador real, grabación, inferencia Python ni reproducción Tone.
El smoke HTTP no ejecuta React ni evalúa permisos, CSP o Web Audio en WebView2.
La configuración nativa se valida contra el esquema instalado; esto no prueba
compilación, resolución Rust ni funcionamiento de la ventana.

## Archivos creados en la primera entrega (32)

Este es el inventario histórico de la primera entrega, previo a publicar en GitHub.
Todos eran nuevos; no existían archivos para modificar.

```text
.gitignore
.node-version
.npmrc
AGENTS.md
README.md
package.json
package-lock.json
index.html
tsconfig.json
vite.config.ts
src/main.tsx
src/app/App.tsx
src/app/styles.css
src/domain/project.ts
src-tauri/Cargo.toml
src-tauri/build.rs
src-tauri/tauri.conf.json
src-tauri/src/main.rs
src-tauri/icons/icon.ico
schemas/midi-note.schema.json
schemas/project.schema.json
scripts/generate-icon.mjs
scripts/generate-schemas.ts
scripts/smoke-web.mjs
tests/project.test.ts
tests/schemas.test.ts
examples/empty-project.json
python/README.md
docs/ARCHITECTURE.md
docs/DEPENDENCIES.md
docs/STATUS.md
docs/superpowers/plans/2026-11-17-initialization.md
```

Artefactos generados e ignorados: `node_modules/` (dependencias y caché de Vite)
y `dist/` (HTML, JS y CSS compilados). No son fuentes para versionar.
Los esquemas y el ICO sí se conservan; el icono se regenera con
`node scripts/generate-icon.mjs` y no representa una identidad visual definitiva.

## Pendientes

- Build release, instalador y prueba del mínimo Rust 1.90 no ejecutados.
- Validar voz real, micrófono físico y escucha del flujo integrado.
- Diseñar runtime Python/modelo empaquetados, instalador, licencias y firma.
- Aceptación manual M01-A completada el 2026-11-26 con limitaciones de
  transcripción; repetir opcionalmente permiso denegado y cancelación manual.
- Recuperación ante corte de energía entre JSON/MIDI, migraciones y almacenamiento
  final fuera del workspace; el guardado actual es atómico por archivo.

Decisiones y problemas detallados en `ARCHITECTURE.md` y `DEPENDENCIES.md`.

## Traslado a D: — 2026-11-17

Nueva carpeta de trabajo: `D:\Proyectos\VOXEL`.
Se copiaron 8088 archivos (133,9 MiB), incluyendo dependencias locales,
y se verificaron todos con SHA-256 contra el original antes de modificar esta nota.
La primera prueba en D se lanzó prematuramente mientras la copia seguía
activa y falló por TypeScript todavía ausente. Tras completar y verificar
la copia se repitieron `npm.cmd run check` y `npm.cmd run smoke:web`:
ambos terminaron con código 0 (43 pruebas, tipos, build web y smoke HTTP).

Al terminar la copia, el original en C permanecía: la revisión automática rechazó el comando
que incluía su eliminación recursiva con el motivo genérico «bloqueado por
política». No se eliminó el original ni se creó el enlace de compatibilidad
previsto; esa operación no liberó espacio en C. Posteriormente el usuario
confirmó haber seleccionado la carpeta de D: en Codex. No se infiere de esa
confirmación que también haya borrado el original. Usar D explícitamente
para todos los comandos futuros; no mantener dos copias de desarrollo activas.

## Preparación del repositorio y documentación — 2026-11-17

GitHub informó repositorio vacío (tamaño 0, rama predeterminada `main`) y
acceso de escritura. `git ls-remote --symref` no encontró HEAD remoto al inicio.
Se ejecutó `git init -b main` y se agregó el remoto `origin`, ambos con código 0.
No se modificaron nombre, correo, credenciales ni configuración global de Git.

Se añadieron `.gitattributes`, `docs/DEVELOPMENT.md` y `docs/ROADMAP.md`;
se actualizaron README, AGENTS y este registro para documentar la carpeta D:,
clonado, alcance de publicación y próximos pasos. El código de producto,
los contratos y las versiones de dependencias no cambian en esta etapa.
El inventario de la base pasa de 32 a 35 archivos versionables.

La publicación usa la conexión GitHub autorizada. El repositorio local se
sincroniza con los commits remotos sin cambiar archivos de trabajo. Para
comprobar cualquier entrega, comparar `git rev-parse HEAD` con
`git ls-remote origin refs/heads/main` y revisar `git status --short --branch`.
Las pruebas se ejecutan localmente; todavía no hay pipeline de CI configurado.

Verificación previa a publicar, ejecutada desde D: el 2026-11-17:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0: TypeScript, 43 pruebas y build web |
| `npm.cmd run smoke:web` | Código 0: HTML y módulos servidos por loopback |
| `npm.cmd audit` | Código 0: 0 vulnerabilidades conocidas |
| `git check-ignore` con dependencias, build, `.env`, proyectos y `.venv` | Código 0: todos los ejemplos excluidos |
| `git ls-files --others --exclude-standard` | Código 0: 35 archivos de fuentes y configuración para la publicación inicial |
| `Test-Path` del original en C: | `True`: sigue presente; la selección en Codex no lo eliminó |

La verificación nativa continúa pendiente; esta publicación no la reemplaza.

## Continuación: formatos Ajv y compilación nativa — 2026-11-17

El usuario ejecutó `npm ci`, `check`, `smoke:web` y `dev` desde D:.
Su salida mostró las 43 pruebas iniciales y build correctos, con avisos
`unknown format` en el test de configuración Tauri. La causa era Ajv sin los
formatos del esquema de terceros: `strict: false` permitía ignorarlos.
Las nuevas pruebas reprodujeron la aceptación incorrecta de URI, UUID,
enteros sin signo, NaN y formatos desconocidos (10 fallos de 18 casos).

Se añadió `ajv-formats@3.0.1` como dependencia de desarrollo, validadores
uint8/uint32 y `strictSchema`/`strictNumbers`. No se silenció el logger ni
se desactivó `validateFormats`. La suite pasa ahora 57 pruebas.

Como faltaba Rust, se preparó un toolchain aislado en `.tools/cargo` y
`.tools/rustup`, con temporales en `.cache/tmp`, todos dentro de D: e
ignorados por Git. El instalador oficial se ejecutó con perfil mínimo y
`--no-modify-path`; no se añadió Rust al PATH persistente ni al cargo del usuario.
SHA-256 verificado del instalador:
`38027d51d69a5d05493627a0634dbea52d6cd793c8f072d2373d3f4163eec7db`.
La primera lectura del hash trató una respuesta binaria como texto y falló;
se corrigió guardando el archivo SHA-256 y leyéndolo como texto antes de ejecutar.

Se añadieron `scripts/local-rust.mjs`, comandos npm locales y
`docs/LOCAL-TOOLS.md`. El wrapper limita los comandos a cargo/rustc/rustup/Tauri,
configura el entorno del proceso hijo y no cambia el PATH del sistema.
Cargo.lock fija la resolución de 427 paquetes de la primera compilación.

| Comando / comprobación | Resultado |
| --- | --- |
| Regresiones nuevas antes de la corrección | Código 1: 10 fallos y 8 casos correctos en tests de artefactos |
| `npm.cmd ci --no-fund --no-audit` | Código 0: 64 paquetes; advertencia de esbuild postinstall bloqueado conservada |
| `npm.cmd run check` tras reinstalar | Código 0: tipos, 57 pruebas y build web, sin avisos de formatos ignorados |
| `npm.cmd run smoke:web` | Código 0 |
| `npm.cmd audit` | Código 0: 0 vulnerabilidades conocidas |
| `node scripts/local-rust.mjs rustc --version` | Código 0: rustc 1.100.0 (0ef1bc386 2026-11-09) |
| `node scripts/local-rust.mjs cargo --version` | Código 0: cargo 1.100.0 (3acc79c0c 2026-11-05) |
| `node scripts/local-rust.mjs cargo check --manifest-path src-tauri/Cargo.toml` | Código 0; generó Cargo.lock |
| `node scripts/local-rust.mjs cargo test --locked --manifest-path src-tauri/Cargo.toml` | Código 0; 0 tests Rust definidos, no es cobertura funcional |
| `npm.cmd run desktop:build:local -- --debug` | Código 0: generó `src-tauri/target/debug/voxel.exe` |
| `node --check scripts/local-rust.mjs` | Código 0: sintaxis correcta |
| Wrapper con comando no permitido | Código 1 esperado; mostró uso y no ejecutó ese comando |
| `git check-ignore` de herramientas, caches, target y schemas auxiliares | Código 0: excluidos |
| Comprobación del cargo del usuario | No existe `C:\Users\amedina\.cargo\bin\cargo.exe` tras la instalación local |

Todavía no se abrió ni inspeccionó visualmente el ejecutable. No se probaron
micrófono, permisos, inferencia Python ni salida de audio. El postinstall de
esbuild sigue bloqueado; no impidió los comandos verificados y no se aprobó
su ejecución. Python 3.11/Basic Pitch es el siguiente prerrequisito de M01-A.
Los cambios de esta continuación quedan locales, sin nuevos commits ni push.

## Ventana nativa y runtime Basic Pitch — 2026-11-17

El usuario aportó una captura que muestra la ventana nativa VOXEL con el
contenido del shell correctamente visible. Se registra como comprobación
visual manual; no implica que se hayan probado permisos del micrófono o audio.

Se usó uv 0.12.3 ya instalado para descargar CPython standalone 3.11.15 x64
a `.tools/python` con `--no-bin --no-registry` y crear `.venv` en D:.
No se cambió PATH ni la selección del launcher `py`; `py --list-paths` siguió
mostrando sólo los Python 3.12/3.14 previos.

La primera resolución de 66 paquetes instaló Basic Pitch 0.4.0, TensorFlow
2.14.0 y NumPy 2.4.6. El primer smoke falló en setUpClass por ABI NumPy
(`_ARRAY_API not found`, código 1, 0 tests ejecutados). Tras fijar NumPy
1.26.4, falló por `ModuleNotFoundError: pkg_resources` desde resampy 0.4.2
(código 1, 0 tests). Se fijó setuptools 81.0.0 y se regeneró el lock con hashes.
Las dos inferencias reales pasaron sin modificar los paquetes de terceros.

Archivos nuevos de esta etapa: `python/requirements.in`,
`python/requirements-windows-py311.txt`, `python/test_runtime.py` y
`scripts/local-python.mjs`. Se añadieron los comandos npm `python:setup`,
`python:check` y `test:python`, y se actualizó la documentación existente.
Herramientas, entorno, caches, WAV y MIDI de prueba permanecen ignorados.

| Comando / comprobación | Resultado |
| --- | --- |
| `uv python install 3.11 --no-bin --no-registry --no-config` con directorios locales | Código 0: CPython 3.11.15 x64 en D: |
| `uv venv .venv --python 3.11 --managed-python --no-config` | Código 0 |
| Compilación del lock y sync con `--require-hashes` | Código 0: 66 paquetes con versiones y hashes |
| `npm.cmd run python:setup` tras fijar compatibilidad | Código 0: Python existente y sync del lock, sin sustituir .venv |
| `npm.cmd run python:check` | Código 0: 66 paquetes compatibles según metadatos |
| `npm.cmd run test:python` con la combinación corregida | Código 0: 2 tests reales pasaron |
| `npm.cmd run check` | Código 0: 57 tests JS, TypeScript y build web |
| `node --check scripts/local-python.mjs` | Código 0 |

Resultados de inferencia: silencio de 2,5 s → cero eventos; La4 sintética de
440 Hz con armónicos → un evento de pitch MIDI 69. Los MIDI se escribieron
y reabrieron; los hashes de los WAV originales permanecieron iguales.
Los hashes de los tres archivos del modelo y resultados están en
`.cache/basic-pitch-smoke/report.json`, junto a WAV/MIDI generados localmente.
Se bloquearon funciones de socket de Python durante importación e inferencia;
se observaron cero intentos. Esto no es aislamiento de red a nivel del SO.

Advertencias conservadas: backends alternativos no instalados, APIs
deprecadas y una división inválida del postprocesador de Basic Pitch sobre
silencio. No impidieron los asserts de tensores finitos y cero notas; el
flujo de producto debe tratar silencio explícitamente. No hay auditoría
Python ni prueba física sin conexión. No se midió calidad vocal o latencia.

Siguiente trabajo: captura real y originales conservados, protocolo Rust↔Python,
adaptación a PPQ, exportación MIDI de VOXEL y piano local. Esta etapa no
implementa esos flujos y no completa M01-A. Sin nuevos commits ni push.

## Integración M01-A — 2026-11-17

Se implementó el recorrido de desarrollo de extremo a extremo: MediaRecorder,
original inmutable, WAV mono PCM16 derivado, proyecto JSON v1, worker Python
local CPU, PPQ y SMF0, piano Tone.Sampler y recuperación de tomas. La captura
es de máximo 30 s; el original admite hasta 32 s por colas del codec. Su
metadata describe el audio decodificado; el WAV de análisis se limita a 30 s.

El host sólo acepta IDs de proyecto canónicos y rutas propias del workspace.
Valida tamaños, WAV, notas, referencias y reparse points. Un trabajo exclusivo
puede cancelarse, tiene timeout de 180 s y se recoge al cerrar. El JSON se
reemplaza atómicamente en Windows; MIDI tiene rollback si falla JSON, sin
garantía de transacción conjunta ante corte de energía. Originales no se reemplazan.

Archivos de producto nuevos: `src-tauri/src/host.rs`, `python/transcribe.py`,
`src/audio/capture.ts`, `src/audio/wav.ts`, `src/audio/midi.ts`,
`src/audio/piano.ts`, `src/services/projects.ts` y `public/piano/` con cinco
samples, atribución y manifiesto de hashes. Se actualizaron App/CSS, main.rs,
Cargo.toml/lock, CSP, scripts npm y documentación. El esquema de proyecto v1
no cambió. IPC y pruebas se describen en `M01-A-DESIGN.md`/`M01-A-TESTING.md`.

Pruebas nuevas: `python/test_transcribe.py`, `tests/audio.test.ts`,
`tests/app.test.tsx`, `tests/piano-assets.test.ts`, tests del host Rust y
`scripts/test-desktop.mjs`. Playwright 1.65.1 se instaló sólo como dependencia
local de desarrollo; usa WebView2 ya instalado, sin descarga de navegador.
Rustfmt se agregó sólo al toolchain local para verificar formato Rust.

| Verificación final | Resultado |
| --- | --- |
| `npm.cmd run check` | Código 0: 69 pruebas, TypeScript y build web |
| `npm.cmd run test:python` | Código 0: 7 pruebas; incluye modelo real y CLI worker |
| `cargo test --locked` mediante wrapper local | Código 0: 12 pruebas, incluidas inferencia real, cancelación, rollback y reparse points |
| cargo check / cargo fmt --check | Código 0 en el entorno local |
| `npm.cmd run desktop:build:local -- --debug` | Código 0, ejecutable Windows con recursos locales |
| `npm.cmd run test:desktop` | Código 0: recorrido real WebView2/Tauri/Python/Tone con stream sintético |
| MIDI descargado desde la UI abierto con mido | PPQ 480; pitch, velocity, inicio y final coinciden con JSON |
| Samples MP3 | Cinco decodificados con soundfile y hashes verificados por la suite JS |
| `npm audit --omit=dev` | Código 0: 0 vulnerabilidades conocidas |
| Auditoría npm completa | Código 1: 6 entradas altas derivadas de picomatch, sin parche publicado; ver DEPENDENCIES |
| Revisión independiente de código | Sin hallazgos críticos/importantes después de correcciones |

El E2E sustituyó sólo getUserMedia por un MediaStream real sintetizado con
oscilador de 440 Hz, sin abrir micrófono físico. Probó denegación de permiso,
cancelación con stream tardío, captura WebM, liberación de tracks, guardado,
inferencia real, PPQ/MIDI, señal de piano no nula, parada, descarga de MIDI,
cancelación conservando JSON y recuperación de audio/notas. No hubo errores
de página/consola ni solicitudes externas de la página.

Informe final de ese recorrido:
`.cache/desktop-test/0a0ac139-2a66-4537-9ae6-9f159165f0ca/report.json`.
Nota observada: MIDI69, velocity113, startTick22, durationTicks2197. La señal
Web Audio del piano superó el umbral de prueba; eso no acredita escucha humana.
Se inspeccionó la captura `studio.png` del E2E anterior exitoso
`d1d049d7-e8e7-4ab5-9d2c-2095c7ffd6f0`, sin solapamientos visibles.

Problemas encontrados y corregidos:

- Una CSP sin worker-src bloqueaba el worker blob del reloj Tone y dejaba el
  piano sin señal. El E2E falló; se agregó únicamente `worker-src 'self' blob:`
  en desarrollo/producción y la señal del piano pasó la prueba.
- La primera instrumentación del stream sintético intentaba cerrar dos veces
  su contexto; se corrigió su stop idempotente. No era un acceso al micrófono real.
- La revisión detectó solicitud de permiso sin cancelar y riesgo de cancelar
  un trabajo nuevo por un ack tardío. Se agregaron guardas y se verificaron en E2E.
- Se alineó metadata de canales/duración original con el WAV derivado y se
  probaron estéreo y colas del codec. Python acepta hasta 384 kHz como el host.
- El guardado MIDI se revierte si falla el reemplazo JSON; prueba Windows real
  con project.json de sólo lectura. No se borran tomas ni logs ante errores.

Las primeras tres tomas sintéticas se movieron, sin borrarlas, a
`.cache/desktop-test/legacy-synthetic-projects`. Las pruebas posteriores usan
almacenamiento aislado debug por UUID, fuera de la biblioteca del usuario.

Pendiente para aceptar M01-A: grabación física y calidad vocal, escucha humana,
apertura en una DAW, reinicio manual y prueba del equipo desconectado. Build
release, empaquetado Python/modelos y distribución independiente no realizados.
No se hicieron commits, push ni publicaciones nuevas.

## Retoma y política permanente de sincronización — 2026-11-18

El usuario informó que el trabajo de otro equipo posiblemente no se había
sincronizado. Un fetch confirmó que origin/main seguía en 451ccbb y no había
ramas remotas adicionales para recuperar ese trabajo. Se continúa desde la
copia disponible en D:, sin afirmar que se recuperaron cambios del otro equipo.

Antes de modificar se respaldaron los 63 archivos fuente/configuración/recursos,
con hashes y diff, en `.cache/backups/2026-11-18-before-github-sync` (ignorado).
La implementación M01-A disponible se conserva en el commit
[e97cdef](https://github.com/MaharBa264/VOXEL/commit/e97cdef81a36efcc11b9662662ebb6c7826da95b).

La nueva instrucción autoriza commits y push normales de cambios, correcciones
y propuestas. AGENTS y DEVELOPMENT exigen revisar el remoto al empezar,
registrar resultados y publicar cada unidad de trabajo antes de cerrarla.
Las propuestas llevan estado explícito en docs/proposals o documentos de diseño.
No se publican grabaciones privadas, dependencias, caches ni builds.

Se incorporó `npm.cmd run sync:check`: consulta origin y falla ante archivos
modificados/nuevos, commits sin enviar, remoto adelantado, divergencia o falta
de upstream. Sólo inspecciona; no crea commits ni integra ni envía cambios.

Verificación ejecutada en esta retoma:

| Comprobación | Resultado |
| --- | --- |
| npm.cmd run check | Código 0: TypeScript, 76 pruebas JS y build web |
| npm.cmd run test:python | Código 0: 7 pruebas |
| node scripts/local-rust.mjs cargo test --locked --manifest-path src-tauri/Cargo.toml | Código 0: 12 pruebas |
| sync:check antes de publicar | Código 1 esperado: detectó los cambios sólo locales |

Las 7 pruebas nuevas usan repositorios Git locales reales y cubren sincronía,
modificaciones, propuestas nuevas, commits sin enviar, remoto nuevo, divergencia
y ausencia de upstream. En Windows necesitaron ampliar su timeout a 30 s.
El respaldo dentro de .cache hizo que Vitest descubriese tests duplicados:
se acotó el descubrimiento a tests/**/*.test.{ts,tsx}; luego pasó la suite completa.

No se modificó el comportamiento musical en esta retoma ni se repitió el E2E
nativo: su evidencia del 17/11 permanece arriba. Continúan pendientes voz real,
escucha humana, DAW y aceptación desconectada. La auditoría de desarrollo
mantiene el riesgo picomatch documentado en DEPENDENCIES.

La publicación se realiza en dos commits (implementación recuperada localmente
y política/verificación), conservando el historial. El cierre requiere ejecutar
sync:check después del envío y confirmar árbol limpio e igualdad con origin/main;
ese resultado se comunica con el enlace al commit publicado.
