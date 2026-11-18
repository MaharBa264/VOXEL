# Desarrollo y mantenimiento

## Ubicación y fuente de trabajo

En el equipo de desarrollo, la carpeta activa es `D:\Proyectos\VOXEL`.
El usuario confirmó que la seleccionó en Codex. El traslado conservó fuentes,
dependencias locales y artefactos de build: 8088 archivos, verificados con
SHA-256 antes de cambiar documentación. Esa cantidad incluye archivos que
no se versionan. El original en C: quedó pendiente de eliminación al terminar
la copia; no usarlo para desarrollo ni asumir que el traslado liberó espacio.

El repositorio canónico es [MaharBa264/VOXEL](https://github.com/MaharBa264/VOXEL).
Un clon en otro equipo puede vivir en otra ruta; ninguna fuente depende de D:.
La guía de arranque está en el [README](../README.md).

## Verificar una copia

En PowerShell, dentro de la carpeta de proyecto:

```powershell
git status --short --branch
git remote -v
node --version
npm.cmd --version
npm.cmd ci
npm.cmd run check
npm.cmd run smoke:web
```

Versiones de referencia: Node 24.19.0 y npm 12.0.2. No instalar paquetes globales
ni cambiar ExecutionPolicy. El smoke inicia su propio servidor: liberar antes
el puerto 1420. `check` verifica tipos, 76 pruebas actuales y build web; el
número de pruebas puede aumentar al desarrollar nuevos hitos.

La instalación necesita red para descargar paquetes. Esto no equivale a usar
IA remota para transcribir: el procesamiento musical futuro deberá ser local.
La advertencia del postinstall de esbuild y las limitaciones nativas están
registradas en [DEPENDENCIES.md](DEPENDENCIES.md).

## Qué significa cada comprobación

| Comando | Acredita | No acredita |
| --- | --- | --- |
| `npm.cmd ci` | Restauración del árbol JS desde lock | Instalación de Rust, Python o modelos |
| `npm.cmd run check` | Tipos, contratos y compilación web | Captura, inferencia, reproducción o ejecutable Windows |
| `npm.cmd run smoke:web` | Respuestas HTTP y transformación de módulos Vite | Ejecución de React en navegador o WebView2 |
| `npm.cmd audit` | Avisos conocidos del árbol npm al consultar | Ausencia de fallos o validación de dependencias Python/Rust |
| `npm.cmd run tauri -- info` | Diagnóstico del entorno | Build válido: puede retornar 0 con requisitos ausentes |

La integración M01-A ya compila en debug con Rust 1.100.0 y Cargo.lock;
ver [herramientas locales](LOCAL-TOOLS.md) y [pruebas M01-A](M01-A-TESTING.md).
El test WebView2 usa entrada sintética y los componentes reales; micrófono
físico, escucha y build release requieren comprobaciones separadas.
No se configuró CI en GitHub en esta entrega.

## Contratos y cambios

Leer primero [AGENTS.md](../AGENTS.md) y [ARCHITECTURE.md](ARCHITECTURE.md).
Para cambiar contratos: modificar la fuente Zod, agregar pruebas del límite
de datos afectado, ejecutar `npm.cmd run schemas:generate` y `npm.cmd run check`.
No editar a mano los esquemas generados. Validar entradas con `parseProject`.
La validación semántica no está íntegramente representada en JSON Schema.

Mantener notas en PPQ, audio original por archivos y futuras conversiones como
derivados. Los próximos hitos deben demostrar guardado y reapertura reales;
la prueba actual de JSON en memoria no prueba persistencia en disco.

## Git y publicación

Desde el 2026-11-18 el usuario autoriza commits y push normales del trabajo de
VOXEL para mantener **todo cambio, corrección y propuesta en GitHub**. Se
reemplaza la autorización anterior limitada a la publicación inicial. La
publicación de propuestas no implica que estén aprobadas o implementadas.
Releases, despliegues, instalaciones globales y force push quedan fuera.

Antes de una publicación autorizada:

1. Revisar el estado local y el remoto; preservar historial y cambios ajenos.
2. Ejecutar las comprobaciones aplicables y leer sus resultados completos.
3. Revisar los archivos incluidos: excluir grabaciones privadas, secretos,
   `node_modules`, `dist`, `.venv`, `target` y proyectos personales.
4. Publicar sin force push y comprobar que el SHA esperado está en GitHub.
5. Registrar en STATUS qué se verificó y qué quedó pendiente; ejecutar
   `npm.cmd run sync:check` y entregar el enlace al commit. No presentar la
   publicación como un release instalable.

Al empezar en otro equipo, consultar primero el remoto. Al terminar una unidad
de trabajo, commit y envío forman parte de la tarea. Si el avance no pasa
pruebas, publicarlo en una rama de trabajo con su estado claramente documentado.
Si la conexión falla, guardar respaldo y explicar qué sigue sin sincronizar.
No tratar un commit local o un resultado antiguo de fetch como confirmación remota.

Las propuestas se registran en [docs/proposals](proposals/README.md) o en un
diseño versionado. Mantener contexto, alternativas, estado y decisión, incluso
si no se implementa código. No guardar nuevas ideas únicamente en el chat.

`.gitignore` excluye dependencias, builds y datos de trabajo. `.gitattributes`
normaliza texto a LF y conserva el ICO como binario. El lock npm, esquemas
generados, icono provisional y Cargo.lock sí se versionan. `.tools`, `.cache`
y esquemas auxiliares de Tauri en `src-tauri/gen/schemas` son artefactos locales ignorados.

Sin licencia de proyecto elegida, esta publicación no asigna una licencia
de código abierto ni resuelve las licencias de runtimes, modelos o piano.
