# Dependencias y compatibilidad

Revisión: 2026-11-17. No se instalaron dependencias globales ni se alteró
configuración externa. Versiones exactas JS en `package.json`; transitivas
y hashes en `package-lock.json`. El lock no sustituye las pruebas de plataforma.

| Componente | Selección | Evidencia / límite |
| --- | --- | --- |
| Node / npm | 24.19.0 / 12.0.2 | Ejecutados localmente; engines limita Node a 24 y npm a 12 |
| React / React DOM | 19.3.1 | Instalación, tipos y compilación web; no UI manual |
| TypeScript | 7.0.2 | Chequeo estricto sin emisión |
| Vite / plugin React | 8.3.8 / 6.3.0 | Plugin declara Vite ^8; Vite requiere Node ^20.19 o ≥22.12 |
| Vitest | 5.1.0 | Declara Vite 6.4/7/8 y Node 22.12/24/26+; suite ejecutada en Node 24 |
| Zod | 4.6.7 | Contratos, tipos inferidos y generación Draft 2020-12 comprobados |
| Ajv (sólo desarrollo) | 8.20.0 | Consume esquemas generados y valida configuración Tauri |
| Tauri API / CLI | 2.12.5 / 2.12.5 | CLI local ejecutada, configuración validada; no binario nativo |
| Tauri / tauri-build Rust | =2.12.6 / =2.7.5, Rust ≥1.90 | Versiones directas exactas, resolución transitiva y compilación pendientes |
| Tone.js | 15.1.22 | Instalado; Web Audio, tipos en uso y reproducción aún sin probar |
| Python / Basic Pitch | candidato 3.11 x64 / 0.4.0 | No instalado ni resuelto; no declarar compatible por anticipado |

Metadatos npm contrastados con `npm view` (engines y peerDependencies) y
árbol instalado con `npm ls --depth=0`, sin conflictos reportados.
La ausencia de conflictos npm no prueba audio ni compatibilidad en WebView2.

## Fuentes primarias

- [Vite: requisitos de Node](https://vite.dev/guide/).
- [Tauri 2: Windows y herramientas](https://v2.tauri.app/start/prerequisites/).
- [Tauri: configuración](https://v2.tauri.app/reference/config/).
- [Tauri Rust 2.12.6](https://docs.rs/tauri/2.12.6/tauri/) y [tauri-build 2.7.5](https://docs.rs/tauri-build/2.7.5/tauri_build/); metadatos de crates.io declaran Rust mínimo 1.90 para ambos.
- [Basic Pitch 0.4.0: dependencias](https://github.com/spotify/basic-pitch/blob/v0.4.0/pyproject.toml).
- [Basic Pitch: uso y formatos](https://github.com/spotify/basic-pitch/blob/main/README.md).
- [Tone.js: Web Audio y arranque por gesto](https://tonejs.github.io/).
- [Aviso Ajv detectado por npm audit](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6).

## Riesgos y decisiones

1. **Rust ausente:** Tauri requiere Cargo incluso para resolver metadatos. No
   se puede afirmar que la aplicación nativa compila o abre. Generar lock y
   comprobar el shell en Windows antes de comenzar captura. Se fijaron versiones
   directas exactas tras la revisión; las transitivas siguen sin lock, por lo
   que la reproducibilidad Rust está pendiente.
2. **Basic Pitch y Python:** el paquete 0.4.0 declara Python 3.8–3.11 y, en
   Windows con Python ≥3.11, TensorFlow >=2.4.1,<2.15.1. Los Python 3.12 y
   3.14 locales no satisfacen una combinación validada. Elegir 3.11 es una
   propuesta basada en metadatos, no un resultado de instalación/inferencia.
   Resolver un entorno y congelar transitivas antes de M01-A.
3. **Producto independiente:** empaquetar Python, dependencias nativas y modelo,
   respetar licencias y probar en Windows limpio sin Python ni conexión.
   Ninguno de esos artefactos se incluye en esta entrega.
4. **Web Audio/captura:** probar permisos, codecs y disponibilidad de micrófono
   en WebView2 real. Las APIs web y los permisos nativos pueden diferir del navegador.
   Tone requiere arranque desde interacción; el piano necesita samples locales
   con licencia o una decisión explícita de instrumento. No usar CDN.
5. **Datos originales:** rutas validadas léxicamente no bastan para impedir
   reparse points ni probar existencia. El guardado futuro debe validar en el
   host, escribir atómicamente y no destruir fuentes ni migrar sin respaldo.
6. **JSON Schema:** no representa las refinaciones de IDs únicos, referencias,
   rutas y suma segura de ticks. Usar `parseProject` como validación autoritativa;
   implementar comprobaciones equivalentes si Python carga proyectos.
7. **Instalación npm:** npm 12 bloqueó postinstall de esbuild. Los comandos
   probados funcionan con su binario opcional en este equipo; verificar en
   otros Windows. No cambiar configuración global para silenciar la advertencia.
8. **Licencias y distribución:** el proyecto todavía no tiene licencia elegida,
   firma de ejecutables, instalador ni inventario completo de licencias transitivas.
   La auditoría npm sólo cubre avisos conocidos, no garantiza ausencia de fallos.

## Problemas encontrados durante la verificación

- Ajv 8.17.1 inicial tenía un aviso moderado ReDoS con la opción `$data`.
  Se actualizó puntualmente a 8.20.0; no se usó `npm audit fix --force`.
- El JSON Schema de la CLI Tauri usa un patrón de `productName` con escapes
  que JavaScript rechaza bajo el flag Unicode `u`. Se reprodujo el patrón
  con/sin ese flag. El test usa `unicodeRegExp: false` sólo para ese esquema
  de terceros, conservándolo intacto. No se relajaron los esquemas de proyecto.
- `tauri info` retorna código 0 aun cuando indica ausencia de Rust: su salida
  debe leerse, no tratar el código como prueba de compilación.
