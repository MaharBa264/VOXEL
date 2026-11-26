# Entorno Basic Pitch — Windows x64 / Python 3.11

Entorno y worker M01-A verificados con el modelo real, integrados con Rust y
la UI. El test nativo usa un stream sintético; no evalúa precisión vocal ni
micrófono físico. El worker CLI se describe al final.

## Versiones verificadas

| Componente | Versión |
| --- | --- |
| CPython x64 (distribución standalone de Astral) | 3.11.15 |
| uv ya disponible en el equipo | 0.12.3 |
| Basic Pitch | 0.4.0 |
| TensorFlow / tensorflow-intel CPU | 2.14.0 |
| NumPy | 1.26.4 |
| setuptools | 81.0.0 |

`requirements.in` fija las dependencias directas y restricciones justificadas.
`requirements-windows-py311.txt` contiene 66 paquetes con versiones y hashes;
está dirigido exclusivamente a este Python y plataforma. No es un lock universal.

Se detectaron y reprodujeron dos incompatibilidades que los metadatos del
resolvedor no impedían: TensorFlow 2.14 no cargaba con NumPy 2.4.6, y
`resampy 0.4.2` importaba `pkg_resources`, ausente en setuptools 84.2.1.
NumPy 1.26.4 y setuptools 81.0.0 resolvieron esos errores sin editar paquetes
de terceros. Mantener esas restricciones hasta validar un reemplazo completo.

## Preparar y comprobar

Usar la herramienta `uv` ya instalada (comprobada con `uv --version`), sin
instalar paquetes globales. Desde la raíz del repositorio:

```powershell
npm.cmd run python:setup
npm.cmd run python:check
npm.cmd run test:python
```

El setup instala Python 3.11.15 bajo `.tools/python` con `--no-bin` y
`--no-registry`, crea `.venv` si no existe y sincroniza el lock con
`--require-hashes`. No activa un entorno ni cambia PATH, políticas de
PowerShell o el registro de Python en Windows. Un entorno preexistente con
otra versión se rechaza; no se elimina ni se sustituye automáticamente.

`uv` es un requisito del procedimiento de desarrollo, no del usuario final
de VOXEL. No se instaló ni actualizó globalmente en esta tarea. El wrapper
falla si no lo encuentra; no recurre a `pip` global ni al Python predeterminado.

Caches y temporales del procedimiento van a `.cache` dentro del proyecto.
El setup necesita red para descargar Python y paquetes; las pruebas usan el
modelo incluido localmente en Basic Pitch. No ejecutar este proceso sobre
otro `.venv` mientras esté siendo usado por una transcripción.

Para cambiar dependencias, editar `requirements.in`, ejecutar
`node scripts/local-python.mjs lock`, revisar el diff del lock y repetir setup,
check e inferencia. No regenerar el lock como parte de cada arranque.
Los hashes fijan descargas, no garantizan builds bit a bit de distribuciones fuente.

## Qué demuestra el smoke test

`test_runtime.py` usa unittest y el modelo real con TensorFlow CPU. Genera
dos WAV mono de 2,5 segundos a 22050 Hz bajo `.cache/basic-pitch-smoke`:

- Silencio: espera cero notas.
- Fundamental de 440 Hz con armónicos y envolvente: espera una nota MIDI 69.

Comprueba tensores finitos, tiempos/velocidades MIDI, escritura y lectura real
de MIDI y hash del audio original antes/después. El resultado observado fue
0 eventos para silencio y 1 evento, pitch 69, para La4. Conserva WAV, MIDI y
`report.json` con versiones, hashes de modelo y resultados. Esos artefactos
locales no se versionan y no usan grabaciones personales.

Durante imports e inferencia se bloquean connect/connect_ex, create_connection
y getaddrinfo del módulo socket. Se observaron cero intentos. Esa prueba es
de alcance Python: no es un firewall ni una auditoría de red de bibliotecas C.
La prueba completa con el equipo desconectado sigue pendiente para M01-A.

## Advertencias observadas y límites

Basic Pitch avisa que no están CoreML, ONNX y tflite-runtime; no se usan esos
backends en este entorno. También hay avisos de APIs deprecadas y, para
silencio, una división inválida en el postprocesado de Basic Pitch: las
salidas verificadas fueron finitas y no hubo notas, pero el flujo de producto
deberá tratar explícitamente entradas silenciosas. No se ocultaron esos avisos.

Esta combinación usa dependencias antiguas exigidas por Basic Pitch 0.4.0.
No se hizo auditoría de vulnerabilidades Python; `npm audit` sólo cubre npm.
El empaquetado independiente, licencias transitivas, calidad con voz real,
latencia y formatos de captura necesitan validación adicional.

Fuentes: [Basic Pitch 0.4.0](https://github.com/spotify/basic-pitch/blob/v0.4.0/pyproject.toml),
[Python gestionado por uv](https://docs.astral.sh/uv/concepts/python-versions/) y
[retirada de pkg_resources en setuptools 82](https://setuptools.pypa.io/en/latest/deprecated/pkg_resources.html).

## Worker M01-A

`transcribe.py` implementa el worker local consumido por el host:

```powershell
.venv/Scripts/python.exe -I python/transcribe.py --input analysis.wav --output result.json --midi melody.mid --tempo 120 --ppq 480 --time-signature 3/4
.venv/Scripts/python.exe -I python/test_transcribe.py
```

Escribe JSON de protocolo v1 en el archivo indicado; stdout permanece vacío.
Los errores terminan con código distinto de cero y mensaje en stderr. Acepta
WAV mono PCM16 no vacío de hasta 30 segundos y hasta 384000 Hz, tempo finito
40–240 y PPQ entero 1–32767. El host utiliza PPQ 480.

Las notas se limitan a la duración original antes de convertir tiempos; el
redondeo al tick más cercano resuelve exactamente medio tick hacia arriba.
Intervalos vacíos o inválidos se descartan. Un intervalo válido ocupa al menos
un tick cuando cabe en la duración de entrada redondeada. Velocity se calcula
como amplitud × 127, redondeada con la misma regla y limitada a 1–127.
Pitch bend se ignora. El MIDI tipo 0 usa exactamente esas notas PPQ, tempo y
piano GM programa 0; no se reutilizan los tiempos del MIDI de Basic Pitch. El
flag opcional `--input-kind` acepta `voice` y `percussion`: con `percussion` no
se carga Basic Pitch; un detector de ataques por flujo espectral y tres bandas
emite golpes 36/38/42 en canal 9 (GM canal 10), sin samples ni modelos nuevos.
`--monophonic` activa el filtro de armónicos sólo para voz; `--time-signature
n/d` (por defecto `4/4`) escribe el metaevento de compás, con numerador 1–255 y
denominador potencia de dos de 1 a 128. Los valores no soportados se rechazan
antes de cargar el modelo.

Un pico de hasta 3 unidades PCM16 (aprox. −80 dBFS) se considera silencio y
omite la carga del modelo. Los originales se leen sin modificarlos y se
rechazan rutas que coinciden o apuntan al mismo archivo. Los dos resultados
se preparan completos y cada reemplazo es atómico mediante `os.replace`;
no existe una transacción atómica conjunta de ambos archivos. El host debe
aceptarlos únicamente si el proceso finaliza correctamente.

`test_transcribe.py` cubre conversión, límites, silencio sin invocar el modelo,
validación y preservación de origen. La integración ejecuta el CLI con el
modelo CPU local sobre `.cache/basic-pitch-smoke/a4.wav` (generado por
`test_runtime.py`) y compara cada nota/tick/velocity del JSON con el MIDI.
Esta prueba sintética no evalúa calidad de transcripción de voz real.
