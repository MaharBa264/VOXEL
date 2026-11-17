# Estado de la inicialización — 2026-11-17

## Estado actual

- Carpeta activa: `D:\Proyectos\VOXEL`; selección en Codex confirmada por el usuario.
- Repositorio canónico: https://github.com/MaharBa264/VOXEL.
- Base local: contratos v1, shell React/Tauri, pruebas y documentación.
- Publicación inicial autorizada por el usuario el 2026-11-17. Se inicializó
  Git local en D: y se configuró ese repositorio como `origin`; el historial
  de `main` y la comprobación de SHA local/remoto acreditan la publicación efectiva.
- Sin reconocimiento, percusión, armonización, grabación o reproducción implementados.
- Rust/Cargo y Python 3.11/Basic Pitch siguen pendientes; no hay validación nativa.

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

No se ejecutaron `cargo check`, `cargo test`, ejecutable Windows, instalador,
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

- Disponer de Rust/Cargo en un entorno autorizado; generar y revisar
  `src-tauri/Cargo.lock`, compilar y abrir el shell Windows.
- Validar un entorno Python 3.11/Basic Pitch 0.4.0 y fijar sus transitivas.
- Diseñar runtime Python/modelo empaquetados, instalador, licencias y firma.
- M01-A completo: captura real, originales conservados, transcripción local,
  conversión PPQ/MIDI y piano con recursos locales, con pruebas sin conexión.
- Persistencia atómica, validación real de rutas/archivos y migraciones cuando
  se implemente almacenamiento; no están resueltas por este contrato.

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
