import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,rmSync,writeFileSync,readFileSync,readdirSync,mkdirSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {saveStudioDiskFileAs,saveStudioDiskFileIfRevision,createStudioDiskRevision} from '../shared/studio-disk-revisions.js';

function fixture(fn){const dir=realpathSync(mkdtempSync(join(tmpdir(),'studio-hosted-disk-')));try{return fn(dir);}finally{rmSync(dir,{recursive:true,force:true});}}
const denied={ok:false,reason:'document-owned',message:'Use the existing Document owner.'};

test('ownership refusal cannot overwrite a revision-matching file',()=>fixture(dir=>{
 const path=join(dir,'original.md');writeFileSync(path,'original');
 const result=saveStudioDiskFileIfRevision({path,content:'replacement',expectedRevision:createStudioDiskRevision('original'),authorizeCommit:()=>denied});
 assert.deepEqual(result,denied);assert.equal(readFileSync(path,'utf8'),'original');assert.deepEqual(readdirSync(dir),['original.md']);
}));

test('final ownership check receives canonical destination and cleans its temporary file on refusal',()=>fixture(dir=>{
 const parent=join(dir,'actual');mkdirSync(parent);symlinkSync(parent,join(dir,'alias'));const calls=[];
 const result=saveStudioDiskFileAs({path:join(dir,'alias','new.md'),content:'draft',authorizeCommit:path=>{calls.push(path);return calls.length===1?{ok:true}:denied;}});
 assert.deepEqual(result,denied);assert.deepEqual(calls,[join(parent,'new.md'),join(parent,'new.md')]);assert.deepEqual(readdirSync(parent),[]);
}));

test('asynchronous authorization is rejected rather than treated as approval',()=>fixture(dir=>{
 const result=saveStudioDiskFileAs({path:join(dir,'new.md'),content:'draft',authorizeCommit:async()=>({ok:true})});
 assert.equal(result.ok,false);assert.equal(result.reason,'authority-required');assert.deepEqual(readdirSync(dir),[]);
}));

test('synchronous ownership approval preserves disk CAS and normal saves',()=>fixture(dir=>{
 const path=join(dir,'original.md');writeFileSync(path,'original');const calls=[];
 const options={path,content:'replacement',expectedRevision:createStudioDiskRevision('original'),authorizeCommit:p=>{calls.push(p);return {ok:true};}};
 assert(saveStudioDiskFileIfRevision(options).ok);assert.deepEqual(calls,[path,path]);assert.equal(readFileSync(path,'utf8'),'replacement');
 assert.equal(saveStudioDiskFileIfRevision(options).reason,'disk-changed');assert.equal(calls.length,2);
}));
