# VOXEL — Voice to Music Studio

Base de desarrollo de una aplicación local para Windows 11 que permitirá
componer cantando, tarareando, silbando y grabando percusión.

**Estado actual:** shell React/Tauri y contratos versionados. Aún no hay captura,
transcripción, exportación MIDI, reproducción ni persistencia de proyectos.

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
El diagnóstico local detectó MSVC y WebView2, pero no Rust/Cargo.

Cuando un entorno autorizado ya disponga de esas herramientas:

```powershell
npm.cmd run tauri -- info
rustc --version
cargo --version
Push-Location src-tauri
cargo generate-lockfile
cargo check --locked
cargo test --locked
Pop-Location
npm.cmd run desktop:dev
npm.cmd run desktop:build
```

Generar y revisar `src-tauri/Cargo.lock` una vez y conservarlo para futuras
ejecuciones; no regenerarlo rutinariamente. Esta etapa no tiene lock Rust
porque Cargo no está disponible. El procedimiento nativo está documentado,
**no verificado**. `desktop:build` solicita el ejecutable sin instalador;
el bundling está desactivado hasta diseñar distribución y runtime Python.

## Contratos y documentación

- [Arquitectura y formato v1](docs/ARCHITECTURE.md)
- [Dependencias, compatibilidad y riesgos](docs/DEPENDENCIES.md)
- [Resultados y archivos de esta entrega](docs/STATUS.md)
- [Desarrollo, Git y verificaciones](docs/DEVELOPMENT.md)
- [Hitos y criterios de aceptación](docs/ROADMAP.md)
- [Reglas para agentes](AGENTS.md)
- [Ejemplo vacío](examples/empty-project.json)
- [Motor Python pendiente](python/README.md)

`src/domain/project.ts` define los contratos. Tras cambiarlos, ejecutar:

```powershell
npm.cmd run schemas:generate
npm.cmd run check
```

Los esquemas en `schemas/` son generados; las pruebas detectan desincronización.
No hay licencia de distribución asignada al proyecto todavía. La publicación
inicial en GitHub fue autorizada por el usuario; el historial Git registra los
commits efectivos. El siguiente hito será **M01-A**, aún pendiente.
