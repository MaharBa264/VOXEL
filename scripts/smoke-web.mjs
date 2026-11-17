import assert from 'node:assert/strict';
import { createServer } from 'vite';

// HTTP/transform smoke only; this does not execute React in a browser.
const server = await createServer();
try {
  await server.listen();
  const html = await fetch('http://127.0.0.1:1420/');
  assert.equal(html.status, 200);
  assert.match(await html.text(), /\/src\/main\.tsx/);
  for (const path of ['/src/main.tsx', '/src/app/App.tsx', '/src/app/styles.css']) {
    const response = await fetch(`http://127.0.0.1:1420${path}`);
    assert.equal(response.status, 200, path);
    assert.ok((await response.text()).length > 0, path);
  }
  console.log('PASS: HTML, React entry, App and CSS served on loopback.');
} finally {
  await server.close();
}
