import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { App } from '../src/app/App';

it('la vista web explica el requisito nativo y no ofrece grabación operativa', () => {
  const html = renderToStaticMarkup(<App />);
  expect(html).toContain('Abrí VOXEL en la aplicación de escritorio');
  expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*Grabar/);
  expect(html).toContain('Descargar MIDI');
});
