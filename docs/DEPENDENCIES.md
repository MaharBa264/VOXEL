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
| ajv-formats (sólo desarrollo) | 3.0.1 | Registra URI, UUID y formatos OpenAPI del esquema Tauri; compatible con Ajv ^8 |
| Tauri API / CLI | 2.12.5 / 2.12.5 | Configuración validada y ejecutable debug compilado; ventana aún no comprobada |
| Tauri / tauri-build Rust | =2.12.6 / =2.7.5 | Cargo.lock generado; check, test y build debug con Rust 1.100.0 local |
| Tone.js | 15.1.22 | Sampler local y señal Web Audio comprobados en WebView2; escucha humana pendiente |
| Playwright (sólo desarrollo) | 1.65.1 | E2E vía CDP contra WebView2 instalado, sin descargar navegador |
| Python / Basic Pitch | 3.11.15 x64 / 0.4.0 | Inferencia sintética real CPU comprobada, lock de 66 paquetes; sin integración UI |

Metadatos npm contrastados con `npm view` (engines y peerDependencies) y
árbol instalado con `npm ls --depth=0`, sin conflictos reportados.
La ausencia de conflictos npm no prueba audio ni compatibilidad en WebView2.
El recorrido nativo M01-A fue probado por separado; ver `M01-A-TESTING.md`.

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
   3.14 locales no satisfacen una combinación validada. Ahora se probó un
   entorno 3.11.15 con TensorFlow 2.14.0; el lock y la prueba de modelo local
   están en `python/`. No se ha medido precisión con voz ni latencia de producto.
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
- La prueba Tauri ignoraba formatos URI, UUID y numéricos. Se reprodujo con
  pruebas que aceptaban datos inválidos. Se agregó `ajv-formats`, validación
  explícita de uint8/uint32 y rechazo de números no finitos y formatos desconocidos.
  No se desactivó el logger ni la validación de formatos para ocultar los avisos.
  Fuente: [formatos de Ajv](https://ajv.js.org/packages/ajv-formats.html).

Actualización de entorno: Rust/Cargo 1.100.0 ahora están instalados dentro del
proyecto, fuera de PATH global. Cargo.lock se generó con la resolución inicial;
ver `LOCAL-TOOLS.md` y `STATUS.md` para comandos y resultados de compilación.
Los puntos anteriores sobre ausencia de Rust describen la inspección inicial.
El compilador probado es 1.100.0. El mínimo 1.90 declarado en Cargo.toml y en
las dependencias directas no acredita compatibilidad de todo el lock con
Rust 1.90: esa combinación no se probó. No se verificó build release ni instalador.

## Resolución Python comprobada

El resolvedor inicial aceptó TensorFlow 2.14.0 con NumPy 2.4.6: la importación
falló por ABI (`_ARRAY_API not found`). Con NumPy 1.26.4 apareció una segunda
incompatibilidad: `resampy 0.4.2` requiere `pkg_resources`, eliminado de
setuptools 82+. Se fijó setuptools 81.0.0. Con esas restricciones pasaron dos
pruebas de inferencia real y `uv pip check` validó los 66 paquetes instalados.
No se modificaron fuentes de bibliotecas externas.

## Auditoría actualizada durante M01-A

La consulta completa de npm ahora reporta 6 entradas altas que derivan de
un mismo aviso ReDoS en picomatch <=4.0.7, usado por Vite/Vitest y herramientas
transitivas. La versión publicada más reciente consultada fue 4.0.7;
4.0.8 respondió 404 y el aviso no declara parche. No se ejecutó audit fix
--force ni se degradó el toolchain. El servidor de desarrollo sigue limitado
a loopback y la app no acepta globs de usuario como parte del flujo musical.
Esto no elimina el aviso: queda pendiente una corrección soportada.

`npm audit --omit=dev` retornó 0 vulnerabilidades conocidas; ese resultado
sólo cubre npm de producción, no Python ni Rust. Los 0 avisos de revisiones
anteriores fueron resultados históricos de esas consultas, no una garantía.
Fuente: [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf).

El piano incluye cinco MP3 Salamander de Alexander Holm, CC BY 3.0, obtenidos
del commit `efd8296360f9526e379bfbe5c1698ff54d6a1d34` de Tonejs/audio. Bytes
y SHA-256 están en `public/piano/manifest.json`; atribución en esa carpeta y UI.
Se verificó decodificación de los cinco MP3 y señal del Sampler en WebView2.

El lock Windows/Python 3.11 incluye hashes y no debe usarse como lock universal.
Los builds de distribuciones fuente pueden requerir herramientas auxiliares
no fijadas por el lock de runtime; no se promete reproducción binaria idéntica.
Persisten avisos de APIs deprecadas y una división inválida del postprocesador
sobre silencio, aunque produjo cero notas y tensores finitos. No se ha hecho
auditoría de vulnerabilidades Python ni una prueba del equipo físicamente
desconectado. Ver [procedimiento y límites](../python/README.md).
