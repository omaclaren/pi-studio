import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {readStudioDiskFileSnapshot,saveStudioDiskFileAs} from '../shared/studio-disk-revisions.js';
const source=fs.readFileSync(new URL('../index.ts',import.meta.url),'utf8');
const a=source.indexOf('function createEmptyStudioPersistentState()'),b=source.indexOf('async function readPersistedStudioScratchpadText(',a);assert(a>=0&&b>a);
const code=ts.transpileModule(source.slice(a,b),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const initial={version:2,scratchpadsByDocument:{old:'Source notes'},scratchpadMetadataByDocument:{old:{label:'old',updatedAt:1}},reviewNotesByDocument:{}};
async function fixture(run,content=JSON.stringify(initial)){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-transfer-test-')),file=path.join(dir,'metadata.json');fs.writeFileSync(file,content);
 const c=vm.createContext({STUDIO_PERSISTENT_STATE_PATH:file,STUDIO_PERSISTENT_STATE_DIR:dir,studioPersistentStateCache:null,studioPersistentStateRevision:null,studioPersistentStateReadFailed:false,studioPersistentStateQueue:Promise.resolve(),createHash,
  mkdir:fs.promises.mkdir,readFile:fs.promises.readFile,writeFile:fs.promises.writeFile,saveStudioDiskFileAs,readStudioDiskFileSnapshot});
 try{vm.runInContext(code,c);await c.loadStudioPersistentState();await run(c,file);}finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('persistent metadata transfer uses one atomic write for both records and commits receipt only afterwards',async()=>{
 await fixture(async(c,file)=>{let writes=0,committed=false;const before=c.studioPersistentStateRevision;
 c.saveStudioDiskFileAs=options=>{writes++;assert.equal(options.expectedRevision,before);assert.equal(committed,false);return saveStudioDiskFileAs(options);};
 const result=await c.runStudioSavedMetadataTransaction(state=>{state.scratchpadsByDocument.new=state.scratchpadsByDocument.old;state.reviewNotesByDocument.new=[{id:'n',text:'Comment'}];return{persist:true,result:{ok:true},committed:()=>{assert.equal(JSON.parse(fs.readFileSync(file)).scratchpadsByDocument.new,'Source notes');committed=true;}};});
 assert(result.ok&&committed);assert.equal(writes,1);assert.equal(JSON.parse(fs.readFileSync(file)).scratchpadsByDocument.old,'Source notes');assert.notEqual(c.studioPersistentStateRevision,before);
 });
});
test('external metadata edits and unreadable metadata refuse transfer without overwriting the blob',async()=>{
 await fixture(async(c,file)=>{const changed=JSON.stringify({...initial,scratchpadsByDocument:{old:'External change'}});fs.writeFileSync(file,changed);let invoked=false;
 await assert.rejects(c.runStudioSavedMetadataTransaction(()=>{invoked=true;return{persist:false,result:{ok:true}};}),/changed on disk/);assert.equal(invoked,false);assert.equal(fs.readFileSync(file,'utf8'),changed);
 });
 await fixture(async(c,file)=>{await assert.rejects(c.runStudioSavedMetadataTransaction(()=>{throw Error('must not run');}),/could not be read/);assert.equal(fs.readFileSync(file,'utf8'),'invalid JSON');},'invalid JSON');
});
test('unsupported or lossy metadata normalization cannot authorize transfer over the original blob',async()=>{
 for(const value of [{...initial,version:3},{...initial,foreignNotes:['keep']},{...initial,reviewNotesByDocument:{old:[{id:'n',text:'keep',foreignAnchor:'keep too'}]}},{...initial,scratchpadMetadataByDocument:{old:{label:42}}}]){
  const original=JSON.stringify(value);await fixture(async(c,file)=>{await assert.rejects(c.runStudioSavedMetadataTransaction(()=>({persist:true,result:{ok:true}})),/could not be read/);assert.equal(fs.readFileSync(file,'utf8'),original);},original);
 }
});
test('failed atomic metadata write cannot commit a transfer receipt or replace the cache',async()=>{
 await fixture(async(c,file)=>{const before=c.studioPersistentStateCache;let committed=false;c.saveStudioDiskFileAs=()=>({ok:false,message:'disk full'});
 await assert.rejects(c.runStudioSavedMetadataTransaction(state=>{state.scratchpadsByDocument.new='New';return{persist:true,result:{ok:true},committed:()=>{committed=true;}};}),/disk full/);
 assert.equal(committed,false);assert.equal(c.studioPersistentStateCache,before);assert.deepEqual(JSON.parse(fs.readFileSync(file)),initial);
 });
});
test('using existing destination metadata needs no rewrite, but still checks the disk revision',async()=>{
 await fixture(async(c,file)=>{const ino=fs.statSync(file).ino;let committed=false;c.saveStudioDiskFileAs=()=>{throw Error('must not write');};
 assert((await c.runStudioSavedMetadataTransaction(()=>({persist:false,result:{ok:true},committed:()=>{committed=true;}}))).ok);assert(committed);assert.equal(fs.statSync(file).ino,ino);
 fs.writeFileSync(file,'changed');await assert.rejects(c.runStudioSavedMetadataTransaction(()=>({persist:false,result:{ok:true}})),/changed on disk/);
 });
});
