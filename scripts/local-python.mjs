import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const action = process.argv[2];
if (process.platform !== 'win32' || !['setup', 'check', 'test', 'lock'].includes(action)) {
  console.error('Usage on Windows: node scripts/local-python.mjs <setup|check|test|lock>');
  process.exit(1);
}
const python = join(root, '.venv', 'Scripts', 'python.exe');
const lock = join(root, 'python', 'requirements-windows-py311.txt');
const temp = join(root, '.cache', 'tmp');
mkdirSync(temp, { recursive: true });
const env = { ...process.env, UV_PYTHON_INSTALL_DIR: join(root, '.tools', 'python'),
  UV_CACHE_DIR: join(root, '.cache', 'uv'), UV_HTTP_TIMEOUT: '300',
  TEMP: temp, TMP: temp };

function run(executable, args) {
  const result = spawnSync(executable, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (action === 'setup') {
  // --no-registry and --no-bin prevent uv from altering external Python discovery.
  run('uv.exe', ['python', 'install', '3.11.15', '--no-bin', '--no-registry', '--no-config']);
  if (!existsSync(python)) {
    run('uv.exe', ['venv', '.venv', '--python', '3.11.15', '--managed-python', '--no-config']);
  }
}
if (!existsSync(python)) {
  console.error('Missing project-local Python environment. Run npm.cmd run python:setup.');
  process.exit(1);
}
run(python, ['-I', '-c', 'import sys; assert sys.version_info[:3] == (3, 11, 15), sys.version; print(sys.executable, sys.version.split()[0])']);
if (action === 'lock') {
  run('uv.exe', ['pip', 'compile', 'python/requirements.in', '--python', python,
    '--python-platform', 'x86_64-pc-windows-msvc', '--generate-hashes', '--output-file', lock,
    '--no-config', '--default-index', 'https://pypi.org/simple']);
} else if (action === 'setup') {
  run('uv.exe', ['pip', 'sync', lock, '--python', python, '--require-hashes',
    '--no-config', '--default-index', 'https://pypi.org/simple']);
} else if (action === 'check') {
  run('uv.exe', ['pip', 'check', '--python', python, '--no-config', '--offline']);
} else {
  run(python, ['-I', '-m', 'unittest', 'discover', '-s', 'python', '-p', 'test_*.py']);
}
