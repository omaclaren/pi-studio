import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBuffer, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";
import { createStudioBufferClient, projectStudioBufferEditor } from "../shared/studio-buffer-client.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";

const mainId='main_'+'a'.repeat(24), tabId='tab_'+'b'.repeat(24), moveId='c'.repeat(48);
const ws=(id,mode,buffers)=>validateStudioBufferWorkspace({version:2,workspaceId:id,mode,revision:1,savedAt:10,
  activePromptId:mode==='full'?'prompt':null,selectedBufferId:buffers.at(-1).id,order:buffers.map(b=>b.id),buffers}).state;
async function setup(options={}) {
  const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p},...options});
  const prompt=createStudioBuffer({id:'prompt',role:'prompt',text:'Keep this Prompt'});
  const doc=createStudioBuffer({id:'doc',role:'document',text:'Unsaved document with [an: note]',baselineText:'saved baseline',diskRevision:'sha256:'+'a'.repeat(64),
    sourceState:{source:'file',path:'/notes.md',label:'notes.md'},metadata:{reviewNotesKey:'review',scratchpadKey:'scratch'},
    view:{editorView:'preview',rightView:'editor-preview',scrollTop:101,previewScrollTop:29,rightScrollTop:77,selectionStart:2,selectionEnd:8}});
  async function page(state) {
    const cap=server.issue({workspaceId:state.workspaceId,mode:state.mode}).capability;assert(server.write(cap,null,state).ok);
    const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};let seq=0;
    const client=createStudioBufferClient({workspaceId:state.workspaceId,mode:state.mode,switching:state.mode==='full',hosting:true,
      storage,makeBufferId:()=>state.mode+'-'+(++seq),canRestore:()=>true,
      readRemote:async()=>server.read(cap),writeRemote:async(s,r)=>server.write(cap,r,s),readLegacyRemote:async()=>({ok:true,state:null})});
    const selected=state.buffers.find(b=>b.id===state.selectedBufferId);
    assert((await client.initialize(projectStudioBufferEditor(state),selected.baselineText)).ok);await client.settled();
    return {client,cap,values,storage,key:'piStudio.bufferWorkspace.v2:'+state.workspaceId};
  }
  const source=await page(ws(mainId,'full',[prompt,doc])),target=await page(ws(tabId,'editor-only',[createStudioBuffer({id:'blank',role:'document'})]));
  let sourceProof;
  const freezeSource=()=>{const result=source.client.freezeHosting({moveId,direction:'outgoing',bufferId:'doc'});if(result.ok)sourceProof=result.proof;return result;};
  const freezeTarget=()=>target.client.freezeHosting({moveId,direction:'incoming',bufferId:'blank'});
  const begin=proof=>server.hostingMove(source.cap,{operation:'begin',moveId,bufferId:'doc',expectedRevision:proof.expectedRevision});
  const accept=proof=>server.hostingMove(target.cap,{operation:'accept',moveId,targetBufferId:'blank',expectedRevision:proof.expectedRevision});
  const status=()=>server.hostingMove(source.cap,{operation:'status',moveId});
  const cancel=()=>server.hostingMove(source.cap,{operation:'cancel',moveId,expectedRevision:sourceProof?.expectedRevision});
  return {server,source,target,prompt,doc,freezeSource,freezeTarget,begin,accept,status,cancel};
}

test('two client owners freeze, transfer exactly, persist authoritative snapshots and resume separately',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);
  assert(f.source.client.needsUnloadConfirmation());assert(f.target.client.needsUnloadConfirmation());
  const accepted=f.accept(b.proof);assert(accepted.ok);assert(f.target.client.finishHosting(b.proof,accepted).ok);
  assert(f.source.client.finishHosting(a.proof,f.status()).ok);
  assert(f.source.client.needsUnloadConfirmation(),'source keeps its backup until destination adoption');
  assert(f.server.hostingMove(f.target.cap,{operation:'adopted',moveId,bufferId:'doc'}).ok);
  assert(f.source.client.resolveHandoff(f.status()).ok);
  assert.deepEqual(f.target.client.snapshot().buffers[0],f.doc);assert.deepEqual(f.source.client.snapshot().buffers.find(b=>b.role==='prompt'),f.prompt);
  for(const page of [f.source,f.target]){
    assert.deepEqual(JSON.parse(page.values.get(page.key)),page.client.snapshot());assert.deepEqual(f.server.read(page.cap).state,page.client.snapshot());
    assert.equal(page.client.isHostingFrozen(),false);assert.equal(page.client.needsUnloadConfirmation(),false);
  }
});

test('frozen source rejects mutation, switching, appending and recovery retry; read-only selection does not poison it',async()=>{
  const f=await setup(),before=f.source.client.snapshot(),a=f.freezeSource();assert(a.ok);assert(f.begin(a.proof).ok);
  assert.equal(f.source.client.select('prompt').reason,'hosting-frozen');
  assert.equal(f.source.client.replace('doc',0,{},null).reason,'hosting-frozen');
  assert.equal(f.source.client.appendDocumentToPrompt({}).reason,'hosting-frozen');
  assert.equal(f.source.client.appendSelectionToPrompt({}).reason,'hosting-frozen');
  assert.equal((await f.source.client.retry()).reason,'hosting-frozen');
  const editor={...projectStudioBufferEditor(before),selectionStart:0,selectionEnd:3};
  assert.equal(f.source.client.persist(editor,f.doc.baselineText).reason,'hosting-frozen');assert.equal(f.source.client.snapshot(),before);
  const cancelled=f.cancel();assert(f.source.client.finishHosting(a.proof,cancelled).ok);assert.deepEqual(f.source.client.snapshot().buffers,before.buffers);
  assert(f.source.client.snapshot().revision>before.revision);
});

test('cancellation can overtake Begin; late delivery cannot re-freeze the resumed editor',async()=>{
  const f=await setup(),a=f.freezeSource();assert(a.ok);const cancelled=f.cancel();assert.equal(cancelled.status,'cancelled');
  assert(f.source.client.finishHosting(a.proof,cancelled).ok);assert.equal(f.begin(a.proof).reason,'conflict');
  const editor={...projectStudioBufferEditor(f.source.client.snapshot()),text:f.doc.text+' More'};
  assert(f.source.client.persist(editor,f.doc.baselineText).ok);await f.source.client.settled();assert.equal(f.source.client.needsUnloadConfirmation(),false);
});

test('lost Begin acknowledgement is retried with the same nonce, not a second move',async()=>{
  const f=await setup(),a=f.freezeSource();assert(a.ok);const first=f.begin(a.proof),retry=f.begin(a.proof);
  assert(first.ok&&retry.ok);assert.equal(first.moveId,retry.moveId);assert.equal(retry.status,'offered');
  assert(f.source.client.finishHosting(a.proof,f.cancel()).ok);
});

test('late editor text and explicit DOM consent revocation prevent local adoption after server commit',async()=>{
  for(const lateText of [true,false]){
    const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);
    const before=f.source.client.snapshot();
    if(lateText)assert.equal(f.source.client.capture({...projectStudioBufferEditor(before),text:'Later text must not be overwritten'},f.doc.baselineText).reason,'hosting-frozen');
    assert.equal(f.source.client.finishHosting(a.proof,f.status(),()=>lateText).reason,'editor-changed');
    assert.equal(f.source.client.snapshot(),before);assert(f.source.client.isHostingFrozen());assert(f.source.client.needsUnloadConfirmation());
  }
});

test('changed browser recovery is not overwritten, including repeated finish attempts',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);
  const before=f.source.client.snapshot(),other={...before,revision:90};const raw=JSON.stringify(other);f.source.values.set(f.source.key,raw);
  for(let i=0;i<2;i++){assert.equal(f.source.client.finishHosting(a.proof,f.status()).reason,'storage-changed');assert.equal(f.source.values.get(f.source.key),raw);assert.equal(f.source.client.snapshot(),before);}
});

test('move outcome cannot replace Prompt, cross workspaces, reuse a stale proof or pretend a network failure is cancellation',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);
  assert.equal(f.source.client.finishHosting(a.proof,{ok:false,reason:'unavailable'}).reason,'unknown-outcome');
  const result=f.status(),bad={...result,state:{...result.state,buffers:result.state.buffers.map(x=>x.role==='prompt'?{...x,text:'overwritten'}:x)}};
  assert.equal(f.source.client.finishHosting(a.proof,bad).reason,'invalid-transition');
  assert.equal(f.source.client.finishHosting(a.proof,{...result,state:{...result.state,workspaceId:tabId}}).reason,'wrong-workspace');
  assert(f.source.client.finishHosting(a.proof,result).ok);assert.equal(f.source.client.finishHosting(a.proof,result).reason,'editor-changed');
});

test('native storage quota failure retains server-backed ownership without falsely claiming local persistence',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);const result=f.accept(b.proof);assert(result.ok);
  f.target.storage.setItem=()=>{throw Error('quota');};const applied=f.target.client.finishHosting(b.proof,result);
  assert(applied.ok);assert.equal(applied.localPersisted,false);assert.deepEqual(f.target.client.snapshot().buffers[0],f.doc);
  assert.equal(f.target.client.needsUnloadConfirmation(),true);assert(f.target.values.has(f.target.key));
});

test('acknowledged cancellation resumes its unchanged owner without disguising a later recovery conflict',async()=>{
  let legacy=null;const f=await setup({legacyState:id=>id===mainId?legacy:null}),a=f.freezeSource();assert(a.ok);assert(f.begin(a.proof).ok);
  const before=f.source.client.snapshot();legacy={...projectStudioBufferEditor(before),savedAt:Date.now()+1000};
  const cancelled=f.cancel();assert(cancelled.ok);assert.equal(cancelled.status,'cancelled');assert(cancelled.checkpointError);assert.equal(cancelled.expiresInMs,0);
  assert(f.source.client.finishHosting(a.proof,cancelled).ok);assert.equal(f.source.client.isHostingFrozen(),false);
  assert.deepEqual(f.source.client.snapshot().buffers,before.buffers);assert(f.source.client.snapshot().revision>before.revision);
  assert(f.source.client.needsUnloadConfirmation());assert.equal(f.server.read(f.source.cap).reason,'legacy-newer');
});

test('changed browser copy and uncheckpointed editor prevent starting a move',async()=>{
  const f=await setup();const editor={...projectStudioBufferEditor(f.source.client.snapshot()),text:f.doc.text+' changed'};
  assert(f.source.client.capture(editor,f.doc.baselineText).ok);assert.equal(f.freezeSource().reason,'unacknowledged');
  assert(f.source.client.persist(editor,f.doc.baselineText).ok);await f.source.client.settled();
  f.source.values.set(f.source.key,JSON.stringify({...f.source.client.snapshot(),revision:77}));assert.equal(f.freezeSource().reason,'storage-changed');
});

async function reloadPage(page,server) {
  const state=page.client.snapshot(),cap=server.issue({workspaceId:state.workspaceId,mode:state.mode}).capability;
  const client=createStudioBufferClient({workspaceId:state.workspaceId,mode:state.mode,switching:state.mode==='full',hosting:true,
    storage:page.storage,makeBufferId:()=>{throw Error('unexpected migration');},canRestore:()=>true,
    readRemote:async()=>server.read(cap),writeRemote:async(s,r)=>server.write(cap,r,s),readLegacyRemote:async()=>({ok:true,state:null})});
  const result=await client.initialize(projectStudioBufferEditor(state),state.buffers.find(b=>b.id===state.selectedBufferId).baselineText);
  await client.settled();return {client,result,cap};
}

test('lost transfer acknowledgements reload through exact server lineage on both sides',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);
  const source=await reloadPage(f.source,f.server),target=await reloadPage(f.target,f.server);
  assert(source.result.ok,JSON.stringify(source.result));assert(target.result.ok,JSON.stringify(target.result));
  assert.deepEqual(target.client.snapshot().buffers[0],f.doc);assert.equal(source.client.snapshot().buffers.find(b=>b.role==='document').text,'');
  assert.deepEqual(source.client.snapshot().buffers.find(b=>b.role==='prompt'),f.prompt);
});

test('quota fallback keeps its unload warning and can reconcile the stale browser copy on reload',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);const moved=f.accept(b.proof);
  const set=f.target.storage.setItem;f.target.storage.setItem=()=>{throw Error('quota');};
  assert(f.target.client.finishHosting(b.proof,moved).ok);assert(f.target.client.needsUnloadConfirmation());f.target.storage.setItem=set;
  const loaded=await reloadPage(f.target,f.server);assert(loaded.result.ok,JSON.stringify(loaded.result));assert.deepEqual(loaded.client.snapshot().buffers[0],f.doc);
});

for(const reload of [false,true]) test(`incoming move preserves concurrent Prompt edits (${reload?'lost ack and reload':'live adoption'})`,async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);
  assert(f.target.client.finishHosting(b.proof,f.accept(b.proof)).ok);assert(f.source.client.finishHosting(a.proof,f.status()).ok);
  assert(f.source.client.select('prompt').ok);await f.source.client.settled();
  const before=f.source.client.snapshot(),slot=before.buffers.find(b=>b.role==='document'),backId='d'.repeat(48);
  const out=f.target.client.freezeHosting({moveId:backId,direction:'outgoing',bufferId:'doc'});
  const incoming=f.source.client.freezeHosting({moveId:backId,direction:'incoming',bufferId:slot.id});assert(out.ok&&incoming.ok);
  assert(f.server.hostingMove(f.target.cap,{operation:'begin',moveId:backId,bufferId:'doc',expectedRevision:out.proof.expectedRevision,targetWorkspaceId:mainId,targetMode:'full'}).ok);
  const text=f.prompt.text+' — typed during move';
  assert(f.source.client.persist({...projectStudioBufferEditor(before),text},'').ok);
  const prompt=f.source.client.snapshot().buffers.find(b=>b.id==='prompt'),localRevision=f.source.client.snapshot().revision;
  const moved=f.server.hostingMove(f.source.cap,{operation:'accept',moveId:backId,targetBufferId:slot.id,expectedRevision:incoming.proof.expectedRevision});assert(moved.ok);
  let client;
  if(reload){const loaded=await reloadPage(f.source,f.server);assert(loaded.result.ok,JSON.stringify(loaded.result));client=loaded.client;}
  else {const applied=f.source.client.finishHosting(incoming.proof,moved);assert(applied.ok,JSON.stringify(applied));assert.equal(applied.selectedChanged,false);client=f.source.client;await client.settled();}
  const after=client.snapshot();assert.deepEqual(after.buffers.find(b=>b.id==='prompt'),prompt);assert.deepEqual(after.buffers.find(b=>b.id==='doc'),f.doc);
  assert(after.revision>localRevision&&after.revision>moved.state.revision);assert.equal(after.selectedBufferId,'prompt');assert.equal(client.isHostingFrozen(),false);
});

test('lineage never replaces an independently changed moving slot',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);
  const old=f.target.client.snapshot(),other={...old,revision:old.revision+1,buffers:[{...old.buffers[0],revision:1,text:'Independent draft'}]};
  const raw=JSON.stringify(other);f.target.values.set(f.target.key,raw);
  const loaded=await reloadPage(f.target,f.server);assert.equal(loaded.result.reason,'diverged');assert.equal(f.target.values.get(f.target.key),raw);
});

test('source backup survives committed transfer before destination adoption and simulated server loss',async()=>{
  const f=await setup(),a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);
  assert(f.source.client.finishHosting(a.proof,f.status()).ok);f.server.clear();
  assert.equal(f.source.client.snapshot().buffers.find(b=>b.role==='document').text,'');
  assert.deepEqual(f.source.client.handoffBackup().record.document,f.doc);assert(f.source.client.handoffBackup().stored);
  assert(f.source.client.needsUnloadConfirmation());assert.equal(f.source.client.resolveHandoff({ok:true,moveId,status:'committed',bufferId:'doc'}).reason,'unknown-outcome');
});

test('escrow quota failure retains an in-memory copy, requires warning, and cannot overwrite another pending backup',async()=>{
  const f=await setup(),set=f.source.storage.setItem;f.source.storage.setItem=(k,v)=>{if(k.endsWith(':handoff'))throw Error('quota');return set(k,v);};
  const a=f.freezeSource(),b=f.freezeTarget();assert(a.ok&&b.ok);assert.equal(f.source.client.handoffBackup().stored,false);
  assert(f.begin(a.proof).ok);assert(f.accept(b.proof).ok);assert(f.source.client.finishHosting(a.proof,f.status()).ok);
  assert.deepEqual(f.source.client.handoffBackup().record.document,f.doc);assert(f.source.client.needsUnloadConfirmation());
  const slot=f.source.client.snapshot().buffers.find(b=>b.role==='document');
  assert.equal(f.source.client.freezeHosting({moveId:'f'.repeat(48),direction:'outgoing',bufferId:slot.id}).reason,'handoff-pending');
  assert.equal(f.source.client.discardHandoff(moveId,false).reason,'confirmation-required');
  assert(f.source.client.discardHandoff(moveId,true).ok);
});
