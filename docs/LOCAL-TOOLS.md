# Herramientas de desarrollo locales en D:

Para evitar instalaciones globales y mantener caches grandes fuera de C:,
esta copia usa Rust en `.tools/` y temporales en `.cache/`, dentro del proyecto.
Ambas carpetas están ignoradas por Git. Esto prepara el entorno de desarrollo;
no empaqueta Rust ni Python en la aplicación distribuida.

## Estado

Rust y Cargo 1.100.0, target `x86_64-pc-windows-msvc`, instalados localmente el
2026-11-17 con perfil mínimo y `--no-modify-path`. El instalador se descargó
de `static.rust-lang.org` y se contrastó su SHA-256 con el archivo oficial.
No es necesario añadir Rust al PATH de Windows ni ejecutar PowerShell como administrador.
MSVC Build Tools 2022 y WebView2 ya estaban presentes.

## Usar esta copia

```powershell
Set-Location D:\Proyectos\VOXEL
npm.cmd run rust:local -- rustc --version
npm.cmd run rust:local -- cargo --version
npm.cmd run rust:local -- cargo check --locked --manifest-path src-tauri/Cargo.toml
npm.cmd run rust:local -- cargo test --locked --manifest-path src-tauri/Cargo.toml
npm.cmd run desktop:dev:local
```

El script Node configura `CARGO_HOME`, `RUSTUP_HOME`, `CARGO_TARGET_DIR`,
PATH y los temporales sólo para el proceso hijo. Al cerrar el comando no se
alteran las variables persistentes del usuario o del sistema. `cargo` puede
seguir sin reconocerse si se invoca directamente: usar el wrapper local.

`desktop:dev:local` inicia Vite y el contenedor nativo. Mantener esa terminal
abierta mientras se usa la aplicación. Para detenerlo, Ctrl+C; si Windows
pregunta si termina el trabajo por lotes, responder **S**. Volver al prompt
de PowerShell indica que el comando dejó de ejecutarse.

Para compilar un ejecutable sin instalador:

```powershell
npm.cmd run desktop:build:local
```

La compilación nativa y los resultados efectivamente obtenidos se registran
en `STATUS.md`. Un build no prueba permisos del micrófono ni salida audible.

## Reponer las herramientas en otra copia Windows

Este procedimiento requiere red y MSVC/WebView2 previamente disponibles.
No instalar herramientas por fuera del proyecto para eludir un error.
En una terminal PowerShell dedicada, desde la raíz del proyecto:

```powershell
$voxelRoot = (Resolve-Path .).Path
$voxelDownloads = Join-Path $voxelRoot '.tools\downloads'
$voxelTemp = Join-Path $voxelRoot '.cache\tmp'
New-Item -ItemType Directory -Force -Path $voxelDownloads,$voxelTemp | Out-Null
$voxelInstaller = Join-Path $voxelDownloads 'rustup-init.exe'
$voxelUrl = 'https://static.rust-lang.org/rustup/dist/x86_64-pc-windows-msvc/rustup-init.exe'
Invoke-WebRequest -Uri $voxelUrl -OutFile $voxelInstaller
Invoke-WebRequest -Uri ($voxelUrl + '.sha256') -OutFile ($voxelInstaller + '.sha256')
$voxelExpected = ((Get-Content ($voxelInstaller + '.sha256') -Raw).Trim() -split '\s+')[0]
if ((Get-FileHash $voxelInstaller -Algorithm SHA256).Hash -ine $voxelExpected) {
    throw 'SHA-256 del instalador incorrecto'
}
$env:CARGO_HOME = Join-Path $voxelRoot '.tools\cargo'
$env:RUSTUP_HOME = Join-Path $voxelRoot '.tools\rustup'
$env:TEMP = $voxelTemp
$env:TMP = $voxelTemp
& $voxelInstaller -y --no-modify-path --profile minimal --default-host x86_64-pc-windows-msvc --default-toolchain stable
if ($LASTEXITCODE -ne 0) { throw 'Falló rustup' }
```

Cerrar esa terminal elimina los cambios de variables de esa sesión. `stable`
puede entregar otro compilador en el futuro: comprobar la versión antes de
comparar resultados. Para reproducir el compilador usado aquí, reemplazar
`stable` por `1.100.0`. Cargo.lock fija dependencias, no la versión del compilador.

Fuentes: [requisitos Tauri](https://v2.tauri.app/start/prerequisites/) y
[opciones de rustup-init](https://rust-lang.github.io/rustup/installation/other.html).

## Python y audio

Python 3.11.15 y Basic Pitch 0.4.0 ya están aprovisionados localmente en D:.
Se comprobó inferencia real sobre silencio y La4 sintética con TensorFlow CPU.
Usar los comandos de [python/README.md](../python/README.md):

```powershell
npm.cmd run python:setup
npm.cmd run python:check
npm.cmd run test:python
```

No usar accidentalmente los Python 3.12/3.14 del equipo. El wrapper instala
sin registro Windows ni ejecutables en el bin del usuario; no cambia su Python
predeterminado. La grabación y el piano ya están integrados; su aceptación con
micrófono y escucha reales está en [M01-A-TESTING.md](M01-A-TESTING.md).
