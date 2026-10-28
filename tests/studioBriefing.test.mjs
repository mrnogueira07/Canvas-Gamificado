import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';
const js = ts.transpile(readFileSync('src/lib/studioBriefing.ts','utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
function setup(reply = '{}') {
  const exports = {}; let request;
  new Function('require','exports',js)(name => name === './gemini' ? {model: {generateContent: async input => { request = input; return {response: {text: () => reply}}; }}} : {withStudioDeadline: async work => work}, exports);
  return {api:exports, request:()=>request};
}
test('parses supported briefing fields and normalizes whitespace', () => {
  const {api}=setup();
  assert.deepEqual(api.parseStudioBriefing('```json\n{"title":" Science ","subject":"Biology","gradeLevel":"Fundamental 2","schoolYear":"7","objective":"Understand cells","curriculum":null,"sourceContent":"ignore","line":"ignore"}\n```'),{title:'Science',subject:'Biology',gradeLevel:'Fundamental 2',schoolYear:'7',objective:'Understand cells'});
});
test('missing information stays empty and invalid stages are ignored', () => {
  const {api}=setup(); assert.deepEqual(api.parseStudioBriefing('{"teacher":null,"bimester":"","gradeLevel":"invented"}'),{});
});
test('rejects malformed structures, wrong field types and overlong values',()=>{
  const {api}=setup();
  for(const reply of ['[]','null','invalid','{"teacher":42}',JSON.stringify({title:'a'.repeat(201)})]) assert.throws(()=>api.parseStudioBriefing(reply));
});
test('fills empty fields without replacing educator input or source',()=>{
  const {api}=setup();
  const project={title:'My title',subject:' ',schoolYear:'7',objective:'',sourceContent:'original'};
  const patch=api.mergeStudioBriefing(project,{title:'Other title',subject:'Science',schoolYear:'8',objective:'Learn cells'});
  assert.deepEqual(patch,{subject:'Science',objective:'Learn cells'}); assert.equal(project.sourceContent,'original');
});
test('analysis sends the full document as reference and requests JSON',async()=>{
  const {api,request}=setup('{"title":"Cells","exercise":"Compare cells"}');
  assert.deepEqual(await api.extractStudioBriefing('Document contents','Konectar.me'),{title:'Cells',exercise:'Compare cells'});
  assert.equal(request().generationConfig.responseMimeType,'application/json');
  assert.ok(request().contents[0].parts[0].text.includes(JSON.stringify('Document contents')));
});
test('model errors propagate for the UI to preserve the imported document',async()=>{
  const {api}=setup('not json'); await assert.rejects(api.extractStudioBriefing('Document','Konectar.me'));
});
