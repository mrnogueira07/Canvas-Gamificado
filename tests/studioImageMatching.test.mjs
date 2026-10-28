import fs from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const source = ts.transpile(fs.readFileSync('src/lib/studioJobs.ts', 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const exports = {};
new Function('require', 'exports', source)(() => ({}), exports);
const { associateReferenceImages, matchReferenceImage } = exports;

const images = [
  { id: 'pdf-p2-img-1', name: 'Imagem 1', url: 'data:image/png;base64,ONE', page: '2', caption: 'Ciclo da água', source: 'Fonte: Acervo didático', context: 'Evaporação condensação precipitação' },
  { id: 'pdf-p3-img-1', name: 'Imagem 2', url: 'data:image/png;base64,TWO', page: '3', caption: 'Sistema solar', source: 'Fonte: Acervo didático', context: 'Planetas orbitam o Sol' },
];

test('matches an explicit original image ID and keeps its caption, page and authentic credit', () => {
  const slide = { id: 's', type: 'conteudo', title: 'Sistema solar', content: 'Planetas orbitam o Sol', notes: '', image: { referenceId: 'pdf-p3-img-1', description: 'Diagrama dos planetas', source: '[VALIDAR FONTE]', status: '[BUSCAR IMAGEM]' } };
  const [matched] = associateReferenceImages([slide], images, 'capitulo.pdf');
  assert.equal(matched.image.referenceId, 'pdf-p3-img-1');
  assert.equal(matched.image.url, images[1].url);
  assert.equal(matched.image.page, '3');
  assert.equal(matched.image.caption, 'Sistema solar');
  assert.equal(matched.image.source, 'Fonte: Acervo didático');
  assert.equal(matched.content, slide.content);
});

test('rejects an explicit ID when its caption and context contradict the slide', () => {
  const slide = { id: 's', type: 'conteudo', title: 'Sistema solar', content: 'Os planetas orbitam o Sol.', notes: '', image: { referenceId: 'pdf-p2-img-1', description: 'Imagem do material enviado', source: '', status: '' } };
  assert.equal(matchReferenceImage(slide, images), undefined);
  const [matched] = associateReferenceImages([{ ...slide, image: { ...slide.image, referenceId: 'pdf-p3-img-1' } }], images);
  assert.equal(matched.image.description, 'Sistema solar');
});

test('uses page and semantic evidence instead of assigning images in file order', () => {
  const slide = { id: 's', type: 'conteudo', title: 'Evaporação e chuva', content: 'A evaporação da água antecede a precipitação.', notes: '', sourcePages: '2' };
  assert.equal(matchReferenceImage(slide, [...images].reverse())?.id, 'pdf-p2-img-1');
  assert.equal(matchReferenceImage({ ...slide, sourcePages: '3' }, images), undefined);
});

test('leaves an uncertain picture for manual review without replacing the lesson text', () => {
  const slide = { id: 's', type: 'conteudo', title: 'Fotossíntese', content: 'A planta absorve luz.', notes: '', image: { description: 'Planta', source: '', status: '[BUSCAR IMAGEM]' } };
  const [result] = associateReferenceImages([slide], images, 'apostila.pdf');
  assert.equal(result.image, undefined);
  assert.equal(result.content, slide.content);
  assert.match(result.pending[0], /correspondência segura/);
});

test('does not put reference images on fixed slides or reuse an image arbitrarily', () => {
  const content = { id: 's', type: 'conteudo', title: 'Ciclo da água', content: 'Evaporação e precipitação', notes: '', sourcePages: '2' };
  const slides = [{ ...content, id: 'cover', type: 'capa' }, content, { ...content, id: 'other' }];
  const result = associateReferenceImages(slides, images, 'apostila.pdf');
  assert.equal(result[0].image, undefined);
  assert.equal(result[1].image.referenceId, 'pdf-p2-img-1');
  assert.equal(result[2].image, undefined);
});
