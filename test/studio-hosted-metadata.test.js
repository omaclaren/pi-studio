import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioBuffer as buffer} from '../shared/studio-buffer-store.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
const workspaceId='main_'+'a'.repeat(24),nonce='1'.repeat(48);
function fixture(){
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true}}),cap=server.issue({workspaceId,mode:'full'}).capability,handle={};
 const lease=server.bindHostingView(cap,'full',handle),state={version:2,workspaceId,mode:'full',revision:1,savedAt:1,activePromptId:'prompt',selectedBufferId:'doc',order:['prompt','doc'],buffers:[buffer({id:'prompt',role:'prompt',text:'Prompt'}),buffer({id:'doc',role:'document',text:'Document'})]};
 assert(server.write(cap,null,state,lease.generation).ok);
 const proof=id=>({generation:lease.generation,bufferId:id,documentEpoch:server.read(cap).documents[id]});
 const begin=()=>server.hostingMove(cap,{operation:'begin',moveId:nonce,bufferId:'doc',targetMode:'editor-only',generation:lease.generation,expectedRevision:server.read(cap).revision});
 return {server,cap,handle,lease,proof,begin};
}
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

test('detached copy intent is repeatable without creating another document, including after reconnect',()=>{
 const f=fixture(),before=f.server.read(f.cap),request={...f.proof('doc'),operationId:nonce,expectedRevision:before.revision};
 const result=f.server.hostingCopy(f.cap,request);assert(result.ok);
 const copy=f.server.hostedWorkspace(result.workspaceId).buffers[0];assert.equal(copy.text,'Document');assert.notEqual(copy.id,'doc');assert.equal(copy.sourceState.path,null);assert.equal(copy.baselineText,'');assert.equal(copy.metadata.reviewNotesKey,null);
 assert.deepEqual(f.server.read(f.cap).state,before.state);assert.deepEqual(f.server.hostingCopy(f.cap,request),result);
 assert.equal(f.server.hostingCopy(f.cap,{...request,bufferId:'prompt'}).reason,'invalid-request');
 f.server.releaseHostingView(f.cap,f.handle);const replacement=f.server.bindHostingView(f.cap,'full',{});
 assert.equal(f.server.hostingCopy(f.cap,request).reason,'lease-stale');assert.deepEqual(f.server.hostingCopy(f.cap,{...request,generation:replacement.generation}),result);
});

test('metadata pin blocks moving its document until persistence completes',async()=>{
 const f=fixture(),g=gate();let written=false;
 const pending=f.server.hostingMetadata(f.cap,f.proof('doc'),'review-notes','draft:doc',async check=>{await g.promise;check();written=true;});
 assert.equal(f.begin().reason,'metadata-pending');g.resolve();assert((await pending).ok);assert(written);assert(f.begin().ok);
});
test('unrelated Prompt metadata authority survives Document move-out',async()=>{
 const f=fixture(),g=gate();let written=false;
 const pending=f.server.hostingMetadata(f.cap,f.proof('prompt'),'scratchpad','draft:prompt',async check=>{await g.promise;check();written=true;});
 const before=f.server.read(f.cap);const moved=f.server.hostingMove(f.cap,{operation:'move-out',moveId:nonce,bufferId:'doc',generation:f.lease.generation,expectedRevision:before.revision});assert(moved.ok);
 g.resolve();assert((await pending).ok);assert(written);assert.equal(f.server.read(f.cap).documents.prompt,before.documents.prompt);
});
test('metadata queued on a retired connection rechecks authority after awaiting',async()=>{
 const f=fixture(),g=gate();let written=false;
 const pending=f.server.hostingMetadata(f.cap,f.proof('doc'),'review-notes','draft:doc',async check=>{await g.promise;check();written=true;});
 f.server.releaseHostingView(f.cap,f.handle);f.server.bindHostingView(f.cap,'full',{});g.resolve();assert.equal((await pending).reason,'lease-stale');assert.equal(written,false);
});
test('metadata association and backing changes cannot cross an in-flight pin',async()=>{
 const f=fixture(),g=gate();const pending=f.server.hostingMetadata(f.cap,f.proof('doc'),'review-notes','draft:doc',async check=>{await g.promise;check();});
 const before=f.server.read(f.cap),state={...before.state,revision:2,savedAt:2,buffers:before.state.buffers.map(b=>b.id==='doc'?buffer({...b,sourceState:{source:'blank',label:'changed',path:null,draftId:'new'}}):b)};
 assert.equal(f.server.write(f.cap,before.revision,state,f.lease.generation,before.documents).reason,'metadata-pending');
 g.resolve();assert((await pending).ok);assert(f.server.write(f.cap,before.revision,state,f.lease.generation,before.documents).ok);
});
