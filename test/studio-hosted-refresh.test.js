import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createStudioBuffer} from '../shared/studio-buffer-store.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
const revision='sha256:'+'a'.repeat(64);
function fixture(){
 const aliases=new Map(),server=createStudioBufferServerStore({now:()=>100,hosting:{requireView:true,canonicalPath:p=>aliases.get(p)||p}}),workspaceId='refresh_workspace_00001',cap=server.issue({workspaceId,mode:'full'}).capability;let handle={},generation=server.bindHostingView(cap,'full',handle).generation;
 const prompt=createStudioBuffer({id:'prompt',role:'prompt',text:'Keep Prompt',sourceState:{source:'blank',path:null,draftId:'p',label:'blank'}}),doc=createStudioBuffer({id:'doc',role:'document',text:'Unsaved Document',baselineText:'Old disk',diskRevision:revision,sourceState:{source:'file',path:'/owned.md',label:'owned.md'},resourceDir:'/'});
 assert(server.write(cap,null,{version:2,workspaceId,mode:'full',revision:1,savedAt:1,selectedBufferId:'doc',activePromptId:'prompt',order:['prompt','doc'],buffers:[prompt,doc]},generation).ok);
 const request=()=>({bufferId:'doc',documentEpoch:server.read(cap).documents.doc,expectedRevision:server.read(cap).revision,generation,path:'/owned.md'}),file=()=>({ok:true,resolvedPath:'/owned.md',label:'owned.md',text:'Fresh disk',diskRevision:revision});
 return{server,cap,aliases,request,file,reconnect(){server.releaseHostingView(cap,handle);handle={};generation=server.bindHostingView(cap,'full',handle).generation;}};
}
test('refresh returns an authorized current-file snapshot without changing any workspace or baseline',()=>{
 const f=fixture(),before=f.server.read(f.cap);let calls=0;
 const result=f.server.hostingRefresh(f.cap,{...f.request(),sourcePath:'/forged',resourceDir:'/forged'},(path,buffer)=>{calls++;assert.equal(path,'/owned.md');assert.equal(buffer.sourceState.path,path);assert.equal(buffer.resourceDir,'/');buffer.text='cannot mutate the checkpoint';return f.file();});
 assert.deepEqual(result,f.file());assert.equal(calls,1);assert.deepEqual(f.server.read(f.cap),before);
});
test('refresh is bound to the exact current file, not another path or a blank buffer',()=>{
 for(const change of [{path:''},{path:'/other.md'},{path:'relative.md'},{path:'/owned.md\0suffix'},{bufferId:'prompt'}]){const f=fixture(),r={...f.request(),...change};if(r.bufferId==='prompt')r.documentEpoch=f.server.read(f.cap).documents.prompt;assert.equal(f.server.hostingRefresh(f.cap,r,()=>{assert.fail('must not read');}).ok,false);}
 const f=fixture();f.aliases.set('/owned.md','/retargeted.md');assert.equal(f.server.hostingRefresh(f.cap,f.request(),()=>{assert.fail('retarget must not read');}).ok,false);
});
test('stale connection, epoch and checkpoint refuse before reading',()=>{
 for(const change of [{generation:0},{documentEpoch:999},{expectedRevision:'0'.repeat(48)}]){const f=fixture();assert.equal(f.server.hostingRefresh(f.cap,{...f.request(),...change},()=>{assert.fail('must not read');}).ok,false);}
 const f=fixture(),r=f.request();f.reconnect();assert.equal(f.server.hostingRefresh(f.cap,r,()=>{assert.fail('old connection must not read');}).ok,false);
});
test('ownership and resource hints do not override independent file permission refusal',()=>{const f=fixture(),before=f.server.read(f.cap),refusal={ok:false,reason:'grant-required',message:'File permission is required.'};assert.deepEqual(f.server.hostingRefresh(f.cap,f.request(),()=>refusal),refusal);assert.deepEqual(f.server.read(f.cap),before);});
test('an affected retained disk save blocks Refresh, without blocking the unrelated Prompt',()=>{
 const f=fixture(),r={...f.request(),operationId:'1'.repeat(48),kind:'save-over',content:'Unsaved Document',expectedDiskRevision:revision,overwrite:false,force:false};
 assert(f.server.hostingSave(f.cap,r,authorize=>{assert(authorize(r.path).ok);return{ok:true,path:r.path,revision};}).ok);
 assert.equal(f.server.hostingRefresh(f.cap,f.request(),()=>{assert.fail('pending save must not read');}).reason,'save-ack-pending');
 const before=f.server.read(f.cap),next=structuredClone(before.state);next.revision++;next.savedAt++;next.buffers[0].revision++;next.buffers[0].text='Newer Prompt';assert(f.server.write(f.cap,before.revision,next,r.generation,before.documents).ok);
});
test('affected metadata blocks a read until settled, while unrelated Prompt metadata does not',async()=>{
 for(const affected of [true,false]){const f=fixture(),r=f.request(),bufferId=affected?'doc':'prompt';let release;const pending=f.server.hostingMetadata(f.cap,{...r,bufferId,documentEpoch:f.server.read(f.cap).documents[bufferId]},'scratchpad',affected?'file:/owned.md':'draft:p',()=>new Promise(resolve=>{release=resolve;}));assert.equal(typeof release,'function');
  const result=f.server.hostingRefresh(f.cap,r,()=>{assert.equal(affected,false);return f.file();});assert.equal(result.ok,!affected);if(affected)assert.equal(result.reason,'metadata-pending');release();assert((await pending).ok);assert(f.server.hostingRefresh(f.cap,r,f.file).ok);
 }
});
test('reader cannot return a foreign snapshot or defer the authorized read asynchronously',()=>{const f=fixture();assert.equal(f.server.hostingRefresh(f.cap,f.request(),()=>({...f.file(),resolvedPath:'/other.md'})).ok,false);assert.equal(f.server.hostingRefresh(f.cap,f.request(),async()=>f.file()).ok,false);});
test('ownership, source identity and checkpoint are checked again after the synchronous reader',()=>{
 for(const change of [f=>f.reconnect(),f=>f.aliases.set('/owned.md','/retargeted.md'),f=>{const old=f.server.read(f.cap),next=structuredClone(old.state);next.revision++;next.savedAt++;next.buffers[0].text='New Prompt';next.buffers[0].revision++;assert(f.server.write(f.cap,old.revision,next,f.request().generation,old.documents).ok);}]){const f=fixture();assert.equal(f.server.hostingRefresh(f.cap,f.request(),()=>{change(f);return f.file();}).ok,false);}
});
test('the hosted WebSocket refresh path uses bound authority plus existing file permission checks',()=>{
 const source=readFileSync(new URL('../index.ts',import.meta.url),'utf8'),start=source.indexOf('if (msg.type === "refresh_from_disk_request") {'),end=source.indexOf('if (msg.type === "send_to_editor_request")',start),route=source.slice(start,end);assert(start>0&&end>start);assert.match(route,/studioBufferStateStore\.hostingRefresh/);assert.match(route,/resolveStudioLocalPreviewResourcePath/);assert.match(route,/requireCanonicalPath: true/);assert.match(route,/if \(!hosted && \(!requestedPath \|\| initialStudioDocument\?\.path === refreshed\.resolvedPath\)\)/,'Refresh must not expand resource grants from an ownership claim');
});
