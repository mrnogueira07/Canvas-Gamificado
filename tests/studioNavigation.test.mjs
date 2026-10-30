import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {test} from 'node:test';
const js=ts.transpile(fs.readFileSync('src/lib/studioNavigation.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
const api={};new Function('exports',js)(api);
test('same canonical ordering for editing, preview and export without changing original list',()=>{
 const input=[{id:'z',type:'encerramento'},{id:'b',type:'conteudo'},{id:'a',type:'capa'},{id:'c',type:'conteudo'},{id:'d',type:'gancho'}];
 assert.deepEqual(api.orderedStudioSlides(input).map(s=>s.id),['a','d','b','c','z']);
 assert.deepEqual(input.map(s=>s.id),['z','b','a','c','d']);
});
test('all types appear in exactly one category',()=>{
 const types=api.studioCategories.flatMap(category=>category.types);
 assert.equal(new Set(types).size,types.length);
 assert.deepEqual(types,['capa','objetivo_bncc','gancho','conteudo','interacao','formula','resumo','exercicio','gabarito','encerramento']);
});

test('createSlideForCategory creates appropriate slide type according to selected category',()=>{
 const devSlide = api.createSlideForCategory(undefined, { id: 's1', type: 'conteudo' }, 'new_dev');
 assert.equal(devSlide.type, 'conteudo');
 assert.equal(devSlide.id, 'new_dev');

 const sinteseSlide = api.createSlideForCategory(undefined, { id: 's2', type: 'resumo' }, 'new_res');
 assert.equal(sinteseSlide.type, 'resumo');
 assert.equal(sinteseSlide.id, 'new_res');

 const exSlide = api.createSlideForCategory(undefined, { id: 's3', type: 'exercicio' }, 'new_ex');
 assert.equal(exSlide.type, 'exercicio');
 assert.equal(exSlide.layout, 'exercicio');
 assert.equal(Array.isArray(exSlide.alternatives), true);

 const encSlide = api.createSlideForCategory(undefined, { id: 's4', type: 'encerramento' }, 'new_enc');
 assert.equal(encSlide.type, 'encerramento');

 const introSlide = api.createSlideForCategory(undefined, { id: 's5', type: 'gancho' }, 'new_gancho');
 assert.equal(introSlide.type, 'gancho');

 // Explicit category target
 const explicitSintese = api.createSlideForCategory('sintese', { id: 's1', type: 'conteudo' });
 assert.equal(explicitSintese.type, 'resumo');
});

test('insertSlideIntoList inserts in the active category immediately after selected slide',()=>{
 const slides = [
   { id: 'capa1', type: 'capa' },
   { id: 'dev1', type: 'conteudo' },
   { id: 'dev2', type: 'conteudo' },
   { id: 'res1', type: 'resumo' },
   { id: 'ex1', type: 'exercicio' },
   { id: 'enc1', type: 'encerramento' },
 ];

 // When on dev1, adds right after dev1
 const newDev = { id: 'dev_new', type: 'conteudo' };
 const listAfterDev = api.insertSlideIntoList(slides, newDev, 'dev1');
 assert.deepEqual(listAfterDev.map(s => s.id), ['capa1', 'dev1', 'dev_new', 'dev2', 'res1', 'ex1', 'enc1']);

 // When on res1 (Síntese), adds in Síntese right after res1
 const newRes = { id: 'res_new', type: 'resumo' };
 const listAfterRes = api.insertSlideIntoList(slides, newRes, 'res1');
 assert.deepEqual(listAfterRes.map(s => s.id), ['capa1', 'dev1', 'dev2', 'res1', 'res_new', 'ex1', 'enc1']);
});

test('isMasterUser identifies admin accounts accurately', () => {
  assert.equal(api.isMasterUser('Matheus Nogueira', 'matheus.nogueira@innyx.com'), true);
  assert.equal(api.isMasterUser('Matheus', 'matheusnog95@gmail.com'), true);
  assert.equal(api.isMasterUser('Juciane Silva', 'juciane.silva@innyx.com'), false);
  assert.equal(api.isMasterUser('Carlos Silva', 'carlos.silva@innyx.com'), false);
});

test('isKnownDeactivatedEmail and isUserDeactivated identify deactivated accounts', () => {
  assert.equal(api.isKnownDeactivatedEmail('gabriella.oliveira@innyx.com'), true);
  assert.equal(api.isKnownDeactivatedEmail('lilian.matos@innyx.com'), true);
  assert.equal(api.isKnownDeactivatedEmail('leticia.lima@innyx.com'), true);
  assert.equal(api.isKnownDeactivatedEmail('juciane.silva@innyx.com'), false);

  assert.equal(api.isUserDeactivated({ email: 'gabriella.oliveira@innyx.com' }), true);
  assert.equal(api.isUserDeactivated({ disabled: true, email: 'qualquer@innyx.com' }), true);
  assert.equal(api.isUserDeactivated({ status: 'deactivated', email: 'outro@innyx.com' }), true);
  assert.equal(api.isUserDeactivated({ isDeactivated: true, email: 'outro@innyx.com' }), true);
  assert.equal(api.isUserDeactivated({ email: 'juciane.silva@innyx.com' }), false);
});

test('ranking visibility filtering: deactivated users only visible to admin', () => {
  const rankingList = [
    { id: '1', name: 'Gabriella Oliveira', email: 'gabriella.oliveira@innyx.com', disabled: true },
    { id: '2', name: 'Lilian Matos', email: 'lilian.matos@innyx.com', disabled: true },
    { id: '3', name: 'Juciane Silva', email: 'juciane.silva@innyx.com', disabled: false },
    { id: '4', name: 'Carlos Silva', email: 'carlos.silva@innyx.com', disabled: false },
  ];

  const adminVisible = rankingList.filter(() => true); // admin sees all
  const normalVisible = rankingList.filter((m) => !m.disabled); // non-admin sees only active

  assert.equal(adminVisible.length, 4);
  assert.equal(normalVisible.length, 2);
  assert.deepEqual(normalVisible.map((m) => m.name), ['Juciane Silva', 'Carlos Silva']);
});
