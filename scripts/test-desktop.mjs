// Actual WebView2 + Tauri IPC + Python integration. Synthetic stream, never a physical mic.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../', import.meta.url));
const runId = randomUUID();
const output = join(root, '.cache', 'desktop-test', runId);
const storage = join(output, 'projects');
await mkdir(output, { recursive: true });
const port = 9337;
try {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`);
  if (response.ok) throw new Error(`Test port ${port} is already in use; refusing to attach to another app`);
} catch (error) { if (!String(error).includes('fetch failed')) throw error; }
const before = new Set(await readdir(storage).catch(() => []));
const app = spawn(join(root, 'src-tauri', 'target', 'debug', 'voxel.exe'), [], {
  cwd: root, windowsHide: true, stdio: 'ignore',
  env: { ...process.env, WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1`,
    VOXEL_TEST_RUN_ID: runId,
    WEBVIEW2_USER_DATA_FOLDER: join(output, 'webview-profile'), TEMP: join(root, '.cache', 'tmp'), TMP: join(root, '.cache', 'tmp') },
});
let browser;
const errors = [];
const consoleErrors = [];
try {
  app.on('error', (error) => errors.push(error.message));
  for (let attempt = 0; attempt < 80; attempt++) {
    if (app.exitCode !== null || errors.length) throw new Error(`App exited before CDP: ${errors.join('; ')}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) break;
    } catch { /* Wait for this owned process to start WebView2. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const context = browser.contexts()[0];
  const page = context.pages().find((candidate) => candidate.url().includes('tauri')) ?? context.pages()[0];
  assert.ok(page, 'Native application page exists');
  page.setDefaultTimeout(20000);
  const externalRequests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (['http:', 'https:'].includes(url.protocol) &&
        !['tauri.localhost', 'ipc.localhost', 'localhost', '127.0.0.1'].includes(url.hostname)) {
      externalRequests.push(url.href); await route.abort(); return;
    }
    await route.continue();
  });
  await context.addInitScript(() => {
    window.__voxelTestStreams = [];
    window.__voxelTestAnalysers = [];
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof AudioDestinationNode && this.numberOfOutputs > 0) {
        const analyser = this.context.createAnalyser(); analyser.fftSize = 2048;
        window.__voxelTestAnalysers.push(analyser);
        connect.call(this, analyser); connect.call(analyser, destination, ...args);
        return destination;
      }
      return connect.call(this, destination, ...args);
    };
    navigator.mediaDevices.getUserMedia = async () => {
      // Synthesize a real MediaStream at the capture API boundary. No device access.
      const audio = new AudioContext(); await audio.resume();
      const destination = audio.createMediaStreamDestination();
      const oscillator = audio.createOscillator(); oscillator.type = 'triangle'; oscillator.frequency.value = 440;
      const gain = audio.createGain(); gain.gain.value = 0.35;
      oscillator.connect(gain); gain.connect(destination); oscillator.start();
      const track = destination.stream.getAudioTracks()[0];
      const stop = track.stop.bind(track);
      track.stop = () => { if (track.readyState === 'ended') return; stop(); oscillator.stop(); void audio.close().catch(() => {}); };
      window.__voxelTestStreams.push(destination.stream);
      return destination.stream;
    };
  });
  await page.reload();
  // Exercise a denied request and a canceled permission request with a late stream.
  await page.evaluate(() => {
    window.__voxelSyntheticInput = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Micrófono denegado para prueba', 'NotAllowedError'); };
  });
  await page.getByRole('button', { name: /Grabar melodía/ }).click();
  await page.getByRole('alert').filter({ hasText: 'Micrófono denegado para prueba' }).waitFor();
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise((resolve) => { window.__voxelResolvePermission = resolve; }); });
  await page.getByRole('button', { name: /Grabar melodía/ }).click();
  await page.getByRole('button', { name: /Cancelar solicitud/ }).click();
  await page.evaluate(async () => { const stream = await window.__voxelSyntheticInput(); window.__voxelResolvePermission(stream); });
  await page.waitForFunction(() => window.__voxelTestStreams.every((stream) => stream.getTracks().every((track) => track.readyState === 'ended')));
  await page.evaluate(() => { navigator.mediaDevices.getUserMedia = window.__voxelSyntheticInput; });
  await page.getByRole('button', { name: /Grabar melodía/ }).click();
  await page.getByRole('button', { name: /Detener grabación/ }).waitFor();
  await page.waitForTimeout(2300);
  await page.getByRole('button', { name: /Detener grabación/ }).click();
  await page.getByRole('button', { name: /Transcribir melodía/ }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent.includes('Transcribir melodía') && !button.disabled));
  const captureStates = await page.evaluate(() => window.__voxelTestStreams.flatMap((stream) => stream.getTracks().map((track) => track.readyState)));
  assert.ok(captureStates.length && captureStates.every((state) => state === 'ended'), 'Capture tracks released before transcription');
  await page.getByRole('button', { name: /Transcribir melodía/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent.includes('Escuchar piano') && !button.disabled), null, { timeout: 180000 });
  const ids = (await readdir(storage)).filter((name) => !before.has(name));
  assert.equal(ids.length, 1, 'One new owned test project created');
  const projectPath = join(storage, ids[0]);
  const project = JSON.parse(await readFile(join(projectPath, 'project.json'), 'utf8'));
  assert.equal(project.schemaVersion, 1); assert.equal(project.ppq, 480);
  assert.ok(project.tracks[0].notes.some((note) => note.pitch === 69), 'Real inference detects A4');
  assert.ok((await readFile(join(projectPath, project.audioAssets[0].path))).length > 0);
  assert.ok((await readFile(join(projectPath, 'melody.mid'))).subarray(0, 4).equals(Buffer.from('MThd')));
  await page.getByRole('button', { name: /Escuchar piano/ }).click();
  let peak = 0;
  for (let attempt = 0; attempt < 30; attempt++) {
    peak = await page.evaluate(() => Math.max(0, ...window.__voxelTestAnalysers.map((analyser) => {
      const values = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(values);
      return Math.max(...values.map(Math.abs));
    })));
    if (peak > 0.0001) break;
    await page.waitForTimeout(100);
  }
  if (peak <= 0.0001) console.error('Audio diagnostics', await page.evaluate(() => window.__voxelTestAnalysers.map((a) => ({ state: a.context.state, time: a.context.currentTime, inputs: a.numberOfInputs }))), consoleErrors);
  assert.ok(peak > 0.0001, 'Local piano produces a nonzero Web Audio signal');
  await page.getByRole('button', { name: /Detener piano/ }).click();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: output, eventsEnabled: true });
  await page.getByRole('button', { name: /Descargar MIDI/ }).click();
  for (let attempt = 0; attempt < 50; attempt++) {
    try { const midi = await readFile(join(output, 'melody.mid')); if (midi.subarray(0, 4).equals(Buffer.from('MThd'))) break; }
    catch { /* wait for browser download */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok((await readFile(join(output, 'melody.mid'))).subarray(0, 4).equals(Buffer.from('MThd')), 'Actual UI MIDI download succeeds');
  const beforeCancel = await readFile(join(projectPath, 'project.json'), 'utf8');
  await page.getByRole('button', { name: /Transcribir melodía/ }).click();
  await page.getByRole('button', { name: /Cancelar transcripción/ }).click();
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some((button) => button.textContent.includes('Transcribir melodía') && !button.disabled));
  assert.equal(await readFile(join(projectPath, 'project.json'), 'utf8'), beforeCancel, 'Cancellation preserves the previous project');
  await page.getByRole('button', { name: 'Abrir', exact: true }).click();
  await page.getByText('Proyecto recuperado con su audio y sus notas.').waitFor();
  assert.equal(await page.locator('audio').count(), 1, 'Original audio recovered');
  await page.screenshot({ path: join(output, 'studio.png'), fullPage: true });
  assert.deepEqual(externalRequests, [], 'No external page requests allowed');
  assert.deepEqual(errors, [], 'No unhandled page errors');
  assert.deepEqual(consoleErrors, [], 'No browser console errors, including CSP violations');
  await writeFile(join(output, 'report.json'), JSON.stringify({ projectId: ids[0], syntheticInput: true,
    physicalMicrophoneTested: false, permissionDenialAndLateGrant: true, cancellationPreservedProject: true,
    midiDownload: true, pianoSignalPeak: peak, captureStates, notes: project.tracks[0].notes,
    externalRequests, errors }, null, 2));
  console.log(`PASS: native WebView2 → real recording → Tauri storage → Python inference → PPQ/MIDI → piano → reopen. Report: ${output}`);
} catch (error) {
  if (browser) {
    const page = browser.contexts()[0]?.pages()[0];
    if (page) { await page.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
      console.error((await page.locator('body').innerText().catch(() => '')).slice(-4000)); }
  }
  throw error;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (app.exitCode === null) app.kill();
}
