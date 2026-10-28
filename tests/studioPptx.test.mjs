import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import JSZip from 'jszip';

globalThis.DOMParser = DOMParser;
globalThis.XMLSerializer = XMLSerializer;
fs.mkdirSync('.tmp/pptx-check', { recursive: true });
for (const name of ['studioProjects', 'studioPrompts', 'studioGuidelines', 'studioGeneration', 'studioNavigation', 'studioPptx']) {
  const code = ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from "\.\/(studio\w+)"/g, 'from "./$1.mjs"');
  fs.writeFileSync(`.tmp/${name}.mjs`, code);
}
fs.writeFileSync('.tmp/studioBriefing.mjs', 'export function formatBnccCodes(raw) { return typeof raw === "string" ? raw : ""; }');
fs.writeFileSync('.tmp/studioImages.mjs', 'export async function resolveImageAsBlob(url) { if (!url) return null; const r = await fetch(url); return r.ok ? await r.blob() : null; }');
const { buildStudioPptx } = await import('../.tmp/studioPptx.mjs');
const { parseGeneratedContent } = await import('../.tmp/studioGeneration.mjs');
const { studioPrompt, studioWarnings } = await import('../.tmp/studioGuidelines.mjs');
const { studioFilename } = await import('../.tmp/studioProjects.mjs');
const project = {
  kind: 'slides', title: 'O ciclo da água', subject: 'Ciências', subtitle: 'Água na natureza', teacher: 'Professora Ana',
  objective: 'Reconhecer as etapas do ciclo da água e sua relação com a natureza.', curriculum: '[VALIDAR BNCC]',
  slides: [
    { id: '1', type: 'capa', title: 'O ciclo da água', content: '', notes: 'Apresente o tema da aula.' },
    { id: '2', type: 'objetivo_bncc', title: 'Objetivo e habilidade', content: '', notes: 'Explique o objetivo da aula.' },
    { id: '3', type: 'conteudo', title: 'A água em movimento', content: 'O calor do Sol aquece a água.\nO vapor sobe e forma nuvens.\nA chuva devolve a água à superfície.', notes: 'Pergunte onde os estudantes observam a água no dia a dia.' },
    { id: '4', type: 'encerramento', title: 'Encerramento', content: '', notes: 'Agradeça a participação.' },
  ],
};
for (const [line, file] of [['Konecta Kids', 'konecta-kids'], ['Konectar.me', 'konectar-me'], ['Educação Corporativa', 'educacao-corporativa']]) {
  project.line = line;
  const original = fs.readFileSync(`public/templates/${file}.pptx`);
  const input = original.buffer.slice(original.byteOffset, original.byteOffset + original.byteLength);
  const result = await buildStudioPptx(project, input);
  const bytes = Buffer.from(await result.arrayBuffer());
  fs.writeFileSync(`.tmp/pptx-check/${file}-export.pptx`, bytes);
  const zip = await JSZip.loadAsync(bytes);
  const source = await JSZip.loadAsync(original);
  assert.ok((await zip.file('ppt/slides/slide3.xml').async('string')).includes('A água em movimento'));
  assert.match(await zip.file('ppt/notesSlides/notesSlide3.xml').async('string'), /Pergunte onde/);
  for (const name of Object.keys(source.files).filter(n => n.startsWith('ppt/media/') && !source.files[n].dir)) {
    assert.deepEqual(await zip.file(name).async('uint8array'), await source.file(name).async('uint8array'));
  }
  for (const name of Object.keys(zip.files).filter(n => n.endsWith('.rels'))) {
    const doc = new DOMParser().parseFromString(await zip.file(name).async('string'), 'application/xml');
    for (const rel of Array.from(doc.getElementsByTagName('Relationship'))) {
      if (rel.getAttribute('TargetMode') === 'External') continue;
      const target = rel.getAttribute('Target');
      const resolved = target.startsWith('/') ? target.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(name).replace(/\/?_rels$/, ''), target));
      assert.ok(zip.file(resolved), `${name}: missing ${resolved}`);
    }
  }
  await assert.rejects(() => buildStudioPptx({ ...project, slides: [] }, input), /Adicione conteúdo/);
  await assert.rejects(() => buildStudioPptx({ ...project, slides: [{ ...project.slides[2], content: 'Texto '.repeat(5000) }] }, input), /excede o espaço/);
  const many = await buildStudioPptx({ ...project, slides: Array.from({ length: 18 }, () => project.slides[2]) }, input);
  const manyZip = await JSZip.loadAsync(await many.arrayBuffer());
  assert.ok(manyZip.file('ppt/slides/slide20.xml'));
  if (line === 'Konecta Kids') {
    const highlightBytes = await (await buildStudioPptx({ ...project, slides: [{ ...project.slides[2], type: 'gancho' }] }, input)).arrayBuffer();
    fs.writeFileSync('.tmp/pptx-check/kids-highlight-export.pptx', Buffer.from(highlightBytes));
    const highlight = await JSZip.loadAsync(highlightBytes);
    const xml = await highlight.file('ppt/slides/slide2.xml').async('string');
    assert.match(xml, /srgbClr val="FFFFFF"/);
    assert.match(await highlight.file('ppt/slides/_rels/slide2.xml.rels').async('string'), /studio-kids-highlight/);
  }
  const variants = await buildStudioPptx({ ...project, slides: [
    { ...project.slides[2], layout: 'topicos_com_barras' },
    { ...project.slides[2], layout: 'caixas_contorno' },
    { ...project.slides[2], title: 'Uma conta', type: 'formula', layout: 'formula_com_espaco', formula: '2 + 3 = ?', content: '' },
    { ...project.slides[2], title: 'Uma imagem', content: 'Observe a água.', layout: 'imagem_esquerda_texto_direita', image: { description: 'Água evaporando.', source: 'Fonte: [VALIDAR FONTE]', status: '[BUSCAR IMAGEM]' } },
  ] }, input);
  fs.writeFileSync(`.tmp/pptx-check/${file}-layouts.pptx`, Buffer.from(await variants.arrayBuffer()));
  console.log(`OK ${line}: text, notes, media, relationships, overflow errors and slide duplication.`);
}

const types = ['capa', 'objetivo_bncc', 'gancho', ...Array(5).fill('conteudo'), 'interacao', 'resumo', 'exercicio', 'gabarito', 'encerramento'];
const canonical = { slides: types.map((tipo, index) => ({ numero: index + 1, etapa: tipo === 'capa' || tipo === 'objetivo_bncc' ? 'introducao' : tipo === 'encerramento' ? 'fixo' : 'desenvolvimento', tipo, layout: 'so_texto', titulo: 'Título curto', texto: ['Uma frase.'], nota_apresentador: 'Apresente a ideia. Pergunte sobre o cotidiano.', tempo_seg: index === 0 ? 20 : index === 1 ? 40 : index === 12 ? 10 : 65, pendencias: [] })) };
canonical.slides[3].imagem = { descricao: 'Evaporação da água', fonte: '[VALIDAR FONTE]', status: '[BUSCAR IMAGEM]' };
canonical.slides[3].layout = 'imagem_esquerda_texto_direita';
const parsed = parseGeneratedContent(JSON.stringify(canonical), 'slides');
assert.equal(parsed.slides[3].image.description, 'Evaporação da água');
assert.equal(parsed.slides.at(-1).stage, 'fixo');
const example = { ...project, ...parsed, line: 'Konecta Kids', schoolYear: '3º ano', bimester: '1º bimestre' };
const warnings = studioWarnings(example);
assert.ok(warnings.some(w => w.includes('[BUSCAR IMAGEM]')));
assert.ok(!warnings.some(w => /Duração:|ordem:|slides de conteúdo|frases nas notas/.test(w)));
const prompt = studioPrompt(example);
assert.ok(prompt.indexOf('# PAPEL') < prompt.indexOf('# MÓDULO KONECTA KIDS'));
assert.ok(prompt.indexOf('# MÓDULO KONECTA KIDS') < prompt.indexOf('# FORMATO DE SAÍDA'));
assert.ok(!prompt.includes('# MÓDULO KONECTAR.ME'));
assert.equal(studioFilename({ ...example, subject: 'Geografia' }), 'AP_GEO_3ANO_1BIM_O CICLO DA ÁGUA');
const recoveredLayout = parseGeneratedContent(JSON.stringify({ slides: [{ ...canonical.slides[0], layout: 'qualquer' }] }), 'slides');
assert.equal(recoveredLayout.slides[0].layout, 'so_texto');
assert.ok(recoveredLayout.alerts.some(alert => alert.includes('ajustados')));
console.log('OK canonical JSON, modular prompts, checklist, image metadata and filename.');

// Generated images are embedded as separate native picture shapes, never flattened with text.
const imageFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9p8AAAAASUVORK5CYII=', 'base64'), {headers:{'Content-Type':'image/png'}});
try {
 const raw=fs.readFileSync('public/templates/konectar-me.pptx');
 const output=await buildStudioPptx({...project,line:'Konectar.me',slides:[{id:'image-test',type:'conteudo',title:'Uma folha',content:'Observe a folha.',notes:'',layout:'imagem_esquerda_texto_direita',image:{url:'https://firebasestorage.googleapis.com/test.png',description:'Uma folha',source:'Fonte: IA / Gemini',status:'Generated'}}]},raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength));
 const zip=await JSZip.loadAsync(await output.arrayBuffer());
 assert.ok(zip.file('ppt/media/studio-image-2.png'));
 const xml=await zip.file('ppt/slides/slide2.xml').async('string');
 assert.match(xml,/r:embed="rIdStudioImage"/);assert.match(xml,/Observe a folha/);assert.doesNotMatch(xml,/BUSCAR IMAGEM/);
 assert.match(await zip.file('ppt/slides/_rels/slide2.xml.rels').async('string'),/studio-image-2.png/);
 console.log('OK generated image embedded separately alongside editable text.');
} finally {globalThis.fetch=imageFetch;}
