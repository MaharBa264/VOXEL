import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Project-local development tools only; nothing persists to system/user PATH.
const root = fileURLToPath(new URL('../', import.meta.url));
const [command, ...args] = process.argv.slice(2);
if (process.platform !== 'win32' || !['cargo', 'rustc', 'rustup', 'tauri'].includes(command)) {
  console.error('Usage on Windows: node scripts/local-rust.mjs <cargo|rustc|rustup|tauri> [...args]');
  process.exit(1);
}
const cargoHome = join(root, '.tools', 'cargo');
const rustupHome = join(root, '.tools', 'rustup');
const bin = join(cargoHome, 'bin');
if (!existsSync(join(bin, 'cargo.exe')) || !existsSync(rustupHome)) {
  console.error('Missing project-local Rust toolchain. See docs/LOCAL-TOOLS.md.');
  process.exit(1);
}
const temp = join(root, '.cache', 'tmp');
mkdirSync(temp, { recursive: true });
const env = { ...process.env, CARGO_HOME: cargoHome, RUSTUP_HOME: rustupHome,
  CARGO_TARGET_DIR: join(root, 'src-tauri', 'target'), TEMP: temp, TMP: temp };
const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'Path';
env[pathKey] = `${bin}${delimiter}${env[pathKey] ?? ''}`;
const executable = command === 'tauri' ? process.execPath : join(bin, `${command}.exe`);
const commandArgs = command === 'tauri'
  ? [join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js'), ...args] : args;
const result = spawnSync(executable, commandArgs, { cwd: root, env, stdio: 'inherit', windowsHide: true });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
