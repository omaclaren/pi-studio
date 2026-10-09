import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioBuffer as buffer,validateStudioBufferWorkspace} from '../shared/studio-buffer-store.js';
import {createStudioBufferClient,projectStudioBufferEditor} from '../shared/studio-buffer-client.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
import {createStudioDiskRevision} from '../shared/studio-disk-revisions.js';
const id='resolution_'+'a'.repeat(24),op='b'.repeat(48);
async function fixture({backed=true,provenance=null}={}) {
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true}}),cap=server.issue({workspaceId:id,mode:'full'}).capability;
 let generation=server.bindHostingView(cap,'full',{}).generation;
 const doc=buffer({id:'doc',role:'document',text:'saved bytes',baselineText:backed?'old bytes':'',diskRevision:backed?createStudioDiskRevision('old bytes'):null,
  sourceState:{...(backed?{source:'file',path:'/old.md',label:'old.md'}:{}),...(provenance?{provenance}:{})},resourceDir:backed?'/':'',metadata:{scratchpadKey:'scratch',reviewNotesKey:'notes'}});
 const state=validateStudioBufferWorkspace({version:2,workspaceId:id,mode:'full',revision:1,savedAt:1,selectedBufferId:'doc',activePromptId:'prompt',order:['prompt','doc'],buffers:[buffer({id:'prompt',role:'prompt',text:'keep Prompt'}),doc]}).state;
 assert(server.write(cap,null,state,generation).ok);
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const client=createStudioBufferClient({workspaceId:id,mode:'full',switching:true,hosting:true,storage,makeBufferId:()=>{throw Error('no new identity');},canRestore:()=>true,
  getHostingGeneration:()=>generation,readRemote:async()=>server.read(cap),writeRemote:async(s,r,e)=>server.write(cap,r,s,generation,e),readLegacyRemote:async()=>({ok:true,state:null})});
 assert((await client.initialize(projectStudioBufferEditor(state),doc.baselineText)).ok);await client.settled();
 let writes=0; const path=backed?'/old.md':'/saved.md';
 const request={...client.hostingAuthority(),operationId:op,kind:backed?'save-over':'save-as',path,content:'saved bytes'};
 const saved=server.hostingSave(cap,request,authorize=>{assert(authorize(path).ok);writes++;return {ok:true,path,revision:createStudioDiskRevision('saved bytes')};});assert(saved.ok);
 // Lost saved message; later text is kept locally despite its stale publish proof.
 assert(client.persist({...projectStudioBufferEditor(client.snapshot()),text:'later typing'},doc.baselineText).ok);await client.settled();
 assert((await client.retry()).ok);
 return {client,server,cap,data,storage,path,doc,writes:()=>writes};
}
test('attaching a retained SaveOver keeps later text, Prompt, identity, views and metadata',async()=>{
 const f=await fixture(),before=f.client.snapshot(),prompt=before.buffers[0];
 assert.equal(typeof f.client.attachHostingSave,'function');assert.equal(f.client.needsUnloadConfirmation(),true);
 const result=f.client.attachHostingSave(op);assert(result.ok,result.message);await f.client.settled();
 const current=f.client.snapshot(),doc=current.buffers.find(b=>b.id==='doc');
 assert.equal(doc.text,'later typing');assert.equal(doc.baselineText,'saved bytes');assert.equal(doc.diskRevision,createStudioDiskRevision('saved bytes'));
 assert.deepEqual(doc.metadata,f.doc.metadata);assert.deepEqual(doc.view,before.buffers[1].view);assert.deepEqual(current.buffers[0],prompt);
 assert.equal(f.writes(),1);assert.deepEqual(f.server.read(f.cap).pendingSaves,[]);assert.equal(f.client.needsUnloadConfirmation(),false);
});
test('changed backing requires a retained server metadata decision, not a client reset flag',async()=>{
 const f=await fixture({backed:false}),before=f.client.snapshot();
 assert.equal(f.client.attachHostingSave(op).reason,'metadata-decision-required');assert.equal(f.client.snapshot(),before);
 assert.equal(f.client.attachHostingSave(op,{allowMetadataReset:true}).reason,'metadata-decision-required');assert.equal(f.client.snapshot(),before);
 const db={scratchpadsByDocument:{scratch:'Kept note'},reviewNotesByDocument:{},scratchpadMetadataByDocument:{}};
 const transaction=async resolve=>{const step=resolve(db);step.committed?.();return step.result;};
 const proof={...f.client.hostingAuthority(),operationId:op};const preview=await f.server.hostingSaveMetadata(f.cap,proof,transaction);assert(preview.ok);
 assert((await f.server.hostingSaveMetadata(f.cap,{...proof,choice:'carry',metadataRevision:preview.metadataRevision},transaction)).ok);
 assert((await f.client.retry()).ok);const result=f.client.attachHostingSave(op);assert(result.ok);await f.client.settled();
 const doc=f.client.snapshot().buffers[1];assert.equal(doc.sourceState.path,f.path);assert.equal(doc.text,'later typing');assert.equal(doc.baselineText,'saved bytes');
 assert.equal(doc.resourceDir,'/');assert.equal(doc.metadata.scratchpadKey,'file:'+f.path);assert.equal(doc.metadata.reviewNotesKey,'file:'+f.path);assert.equal(f.writes(),1);
 assert.equal(db.scratchpadsByDocument.scratch,'Kept note');assert.equal(db.scratchpadsByDocument['file:'+f.path],'Kept note');assert.deepEqual(f.server.read(f.cap).pendingSaves,[]);
});
test('retained Save As and Save Over preserve the initiating response origin through acknowledgement and recovery',async()=>{
 const provenance={version:1,kind:'response',responseId:'original-response',responseNumber:3,annotated:true};
 for(const backed of [false,true]){const f=await fixture({backed,provenance});
  if(!backed){const db={scratchpadsByDocument:{},reviewNotesByDocument:{},scratchpadMetadataByDocument:{}},transaction=async resolve=>{const step=resolve(db);step.committed?.();return step.result;};const proof={...f.client.hostingAuthority(),operationId:op},preview=await f.server.hostingSaveMetadata(f.cap,proof,transaction);assert(preview.ok);assert((await f.server.hostingSaveMetadata(f.cap,{...proof,choice:'carry',metadataRevision:preview.metadataRevision},transaction)).ok);assert((await f.client.retry()).ok);}
  assert(f.client.attachHostingSave(op).ok);await f.client.settled();const doc=f.client.snapshot().buffers[1];assert.equal(doc.text,'later typing');assert.equal(doc.sourceState.path,f.path);assert.deepEqual(doc.sourceState.provenance,provenance);assert.deepEqual(f.server.read(f.cap).state.buffers[1].sourceState.provenance,provenance);assert.deepEqual(JSON.parse(f.data.get('piStudio.bufferWorkspace.v2:'+id)).buffers[1].sourceState.provenance,provenance);assert.equal(f.writes(),1);
 }
});
test('unknown/stale outcomes cannot mutate a different selected buffer or uncheckpointed work',async()=>{
 const f=await fixture();assert.equal(f.client.attachHostingSave('c'.repeat(48)).reason,'save-not-found');
 assert(f.client.capture({...projectStudioBufferEditor(f.client.snapshot()),text:'unpublished'},f.doc.baselineText).ok);
 const before=f.client.snapshot();assert.equal(f.client.attachHostingSave(op).reason,'unacknowledged');assert.equal(f.client.snapshot(),before);
});
test('explicit keep-backing resolution leaves disk output alone and retains later text',async()=>{
 const f=await fixture(),proof=f.client.hostingAuthority();assert(f.server.discardHostingSave(f.cap,{...proof,operationId:op,confirmed:true}).ok);
 assert((await f.client.retry()).ok);assert.equal(f.client.snapshot().buffers[1].baselineText,'old bytes');assert.equal(f.client.snapshot().buffers[1].text,'later typing');assert.equal(f.writes(),1);
 assert.equal(f.client.attachHostingSave(op).reason,'save-not-found');
});
test('an independently changed browser copy prevents attachment and is retained',async()=>{
 for(const malformed of [false,true]) {
  const f=await fixture(),key='piStudio.bufferWorkspace.v2:'+id,before=f.client.snapshot();
  const foreign=malformed?'foreign recovery':JSON.stringify({...before,revision:before.revision+1});f.data.set(key,foreign);
  assert.equal(f.client.attachHostingSave(op).reason,malformed?'invalid-json':'storage-changed');assert.equal(f.client.snapshot(),before);assert.equal(f.data.get(key),foreign);
 }
});
test('quota failure after attachment retains unload protection even when server acknowledgement succeeds',async()=>{
 const f=await fixture();f.storage.setItem=()=>{throw Error('quota');};
 const result=f.client.attachHostingSave(op);assert(result.ok);assert.equal(result.localPersisted,false);await f.client.settled();
 assert.deepEqual(f.server.read(f.cap).pendingSaves,[]);assert.equal(f.client.snapshot().buffers[1].text,'later typing');assert.equal(f.client.needsUnloadConfirmation(),true);assert.equal(f.writes(),1);
});
