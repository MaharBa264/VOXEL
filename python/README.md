# Motor de transcripción — pendiente

No contiene implementación ni dependencias instaladas.
Candidato para M01-A: CPython 3.11 x64 + `basic-pitch==0.4.0`.
La versión no constituye un lock ni una combinación validada.

Antes de implementar: disponer explícitamente de Python 3.11, crear `.venv`
en la raíz con `py -3.11 -m venv .venv`, usar siempre
`.\.venv\Scripts\python.exe -m pip ...` y fijar todas las dependencias
transitivas después de resolver y ejecutar una inferencia real en Windows.
No hace falta activar el entorno ni cambiar ExecutionPolicy.

Basic Pitch 0.4.0 declara Python 3.8–3.11; en Windows con Python ≥3.11
requiere TensorFlow >=2.4.1,<2.15.1. Python 3.12/3.14 no son alternativas
validadas. No crear un entorno con el `python` predeterminado por accidente.

Fuente: https://github.com/spotify/basic-pitch/blob/v0.4.0/pyproject.toml

Pendientes: lock reproducible, distribución de runtime/modelo y licencias,
contrato de trabajos IPC, cancelación, manejo de errores y pruebas sin red.
