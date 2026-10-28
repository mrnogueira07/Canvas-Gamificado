import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import { test } from 'node:test';
const code = ts.transpile(fs.readFileSync('src/lib/studioGeneration.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
const exports = {};
new Function('require','exports',code)(name => name === './studioProjects' ? {createStudioId:()=>crypto.randomUUID()} : name === './studioBriefing' ? {formatBnccCodes:value=>value} : {slideTypes:['capa','objetivo_bncc','gancho','conteudo','interacao','formula','resumo','exercicio','gabarito','encerramento']}, exports);
const parse = exports.parseGeneratedContent;
const guidelineCode = ts.transpile(fs.readFileSync('src/lib/studioGuidelines.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
const guidelineExports = {};
new Function('require','exports',guidelineCode)(name => name === './studioPrompts' ? {CORE_PROMPT:'',LINE_PROMPTS:{},OUTPUT_PROMPT:''} : {studioFilename:()=>''}, guidelineExports);
const warnings = guidelineExports.studioWarnings;
const slide = {tipo:'conteudo',etapa:'desenvolvimento',layout:'so_texto',titulo:'Elements of art',texto:['Point and line'],nota_apresentador:'Explain the topic.',tempo_seg:45};
const read = patch => parse(JSON.stringify({slides:[{...slide,...patch}]}),'slides').slides[0];
test('accepts null formula and other unused optional fields',()=>{
  const parsed=read({formula:null,objetivo:null,habilidade:null,imagem:null,pendencias:null});
  assert.equal(parsed.formula,undefined); assert.equal(parsed.objective,undefined); assert.equal(parsed.curriculum,''); assert.equal(parsed.image,undefined); assert.equal(parsed.pending,undefined);
});
test('accepts omitted and empty optional values',()=>{
  assert.equal(read({}).formula,undefined); assert.equal(read({formula:'',pendencias:[]}).formula,'');
});
test('preserves supplied formula and text',()=>{
  const parsed=read({tipo:'formula',layout:'formula_com_espaco',formula:'a + b = c'});
  assert.equal(parsed.formula,'a + b = c'); assert.equal(parsed.content,'Point and line');
});
test('accepts null optional image metadata with validation placeholders',()=>{
  const parsed=read({imagem:{descricao:'A line drawing',fonte:null,status:null}});
  assert.equal(parsed.image.source,'[VALIDAR FONTE]');assert.equal(parsed.image.status,'[BUSCAR IMAGEM]');
});
test('rejects invalid non-text optional fields and malformed pending lists',()=>{
  for(const patch of [{formula:123},{objetivo:[]},{habilidade:{}},{pendencias:'invalid'},{pendencias:[null]}]) assert.throws(()=>read(patch));
});
test('still rejects null required fields',()=>{
  for(const patch of [{titulo:null},{texto:null},{nota_apresentador:null},{tempo_seg:null}]) assert.throws(()=>read(patch));
});
test('accepts multiple art slides with formula null throughout',()=>{
  const result=parse(JSON.stringify({slides:[slide,{...slide,titulo:'Shapes and colors'}].map(item=>({...item,formula:null,objetivo:null,habilidade:null}))}),'slides');
  assert.equal(result.slides.length,2);assert.equal(result.slides[1].title,'Shapes and colors');
});
test('normalizes a string returned in texto without changing its content',()=>{
  assert.equal(read({texto:'Point\nLine\nShape'}).content,'Point\nLine\nShape');
});
test('keeps populated topics when the response also contains an empty texto field',()=>{
  assert.equal(read({texto:'',topicos:['A Família Real chegou ao Brasil em 1808.','A corte portuguesa instalou-se no Rio de Janeiro.']}).content,'A Família Real chegou ao Brasil em 1808.\nA corte portuguesa instalou-se no Rio de Janeiro.');
});
test('accepts legacy content arrays instead of failing generation',()=>{
  const parsed=parse(JSON.stringify({slides:[{type:'conteudo',title:'A chegada da Família Real',content:['A Família Real chegou ao Brasil em 1808.','A corte portuguesa instalou-se no Rio de Janeiro.'],notes:'Explique o contexto.',duration:40}]}),'slides');
  assert.equal(parsed.slides[0].content,'A Família Real chegou ao Brasil em 1808.\nA corte portuguesa instalou-se no Rio de Janeiro.');
});
test('flags a Konectar content slide with no visible content',()=>{
  const issues = warnings({kind:'slides',line:'Konectar.me',slides:[{type:'gancho',title:'A chegada da Família Real',content:'',notes:'',duration:40}]});
  assert.ok(issues.some(issue=>issue.includes('conteúdo principal vazio')));
});
test('recovers common model slide type and layout variations with a review alert',()=>{
  const result=parse(JSON.stringify({slides:[{...slide,numero:2,tipo:'slide_conteudo',etapa:'conteúdo',layout:'texto_livre'}]}),'slides');
  assert.equal(result.slides[0].type,'conteudo');
  assert.equal(result.slides[0].stage,'desenvolvimento');
  assert.equal(result.slides[0].layout,'so_texto');
  assert.ok(result.alerts.some(alert=>alert.includes('ajustados')));
});
test('accepts null or missing text on fixed slides',()=>{
  for(const tipo of ['capa','encerramento','objetivo_bncc']) {
    assert.equal(read({tipo,texto:null}).content,'');
    assert.equal(read({tipo,texto:undefined}).content,'');
  }
});
test('retains all lines when the model exceeds the editorial line count',()=>{
  const lines=Array.from({length:24},(_,i)=>'Line '+i);
  assert.equal(read({texto:lines}).content,lines.join('\n'));
});
test('rejects objects inside texto rather than showing object strings',()=>{
  assert.throws(()=>read({texto:[{text:'bad shape'}]}));
});
test('accepts null or missing title and layout on fixed slides',()=>{
  assert.equal(read({tipo:'capa',titulo:null,tema:'História da Arte'}).title,'História da Arte');
  assert.equal(read({tipo:'capa',titulo:undefined,tema:undefined}).title,'Capa');
  assert.equal(read({tipo:'objetivo_bncc',titulo:null}).title,'Objetivo e BNCC');
  assert.equal(read({tipo:'encerramento',titulo:null,nota_apresentador:null}).title,'Encerramento');
});
test('accepts English title alias when titulo is omitted',()=>{
  assert.equal(read({titulo:undefined,title:'Art Elements'}).title,'Art Elements');
});
test('successfully parses canonical example without titulo on fixed slides',()=>{
  const exampleText = fs.readFileSync('tools/mind-canvas/.agents/skills/slides-canvas/examples/exemplo-konectar-me.json','utf8');
  const res = parse(exampleText, 'slides');
  assert.equal(res.slides.length, 8);
  assert.equal(res.slides[0].title, 'Agricultura');
  assert.equal(res.slides[1].title, 'Objetivo e BNCC');
  assert.equal(res.slides[7].title, 'Encerramento');
});

