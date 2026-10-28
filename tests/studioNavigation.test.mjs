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
