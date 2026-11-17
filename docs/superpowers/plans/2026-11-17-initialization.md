# VOXEL — plan de inicialización

Objetivo: preparar una base local y verificable para M01-A, sin implementar audio.
Especificación: solicitud del usuario y `docs/ARCHITECTURE.md`.

## Decisiones de implementación

- Una aplicación raíz React/TypeScript con Vite y contenedor Tauri 2; evitar un monorepo hasta necesitarlo.
- Contratos Zod como fuente única de tipos TypeScript y JSON Schema generado para Python.
- Proyecto como carpeta: `project.json` y archivos originales en `audio/`; no incrustar audio en JSON.
- Python separado y diferido: no instalar Basic Pitch con un intérprete no compatible.
- Trabajar en esta carpeta vacía, sin inicializar Git ni crear commits.

## Pasos y verificación

- [x] Inspeccionar herramientas y contrastar requisitos con fuentes oficiales.
- [x] Crear configuración local y pruebas del contrato; ejecutar y observar el fallo antes de implementarlo.
- [x] Implementar validación estructural y relaciones (IDs, referencias de audio, rutas relativas).
- [x] Crear shell React y configuración Tauri mínima sin comandos privilegiados.
- [x] Generar JSON Schema y ejemplo; comprobar pruebas y compilación web.
- [x] Documentar procedimiento Windows, riesgos, resultados y archivos exactos.

## Casos que deben cubrir las pruebas

Versión desconocida; números MIDI/PPQ inválidos; rutas externas o con traversal;
referencias de audio inexistentes; IDs duplicados; conservación de referencias al audio al serializar.

## Registro

Estado inicial: carpeta vacía; `git status` falla porque no hay `.git`.
Node 24.19.0 y npm 12.0.2 disponibles. Rust/Cargo no están en PATH.
Python 3.12 y 3.14 detectados; Python 3.11 no detectado.
La autorización del usuario cubre la inicialización completa; se ejecuta directamente.

Ejecución: primera prueba falló por módulo de contrato ausente; luego 39 pruebas
del contrato pasaron. Cuatro pruebas de artefactos elevaron la suite a 43;
la incompatibilidad de regex del esquema Tauri se aisló y resolvió en el
validador de tests. Ajv actualizado a 8.20.0 por aviso de auditoría.
`npm ci`, `npm run check`, `npm run smoke:web` y auditoría final pasaron.
Compilación nativa bloqueada por ausencia de Cargo; no se instalaron herramientas.
Se añadió icono ICO provisional requerido por recursos Windows y feature
`custom-protocol` para el build Tauri. La revisión nativa no sustituye compilar.
Revisión independiente: detectó versiones Rust abiertas; se fijaron tauri
=2.12.6 y tauri-build =2.7.5 tras consultar crates.io/docs.rs (Rust mínimo
1.90). El lock transitivo y la compilación siguen pendientes.
