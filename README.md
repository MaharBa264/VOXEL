# VOXEL — Voice to Music Studio

Base de desarrollo de una aplicación local para Windows 11 que permitirá
componer cantando, tarareando, silbando y grabando percusión.

La [visión de producto](docs/VISION.md) describe los flujos de composición
multipista, desde una toma o desde una armonía.

**Estado actual:** M01-A implementado en desarrollo: grabación corta, audio
original conservado, transcripción local con Basic Pitch, notas PPQ, piano
muestreado local, descarga MIDI y recuperación de tomas. El flujo nativo pasó
con entrada sintética; falta aceptar el resultado con micrófono y escucha reales.

## Probar una melodía en este equipo

```powershell
Set-Location D:\Proyectos\VOXEL
npm.cmd run desktop:dev:local
```

1. Elegí el tempo de la próxima toma (40–240 BPM) y pulsá **Grabar melodía**.
2. Permití el micrófono, cantá o tarareá una sola línea sin acompañamiento
   y pulsá **Detener grabación**. Se detiene automáticamente a los 30 segundos.
3. Pulsá **Transcribir melodía**. La primera ejecución puede tardar;
   **Cancelar transcripción** detiene el proceso y conserva el proyecto anterior.
4. Usá **Escuchar piano**, **Descargar MIDI** o el reproductor del original.
5. Desde **Proyecto guardado → Abrir**, recuperá audio y notas después de reiniciar.

Las tomas se guardan en `projects/<UUID>` dentro de este workspace en D:.
Cada grabación crea un proyecto nuevo; las notas no se editan manualmente todavía.
El tempo de una toma guardada queda fijado. La vista `npm run dev` en el
navegador muestra la interfaz, pero exige la app nativa para estos flujos.
Esta versión de desarrollo necesita el workspace y `.venv`; no es un instalador independiente.

Repositorio: [MaharBa264/VOXEL](https://github.com/MaharBa264/VOXEL).
La carpeta de trabajo de este equipo es `D:\Proyectos\VOXEL`.
El usuario confirmó su selección en Codex después del traslado desde C:.

## Obtener el proyecto

Si ya trabajás en `D:\Proyectos\VOXEL`, usá esa copia; no clones encima.
En otro equipo, o en una carpeta nueva cuyo destino no exista:

```powershell
git clone https://github.com/MaharBa264/VOXEL.git VOXEL
Set-Location VOXEL
```

El repositorio contiene las fuentes, configuración, documentación, contratos,
ejemplos y pruebas. `node_modules`, `dist`, entornos Python, grabaciones y
proyectos personales no se publican; las dependencias se restauran con el lock.

## Ejecutar en Windows (PowerShell)

Abrir una terminal en esta carpeta. Referencia probada: Node **24.19.0**, npm
**12.0.2**, Windows x64. Las dependencias se instalan sólo en `node_modules`.
Se usa `npm.cmd` para no depender de la política de ejecución de scripts de PowerShell.

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run check
npm.cmd run smoke:web
npm.cmd run dev
```

Abrir http://127.0.0.1:1420 y detener con Ctrl+C. Es una vista web del shell,
no una prueba del ejecutable Windows. `smoke:web` inicia y cierra su propio
servidor; ejecutar con el puerto 1420 libre y sin otro `dev` en ejecución.
`check` ejecuta chequeo TypeScript, pruebas y compilación web.
`npm.cmd run test:watch` mantiene las pruebas observando cambios.

La primera instalación necesita red. npm 12 puede informar que bloqueó el
postinstall de esbuild: en este entorno las verificaciones pasaron usando el
binario opcional instalado. No habilitar scripts globalmente; si falla en otro
equipo, investigar el paquete exacto antes de modificar la política local.

## Escritorio Tauri

Requisitos externos que el proyecto **no instala ni modifica**: Rust estable ≥1.90
con target MSVC x64 y Cargo, Microsoft C++ Build Tools/Windows SDK y WebView2.
Consultar [prerrequisitos oficiales](https://v2.tauri.app/start/prerequisites/).
El diagnóstico inicial detectó MSVC y WebView2, pero no Rust/Cargo en PATH.
Ahora existe una instalación de Rust local al proyecto en D:, con
[instrucciones propias](docs/LOCAL-TOOLS.md). En esta copia usar
`npm.cmd run desktop:dev:local`; los comandos siguientes son la alternativa
para un entorno que ya tenga Rust disponible en PATH.

Cuando un entorno autorizado ya disponga de esas herramientas:

```powershell
npm.cmd run tauri -- info
rustc --version
cargo --version
Push-Location src-tauri
cargo check --locked
cargo test --locked
Pop-Location
npm.cmd run desktop:dev
npm.cmd run desktop:build
```

Conservar `src-tauri/Cargo.lock`, generado al resolver las dependencias con
la instalación local de Rust; no regenerarlo rutinariamente. Consultar
`docs/STATUS.md` para los resultados nativos reales. `desktop:build` solicita el ejecutable sin instalador;
el bundling está desactivado hasta diseñar distribución y runtime Python.

## Contratos y documentación

- [Arquitectura y formato v1](docs/ARCHITECTURE.md)
- [Dependencias, compatibilidad y riesgos](docs/DEPENDENCIES.md)
- [Resultados y archivos de esta entrega](docs/STATUS.md)
- [Desarrollo, Git y verificaciones](docs/DEVELOPMENT.md)
- [Rust local en D: y comandos de escritorio](docs/LOCAL-TOOLS.md)
- [Hitos y criterios de aceptación](docs/ROADMAP.md)
- [Pruebas y aceptación manual de M01-A](docs/M01-A-TESTING.md)
- [Reglas para agentes](AGENTS.md)
- [Ejemplo vacío](examples/empty-project.json)
- [Entorno Basic Pitch y prueba de inferencia local](python/README.md)

`src/domain/project.ts` define los contratos. Tras cambiarlos, ejecutar:

```powershell
npm.cmd run schemas:generate
npm.cmd run check
```

Los esquemas en `schemas/` son generados; las pruebas detectan desincronización.
No hay licencia de distribución asignada al proyecto todavía. La publicación
inicial en GitHub fue autorizada por el usuario; el historial Git registra los
commits efectivos. Desde el 2026-11-18, por instrucción del usuario, cada cambio,
corrección y propuesta debe quedar versionado y enviado a GitHub. Antes de
cerrar una tarea ejecutar `npm.cmd run sync:check`: exige árbol limpio y HEAD
igual al upstream recién consultado. Ver [flujo de trabajo](docs/DEVELOPMENT.md).
La aceptación manual de M01-A está pendiente.
