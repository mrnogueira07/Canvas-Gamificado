import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import JSZip from 'jszip';
const source = fs.readFileSync('src/lib/studioReference.ts', 'utf8').replace(/import .*?;\r?\n/g, '').replace(/\bexport\s+/g, '');
const js = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext });
const readReference = new Function('mammoth', 'JSZip', 'model', js + '; return readStudioReference;' )({ extractRawText: ({arrayBuffer}) => mammoth.extractRawText({buffer: Buffer.from(arrayBuffer)}) }, JSZip, { generateContent: async request => { assert.equal(request.contents[0].parts[1].inlineData.mimeType, 'application/pdf'); return { response: { text: () => 'PDF content' } }; } });
const read = async file => (await readReference(file)).text;
await assert.rejects(read(new File(['text'], 'a.txt')), /Word nos formatos/);
await assert.rejects(read(new File([], 'a.pdf')), /vazio/);
await assert.rejects(read(new File(['fake'], 'a.pdf')), /PDF/);
assert.equal(await read(new File(['%PDF-1.7'], 'a.pdf')), 'PDF content');
const zip = new JSZip();
zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Science lesson</w:t></w:r></w:p></w:body></w:document>');
assert.equal(await read(new File([await zip.generateAsync({type:'uint8array'})], 'a.docx')), 'Science lesson');
assert.equal(await read(new File([await zip.generateAsync({type:'uint8array'})], 'a', {type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})), 'Science lesson');
await assert.rejects(read(new File(['not a word document'], 'broken.docx')), /salve novamente como Documento do Word/);
// Minimal compound Word fixture with a compressed text piece.
const data = new Uint8Array(512 * 19); const v = new DataView(data.buffer);
v.setUint32(0,0xe011cfd0,true); v.setUint16(30,9,true); v.setUint16(32,6,true); v.setUint32(48,1,true); v.setUint32(56,4096,true); v.setUint32(60,0xfffffffe,true); v.setUint32(68,0xfffffffe,true);
for(let i=76;i<512;i+=4) v.setUint32(i,0xffffffff,true); v.setUint32(76,0,true);
for(let i=0;i<128;i++) v.setUint32(512+i*4,0xffffffff,true);
v.setUint32(512,0xfffffffd,true);v.setUint32(516,0xfffffffe,true);
for(let i=2;i<18;i++) v.setUint32(512+i*4,(i===9||i===17)?0xfffffffe:i+1,true);
function entry(i,name,type,start,size) { const o=1024+i*128; for(let j=0;j<name.length;j++)v.setUint16(o+j*2,name.charCodeAt(j),true);v.setUint16(o+64,(name.length+1)*2,true);v.setUint8(o+66,type);v.setUint32(o+116,start,true);v.setUint32(o+120,size,true); }
entry(0,'Root Entry',5,0xfffffffe,0);entry(1,'WordDocument',2,2,4096);entry(2,'0Table',2,10,4096);
const doc=1536;v.setUint32(doc+0x1a2,0,true);v.setUint32(doc+0x1a6,21,true);data.set(new TextEncoder().encode('Legacy lesson'),doc+512);
const table=5632;v.setUint8(table,2);v.setUint32(table+1,16,true);v.setUint32(table+5,0,true);v.setUint32(table+9,13,true);v.setUint32(table+15,0x40000400,true);
assert.equal(await read(new File([data],'a.doc')), 'Legacy lesson');
console.log('PDF model mocked; PDF, DOC and DOCX extraction exercised, including DOCX MIME type detection.');

