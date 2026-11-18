import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inspectSync } from '../scripts/check-sync';

const git = (cwd: string, ...args: string[]) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
}).trim();
function commit(cwd: string, text: string) {
  writeFileSync(join(cwd, 'README.md'), text);
  git(cwd, 'add', 'README.md');
  git(cwd, '-c', 'user.name=VOXEL Sync Test', '-c', 'user.email=sync-test@example.invalid',
    '-c', 'core.hooksPath=disabled-test-hooks', 'commit', '-qm', 'test fixture');
}
function fixture() {
  const folder = join(process.cwd(), '.cache', 'sync-tests', randomUUID());
  mkdirSync(folder, { recursive: true });
  mkdirSync(join(folder, 'template'));
  git(folder, '-c', `init.templateDir=${join(folder, 'template')}`, 'init', '--bare', '--initial-branch=main', 'remote.git');
  git(folder, 'clone', '-q', join(folder, 'remote.git'), 'local');
  const local = join(folder, 'local');
  commit(local, 'base'); git(local, 'push', '-qu', 'origin', 'main');
  return { folder, local, actor: () => {
    git(folder, 'clone', '-q', join(folder, 'remote.git'), 'actor'); return join(folder, 'actor');
  } };
}

// These integration cases spawn multiple actual Git processes on Windows.
// Their measured 5–7 seconds exceed the unit-test default even when assertions pass.
describe('verificación de sincronización real con Git', { timeout: 30_000 }, () => {
  it('acepta árbol limpio e idéntico al remoto recién consultado', () => {
    const { local } = fixture();
    const result = inspectSync(local);
    expect(result).toMatchObject({ synchronized: true, changes: [], ahead: 0, behind: 0 });
    expect(result.head).toBe(result.upstreamHead);
  });
  it('detecta modificaciones que todavía no forman un commit', () => {
    const { local } = fixture(); writeFileSync(join(local, 'README.md'), 'cambio sin guardar en Git');
    expect(inspectSync(local).synchronized).toBe(false);
  });
  it('detecta una propuesta nueva sin versionar', () => {
    const { local } = fixture(); writeFileSync(join(local, 'proposal.md'), 'propuesta sin sincronizar');
    expect(inspectSync(local).changes.some((line) => line.includes('proposal.md'))).toBe(true);
  });
  it('no confunde un commit local con una publicación', () => {
    const { local } = fixture(); commit(local, 'todavía sólo local');
    expect(inspectSync(local)).toMatchObject({ synchronized: false, ahead: 1, behind: 0 });
  });
  it('fetch detecta cambios nuevos que aún no estaban en la referencia local', () => {
    const { local, actor } = fixture(); const other = actor(); commit(other, 'cambio del otro equipo');
    git(other, 'push', '-q');
    expect(inspectSync(local)).toMatchObject({ synchronized: false, ahead: 0, behind: 1 });
  });
  it('detecta divergencia sin intentar reescribir ni integrar historial', () => {
    const { local, actor } = fixture(); const other = actor();
    commit(local, 'cambio local'); commit(other, 'cambio remoto'); git(other, 'push', '-q');
    expect(inspectSync(local)).toMatchObject({ synchronized: false, ahead: 1, behind: 1 });
  });
  it('falla si la rama no tiene upstream configurado', () => {
    const { local } = fixture(); git(local, 'branch', '--unset-upstream');
    expect(() => inspectSync(local)).toThrow();
  });
});
