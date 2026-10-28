import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
const js=ts.transpile(fs.readFileSync('functions/src/studioImage.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
class HttpsError extends Error {constructor(code,message){super(message);this.code=code;}}
const valid={auth:{uid:'owner'},data:{projectId:'project',slideId:'slide',description:'An illustration of a leaf',context:'Science lesson about plants'}};
function setup({status=200,parts=[{inlineData:{mimeType:'image/png',data:'aGVsbG8='}}]}={}) {
 const calls=[],files=[];const exports={};
 const dependencies={'firebase-functions/v2/https':{onCall:(_options,handler)=>handler,HttpsError},'firebase-admin':{storage:()=>({bucket:name=>({name,file:path=>({save:async(bytes,options)=>files.push({path,bytes,options})})})})},'node:crypto':{randomUUID}};
 new Function('require','exports','fetch',js)(name=>dependencies[name],exports,async(url,options)=>{calls.push({url,options});return {ok:status===200,status,json:async()=>({candidates:[{content:{parts}}]})};});
 return {run:exports.generateStudioImage,calls,files};
}
test('requires login and validates ids before provider request',async()=>{
 const {run,calls}=setup();await assert.rejects(run({data:valid.data}),error=>error.code==='unauthenticated');
 await assert.rejects(run({...valid,data:{...valid.data,projectId:'../other'}}),error=>error.code==='invalid-argument');assert.equal(calls.length,0);
});
test('stores generated image under authenticated account and preserves attribution prompt',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
 try {const {run,calls,files}=setup();const result=await run(valid);assert.ok(result.url.startsWith('https://firebasestorage.googleapis.com/'));assert.ok(files[0].path.startsWith('users/owner/studio/project/slide-'));assert.equal(files[0].options.metadata.contentType,'image/png');assert.ok(JSON.parse(calls[0].options.body).generationConfig.responseModalities.includes('IMAGE'));assert.ok(JSON.parse(calls[0].options.body).contents[0].parts[0].text.includes(valid.data.context));}
 finally {if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
test('does not save a file if provider returns no image or quota error',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='test-only';
 try {for(const options of [{parts:[{text:'No image'}]},{status:429}]){const {run,files}=setup(options);await assert.rejects(run(valid));assert.equal(files.length,0);}}
 finally {if(old===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=old;}
});
