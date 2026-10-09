import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioBuffer as buffer,validateStudioBufferWorkspace} from '../shared/studio-buffer-store.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
import {createStudioDiskRevision} from '../shared/studio-disk-revisions.js';
const main='main_'+'a'.repeat(24),other='other_'+'b'.repeat(24),nonce=n=>n.toString(16).padStart(48,'0');
const state=(id=main,doc=buffer({id:'doc',role:'document',text:'draft'}))=>validateStudioBufferWorkspace({version:2,workspaceId:id,mode:'editor-only',revision:1,savedAt:1,selectedBufferId:doc.id,activePromptId:null,order:[doc.id],buffers:[doc]}).state;
function fixture(options={}){
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true},...options}),cap=server.issue({workspaceId:main,mode:'editor-only'}).capability,handle={};
 const lease=server.bindHostingView(cap,'editor-only',handle);assert(server.write(cap,null,state(),lease.generation).ok);
 const proof=()=>{const remote=server.read(cap);return {generation:lease.generation,documentEpoch:remote.documents.doc,expectedRevision:remote.revision};};
 const request=(n=1)=>({operationId:nonce(n),kind:'save-as',bufferId:'doc',path:'/saved.md',content:'draft',...proof()});
 const writes=[];const writer=authorize=>{const checked=authorize('/saved.md');if(!checked.ok)return checked;writes.push('draft');return {ok:true,path:'/saved.md',revision:createStudioDiskRevision('draft')};};
 const acknowledge=async()=>{const observed=server.read(cap),claim=observed.pendingSaves[0];
  if(observed.state.buffers[0].sourceState.path!==claim.path){
   const transaction=async resolve=>{const step=resolve({scratchpadsByDocument:{},reviewNotesByDocument:{},scratchpadMetadataByDocument:{}});step.committed?.();return step.result;};
   const request={...proof(),operationId:claim.operationId,bufferId:'doc'};const preview=await server.hostingSaveMetadata(cap,request,transaction);assert(preview.ok);
   assert((await server.hostingSaveMetadata(cap,{...request,choice:'carry',metadataRevision:preview.metadataRevision},transaction)).ok);
  }
  const current=server.read(cap),next={...current.state,revision:current.state.revision+1,savedAt:current.state.savedAt+1,
  buffers:current.state.buffers.map(b=>buffer({...b,sourceState:{source:'file',path:'/saved.md',label:'saved.md'},diskRevision:createStudioDiskRevision('draft'),resourceDir:'/',baselineText:'draft'}))};
  return server.write(cap,current.revision,next,lease.generation,current.documents);};
 return {server,cap,lease,handle,proof,request,writer,writes,acknowledge};
}

test('lost save acknowledgement retains backing claim and fences the old mutation epoch',async()=>{
 const f=fixture(),before=f.server.read(f.cap),request=f.request();const result=f.server.hostingSave(f.cap,request,f.writer);assert(result.ok);
 assert.equal(f.server.read(f.cap).pendingSaves[0].path,'/saved.md');assert.equal(f.server.read(f.cap).state.buffers[0].sourceState.path,null);
 assert(result.documents.doc>before.documents.doc);assert.equal(f.server.hostingAuthority(f.cap,f.lease.generation,'doc',before.documents.doc).reason,'document-stale');
 assert.equal(f.server.hostingSave(f.cap,request,f.writer).claimStatus,'pending');assert.equal(f.writes.length,1);
 assert.equal(f.server.hostingSave(f.cap,{...request,path:'/different.md'},f.writer).reason,'invalid-request');
 assert.equal(f.server.hostingMove(f.cap,{operation:'begin',moveId:nonce(9),bufferId:'doc',targetMode:'full',generation:f.lease.generation,expectedRevision:before.revision}).reason,'save-ack-pending');
 assert((await f.acknowledge()).ok);assert.deepEqual(f.server.read(f.cap).pendingSaves,[]);
 assert.equal(f.server.hostingSave(f.cap,request,f.writer).claimStatus,'acknowledged');assert.equal(f.writes.length,1);
});

test('focus authority rejects a retired view generation',()=>{
 const f=fixture();assert(f.server.hostingViewAuthority(f.cap,f.lease.generation).ok);
 f.server.releaseHostingView(f.cap,f.handle);const next=f.server.bindHostingView(f.cap,'editor-only',{});
 assert.equal(f.server.hostingViewAuthority(f.cap,f.lease.generation).reason,'lease-stale');assert(f.server.hostingViewAuthority(f.cap,next.generation).ok);
});

test('owner lookup includes a pending save at its written path, without changing backing',()=>{
 const f=fixture();assert(f.server.hostingSave(f.cap,f.request(),f.writer).ok);
 const found=f.server.hostingOwner(f.cap,'/saved.md');assert(found.ok);assert.equal(found.owner?.bufferId,'doc');assert.equal(found.owner?.workspaceId,main);
 assert.equal(f.server.read(f.cap).state.buffers[0].sourceState.path,null);assert.equal(f.writes.length,1);
});

test('pending save prevents a second editor from claiming the written path',()=>{
 const f=fixture();assert(f.server.hostingSave(f.cap,f.request(),f.writer).ok);
 const cap=f.server.issue({workspaceId:other,mode:'editor-only'}).capability,lease=f.server.bindHostingView(cap,'editor-only',{});
 const second=state(other,buffer({id:'second',role:'document',sourceState:{source:'file',path:'/saved.md',label:'saved.md'}}));
 assert.equal(f.server.write(cap,null,second,lease.generation).reason,'already-open');assert.equal(f.server.read(cap).state,null);
});

test('pending saved-file ownership also fences verified hard-link aliases',()=>{
 const f=fixture({hosting:{canonicalPath:p=>p,requireView:true,sameFile:(a,b)=>a==='/saved.md'&&b==='/alias.md'}});
 assert(f.server.hostingSave(f.cap,f.request(),f.writer).ok);assert.equal(f.server.hostingOwner(f.cap,'/alias.md').owner?.bufferId,'doc');
 const cap=f.server.issue({workspaceId:other,mode:'editor-only'}).capability,lease=f.server.bindHostingView(cap,'editor-only',{});
 assert.equal(f.server.write(cap,null,state(other,buffer({id:'second',role:'document',sourceState:{source:'file',path:'/alias.md',label:'alias'}})),lease.generation).reason,'already-open');
});

test('same text does not acknowledge changed backing; text edits can continue under the old backing',async()=>{
 const f=fixture();assert(f.server.hostingSave(f.cap,f.request(),f.writer).ok);let current=f.server.read(f.cap);
 const changed={...current.state,revision:2,savedAt:2,buffers:current.state.buffers.map(b=>buffer({...b,sourceState:{source:'file',path:'/different.md',label:'different'}}))};
 assert.equal(f.server.write(f.cap,current.revision,changed,f.lease.generation,current.documents).reason,'save-ack-pending');
 const editing={...current.state,revision:2,savedAt:2,buffers:current.state.buffers.map(b=>buffer({...b,text:'new unsaved text'}))};
 assert(f.server.write(f.cap,current.revision,editing,f.lease.generation,current.documents).ok);current=f.server.read(f.cap);
 assert.equal(current.pendingSaves.length,1);assert.equal(current.state.buffers[0].text,'new unsaved text');
 assert((await f.acknowledge()).ok);assert.equal(f.server.read(f.cap).state.buffers[0].text,'new unsaved text');
});

test('explicit discard retains disk output and requires current document authority and consent',()=>{
 const f=fixture(),old=f.proof(),request=f.request();assert(f.server.hostingSave(f.cap,request,f.writer).ok);
 const discard={...old,operationId:request.operationId,bufferId:'doc',confirmed:true};
 assert.equal(f.server.discardHostingSave(f.cap,discard).reason,'document-stale');
 assert.equal(f.server.discardHostingSave(f.cap,{...discard,...f.proof(),confirmed:false}).reason,'confirmation-required');
 assert(f.server.discardHostingSave(f.cap,{...discard,...f.proof()}).ok);assert.equal(f.server.read(f.cap).pendingSaves.length,0);assert.equal(f.writes.length,1);
 assert.equal(f.server.hostingSave(f.cap,request,f.writer).claimStatus,'discarded');assert.equal(f.writes.length,1);
});

test('expired successful-save receipts cannot reactivate original same-byte mutations',async()=>{
 let time=1;const f=fixture({now:()=>time}),request=f.request();assert(f.server.hostingSave(f.cap,request,f.writer).ok);assert((await f.acknowledge()).ok);
 time+=600_001;assert.equal(f.server.hostingSave(f.cap,request,f.writer).reason,'document-stale');assert.equal(f.writes.length,1);
});

test('same-backed same-byte SaveOver rotates authority even when its acknowledgement changes no recovery fields',()=>{
 let time=1;const f=fixture({now:()=>time}),initial=f.server.read(f.cap);
 const backed={...initial.state,revision:2,savedAt:2,buffers:[buffer({...initial.state.buffers[0],sourceState:{source:'file',path:'/saved.md',label:'saved.md'},resourceDir:'/',baselineText:'draft',diskRevision:createStudioDiskRevision('draft')})]};
 assert(f.server.write(f.cap,initial.revision,backed,f.lease.generation,initial.documents).ok);
 const before=f.server.read(f.cap),request={...f.request(),kind:'save-over',expectedDiskRevision:createStudioDiskRevision('draft')};
 const saved=f.server.hostingSave(f.cap,request,f.writer);assert(saved.ok);assert(saved.documents.doc>before.documents.doc);
 assert.deepEqual(f.server.read(f.cap).state,before.state);
 const ack=f.server.write(f.cap,before.revision,before.state,f.lease.generation,saved.documents);assert(ack.ok);assert.equal(ack.revision,before.revision);
 assert.deepEqual(f.server.read(f.cap).pendingSaves,[]);
 time+=600_001;assert.equal(f.server.hostingSave(f.cap,request,f.writer).reason,'document-stale');assert.equal(f.writes.length,1);
});

test('acknowledged saves do not exhaust a lifetime receipt budget',async()=>{
 const f=fixture(),original=f.request();
 for(let i=1;i<=200;i++){assert(f.server.hostingSave(f.cap,f.request(i),f.writer).ok);assert((await f.acknowledge()).ok);}
 assert.equal(f.server.hostingSave(f.cap,original,f.writer).reason,'document-stale');assert.equal(f.writes.length,200);
});

test('refused ownership does not call a writer; stale socket requests remain fenced after reconnect',()=>{
 const f=fixture(),request=f.request();f.server.releaseHostingView(f.cap,f.handle);assert(f.server.bindHostingView(f.cap,'editor-only',{}).ok);
 assert.equal(f.server.hostingSave(f.cap,request,()=>{throw new Error('must not write');}).reason,'lease-stale');
});
