# Convenciones de VOXEL

## Alcance y autorización

- Objetivo: Windows 11, Tauri 2, React/TypeScript, Python + Spotify Basic Pitch
  local y reproducción Tone.js. Leer `docs/ARCHITECTURE.md` y `docs/STATUS.md`.
- M01-A integra captura, transcripción local, PPQ/MIDI y piano. Ver
  `docs/M01-A-TESTING.md`: la aceptación con voz real está pendiente.
  No añadir percusión ni armonización fuera de un hito solicitado.
- El usuario autorizó el 2026-11-18 mantener en GitHub todos los cambios,
  correcciones y propuestas de VOXEL. Esta autorización cubre commits y push
  normales del trabajo del proyecto, sin pedir confirmación cada vez.
- No instalar dependencias globales ni publicar releases/desplegar aplicaciones
  sin autorización específica. No hacer force push ni reescribir historial ajeno.
- No modificar configuración externa. Dependencias JS locales con `npm ci`;
  Python futuro en `.venv` dentro del proyecto. No ejecutar `pip` global.
- No enviar grabaciones ni transcripciones a servicios externos.
- Carpeta activa en este equipo: `D:\Proyectos\VOXEL`. La copia anterior en C:
  no es la carpeta de desarrollo; ejecutar comandos en D: explícitamente.
- Repositorio canónico: `https://github.com/MaharBa264/VOXEL.git`.
  GitHub es el registro compartido del trabajo entre equipos. No considerar
  terminada una tarea mientras sus cambios y decisiones existan sólo localmente.

## Sincronización obligatoria entre equipos

- Al empezar: ejecutar fetch y revisar estado, diferencias y upstream antes
  de editar. Integrar cambios remotos preservando modificaciones locales.
- Mantener cambios acotados. Ejecutar comprobaciones aplicables, registrar
  resultados y limitaciones, crear commit y enviarlo a GitHub al cerrar cada
  unidad de trabajo. No acumular trabajo únicamente en un equipo.
- Registrar también propuestas no implementadas en `docs/proposals/` o en
  un documento de diseño, con estado explícito, contexto y decisión pendiente.
  Publicarlas como propuestas; no presentarlas como aprobadas o implementadas.
- Si las pruebas fallan, conservar el avance en una rama de trabajo publicada
  y documentar el fallo. No presentar esa rama como una entrega validada.
- Antes de cerrar la tarea: ejecutar `npm.cmd run sync:check`. Debe confirmar
  árbol limpio y HEAD igual al upstream recién consultado. Entregar el enlace
  al commit o rama publicada. Commit local sin envío no equivale a sincronizar.
- Si GitHub o la conexión fallan, conservar respaldo local y reportar claramente
  qué no se pudo enviar; no afirmar que se publicó. Reintentar cuando sea viable.
- Nunca incluir credenciales, grabaciones privadas, proyectos personales,
  dependencias, caches o builds ignorados. Sincronizar fuentes, contratos,
  documentación y tests, con sus locks y recursos redistribuibles.

## Código y contratos

- TypeScript estricto. Código e identificadores en inglés; documentación y UI en español.
- `src/app` presenta; `src/domain` no depende de UI, Tauri ni audio.
  Comandos y acceso al sistema corresponden a `src-tauri`.
- `src/domain/project.ts` es la fuente única del contrato. Inferir tipos Zod;
  regenerar `schemas/` con `npm run schemas:generate` cuando cambie.
- Validar JSON externo con `parseProject`; no sustituir validación por `as Project`.
  JSON Schema exportado no incluye todas las reglas semánticas.
- Notas con tiempo PPQ entero y velocity MIDI 1–127. No almacenar segundos
  como tiempo de notas. No destruir originales para crear derivados.
- No cambiar silenciosamente schemaVersion ni migrar sobre el único original.
- Dependencias directas con versión exacta y `package-lock.json` actualizado.
  Conservar `src-tauri/Cargo.lock`; para Rust aislado en este equipo ver `docs/LOCAL-TOOLS.md`.
- No agregar permisos amplios, shell genérico o acceso de red por comodidad.

## Cambios y verificación

- Cambios acotados y pruebas de comportamiento en límites de datos.
- Antes de modificar, inspeccionar archivos actuales y respetar trabajo existente.
- Ejecutar `npm run check`; para cambios nativos, además `cargo check` y
  `cargo test` desde `src-tauri`, y prueba manual Windows cuando sea relevante.
- No afirmar que grabación, inferencia, reproducción o instalador funcionan
  sólo porque TypeScript compila. Registrar comandos, códigos de salida,
  limitaciones y pruebas pendientes en `docs/STATUS.md`.
- Documentar decisiones y riesgos; no inventar APIs, resultados ni funcionalidades.
- No agregar pruebas que sólo busquen cadenas en el código o dupliquen constantes.

## Prerrequisitos ausentes

Si falta una herramienta, registrar la evidencia y continuar con verificaciones
independientes. No instalar globalmente ni cambiar políticas de PowerShell,
PATH, permisos del micrófono o configuración del equipo para eludir el problema.
