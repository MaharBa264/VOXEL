import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Refresh refs and inspect only: never stage, commit, merge, reset or push. */
export function inspectSync(directory: string) {
  const git = (...args: string[]) => execFileSync('git', args, {
    cwd: directory, encoding: 'utf8', stdio: 'pipe', timeout: 30_000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  }).trim();
  git('fetch', 'origin');
  const changes = git('status', '--porcelain=v1', '--untracked-files=normal').split(/\r?\n/).filter(Boolean);
  const head = git('rev-parse', 'HEAD');
  const upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}');
  if (!upstream.startsWith('origin/')) throw new Error('La rama debe seguir una rama de origin.');
  const upstreamHead = git('rev-parse', '@{upstream}');
  const counts = git('rev-list', '--left-right', '--count', 'HEAD...@{upstream}').split(/\s+/).map(Number);
  const [ahead, behind] = counts;
  if (ahead === undefined || behind === undefined || !Number.isInteger(ahead) || !Number.isInteger(behind)) {
    throw new Error('Git devolvió un estado de divergencia inválido.');
  }
  return { changes, head, upstream, upstreamHead, ahead, behind,
    synchronized: changes.length === 0 && ahead === 0 && behind === 0 && head === upstreamHead };
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  try {
    const result = inspectSync(fileURLToPath(new URL('../', import.meta.url)));
    if (!result.synchronized) {
      console.error(`SIN SINCRONIZAR: ${result.changes.length} entradas locales; ${result.ahead} commits sin enviar; ${result.behind} commits por integrar.`);
      if (result.changes.length) console.error(result.changes.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`SINCRONIZADO: árbol limpio, HEAD = ${result.upstream} = ${result.head}`);
    }
  } catch (error) {
    console.error('No se pudo verificar sincronización:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
