import { readFileSync } from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const source = ts.transpile(readFileSync('src/lib/studioJobs.ts', 'utf8'), { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS });
const draft = { id: 'p1', kind: 'slides', title: 'Lesson', slides: [], scenes: [], updatedAt: 'draft' };
const result = { slides: [{ id: 'slide-1' }], scenes: [] };
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup({ generate = async () => ({ response: { text: () => 'ok' } }), warnings = () => [], save, parsed = result, image = async () => ({description:"Generated picture",source:"Fonte: IA",status:"Generated",url:"https://firebasestorage.googleapis.com/test.png"}) } = {}) {
  const saved = []; const timers = new Map(); let timerId = 0;
  const exports = {};
  const dependencies = {
    './gemini': { model: { generateContent: generate } },
    './studioGeneration': { parseGeneratedContent: text => { if(text === 'invalid') throw new Error('Invalid response'); return structuredClone(parsed); } },
    './studioGuidelines': { studioPrompt: () => 'prompt', studioWarnings: warnings },
    './studioImages': {generateStudioImage: image},
    './studioProjects': { saveStudioProject: (user, project) => { save?.(saved.length); saved.push({user, project}); return {...project, updatedAt: String(saved.length)}; } },
  };
  new Function('require', 'exports', 'setTimeout', 'clearTimeout', source)(name => dependencies[name], exports, (callback, ms) => {const id = ++timerId; timers.set(id, {callback, ms}); return id;}, id => timers.delete(id));
  return {api: exports, saved, expire: ms => { for(const [id, timer] of timers) if(timer.ms === ms) {timers.delete(id); timer.callback();} }};
}
test('continues without editor subscribers, saves and notifies completion; prevents duplicates', async () => {
  let resolve; let calls = 0;
  const {api, saved} = setup({generate: () => { calls++; return new Promise(done => {resolve = done;}); }});
  let notifications = 0; const unsubscribe = api.subscribeStudioJobs(() => notifications++);
  api.startStudioJob('u1', draft); unsubscribe(); api.startStudioJob('u1', draft);
  assert.equal(calls, 1); assert.equal(saved.length, 1);
  resolve({response:{text: () => 'ok'}}); await flush();
  assert.equal(api.getStudioJobs()[0].status, 'ready'); assert.equal(saved.length, 2);
  assert.deepEqual(saved[1].project.slides, result.slides); assert.equal(notifications, 1);
  api.dismissStudioJob('u1', 'p1'); assert.equal(api.getStudioJobs()[0].dismissed, true);
  assert.ok(api.getStudioJobs()[0].result);
});
test('main timeout ends spinner and ignores late result', async () => {
  let resolve;
  const {api, saved, expire} = setup({generate: () => new Promise(done => {resolve=done;})});
  api.startStudioJob('u1', draft); expire(130000); await flush();
  assert.equal(api.getStudioJobs()[0].status, 'error');
  resolve({response:{text: () => 'ok'}}); await flush(); assert.equal(saved.length, 1);
});
test('optional review timeout keeps the first complete result', async () => {
  let calls=0;
  const {api, expire, saved} = setup({warnings: () => ['Fix duration'], generate: async () => {calls++; if(calls===2) return new Promise(() => {}); return {response:{text: () => 'ok'}};}});
  api.startStudioJob('u1', draft); await flush(); assert.equal(api.getStudioJobs()[0].status, 'reviewing');
  expire(45000); await flush(); assert.equal(api.getStudioJobs()[0].status, 'ready'); assert.equal(saved.length, 2);
});
test('stops generation when a required slide remains empty after checklist correction', async () => {
  let calls = 0;
  const parsed = { slides: [{ id: 'slide-3', type: 'gancho', title: 'A chegada da Família Real', content: '', notes: 'Explique o contexto.' }], scenes: [] };
  const warning = 'Slide 3: conteúdo principal vazio; inclua o texto ou os tópicos da apostila.';
  const {api, saved} = setup({parsed, warnings: () => [warning], generate: async () => { calls++; return {response:{text: () => 'ok'}}; }});
  api.startStudioJob('u1', draft); await flush();
  assert.equal(calls, 2);
  assert.equal(api.getStudioJobs()[0].status, 'error');
  assert.match(api.getStudioJobs()[0].message, /sem conteúdo principal/);
  assert.equal(saved.length, 1);
});
test('repairs malformed response once, then saves without another model review', async () => {
  let calls = 0;
  const {api} = setup({warnings: () => ['Fix duration'], generate: async () => { const text = ++calls === 1 ? 'invalid' : 'ok'; return {response:{text: () => text}}; }});
  api.startStudioJob('u1', draft); await flush();
  assert.equal(api.getStudioJobs()[0].status, 'ready'); assert.equal(calls, 2);
});
test('persistent malformed response stops after one repair and allows retry', async () => {
  let calls = 0;
  const {api} = setup({generate: async () => {calls++; return {response:{text: () => 'invalid'}};}});
  api.startStudioJob('u1', draft); await flush(); assert.equal(api.getStudioJobs()[0].status, 'error'); assert.equal(calls, 2);
  api.startStudioJob('u1', draft); await flush(); assert.equal(calls, 4); assert.equal(api.getStudioJobs()[0].status, 'error');
});
test('storage failure prevents request before start', () => {
  let calls=0;
  const {api} = setup({save: () => {throw new Error('storage full');}, generate: async () => {calls++;}});
  assert.throws(() => api.startStudioJob('u1', draft), /storage full/); assert.equal(calls, 0);
});
test('retains generated content when final save fails', async () => {
  const {api} = setup({save: count => {if(count===1) throw new Error('storage full');}});
  api.startStudioJob('u1', draft); await flush();
  assert.equal(api.getStudioJobs()[0].status, 'error'); assert.deepEqual(api.getStudioJobs()[0].result.slides, result.slides);
});
test('jobs are isolated by account', async () => {
  const {api} = setup(); api.startStudioJob('u1',draft); api.startStudioJob('u2',draft); await flush();
  assert.equal(api.getStudioJobs().length,2); api.dismissStudioJob('u1','p1');
  assert.equal(api.getStudioJobs().find(job=>job.userId==='u2').dismissed, undefined);
});


test('generates planned images and saves editable text before requesting pictures', async () => {
 let pictures = 0;
 const parsed = {slides:[{id:'s1',type:'conteudo',title:'Leaf',content:'A leaf',notes:'',image:{description:'A leaf diagram',source:'',status:'A gerar'}}],scenes:[]};
 const {api,saved}=setup({parsed,image:async()=>{pictures++;assert.equal(saved.length,2);return {description:'Leaf',source:'Fonte: IA',status:'Generated',url:'https://firebasestorage.googleapis.com/test.png'};}});
 api.startStudioJob('u1',draft);await flush();assert.equal(pictures,1);assert.equal(saved.length,3);
 assert.equal(api.getStudioJobs()[0].result.slides[0].layout,'imagem_esquerda_texto_direita');assert.ok(api.getStudioJobs()[0].result.slides[0].image.url);
});
test('image provider failure preserves editable slides and records pending image',async()=>{
 const parsed = {slides:[{id:'s1',type:'conteudo',title:'Leaf',content:'A leaf',notes:'',image:{description:'A leaf diagram',source:'',status:'A gerar'}}],scenes:[]};
 const {api}=setup({parsed,image:async()=>{throw new Error('Unavailable');}});
 api.startStudioJob('u1',draft);await flush();const job=api.getStudioJobs()[0];assert.equal(job.status,'ready');assert.equal(job.result.slides[0].content,'A leaf');assert.ok(job.result.slides[0].pending.length);assert.equal(job.result.slides[0].image.url,undefined);
});
test('retains generated text if storage fails before image calls',async()=>{
 const parsed = {slides:[{id:'s1',type:'conteudo',title:'Leaf',content:'A leaf',notes:''}],scenes:[]};
 let pictures=0;
 const {api}=setup({parsed,save:count=>{if(count===1)throw new Error('Full');},image:async()=>{pictures++;}});
 api.startStudioJob('u1',draft);await flush();assert.equal(pictures,0);assert.equal(api.getStudioJobs()[0].status,'error');assert.equal(api.getStudioJobs()[0].result.slides[0].content,'A leaf');
});
