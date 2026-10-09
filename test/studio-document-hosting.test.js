import test from "node:test";
import assert from "node:assert/strict";
import { createStudioBuffer, validateStudioBufferWorkspace } from "../shared/studio-buffer-store.js";
import { createStudioDocumentCopy, createStudioDocumentHostingStore } from "../shared/studio-document-hosting.js";
import { createStudioBufferServerStore } from "../shared/studio-buffer-server.js";

const ids = { main: "main_" + "a".repeat(24), outside: "outside_" + "b".repeat(24), third: "third_" + "c".repeat(24) };
function workspace(id, mode, buffers, selected = buffers.at(-1).id) {
  const result = validateStudioBufferWorkspace({ version:2,workspaceId:id,mode,revision:1,savedAt:10,selectedBufferId:selected,
    activePromptId:mode==='full'?buffers.find(b=>b.role==='prompt').id:null,order:buffers.map(b=>b.id),buffers });
  assert(result.ok);return result.state;
}
function fixture(options = {}) {
  let sequence=0,time=100;
  const host=createStudioDocumentHostingStore({makeId:()=>"new_"+(++sequence),canonicalPath:p=>p.replace('/alias/','/canonical/'),now:()=>time,...options});
  const prompt=createStudioBuffer({id:'prompt',role:'prompt',text:'Keep unsent Prompt',baselineText:''});
  const doc=createStudioBuffer({id:'document',role:'document',revision:12,text:'Unsaved [an: keep] text',baselineText:'Disk baseline',
    diskRevision:'sha256:'+'a'.repeat(64),sourceState:{source:'file',label:'notes.md',path:'/canonical/notes.md'},resourceDir:'/canonical',
    view:{editorView:'preview',rightView:'editor-preview',selectionStart:2,selectionEnd:8,scrollTop:431,previewScrollTop:78,rightScrollTop:99},
    metadata:{annotationsEnabled:false,reviewNotesKey:'notes-key',scratchpadKey:'scratch-key'}});
  const main=workspace(ids.main,'full',[prompt,doc]);
  const outside=workspace(ids.outside,'editor-only',[createStudioBuffer({id:'blank',role:'document'})]);
  assert(host.checkpoint(main).ok);assert(host.checkpoint(outside).ok);
  const offer=()=>host.beginMove({workspaceId:ids.main,expectedRevision:host.workspace(ids.main).revision,bufferId:'document'});
  const accept=(move,extra={})=>host.acceptMove({workspaceId:ids.outside,expectedRevision:host.workspace(ids.outside).revision,targetBufferId:host.workspace(ids.outside).selectedBufferId,moveId:move.moveId,...extra});
  return {host,prompt,doc,main,outside,offer,accept,setTime:t=>{time=t;}};
}

test('move preserves identity, unsaved text, baseline, metadata and view; leaves Prompt unchanged',()=>{
  const f=fixture(),move=f.offer();assert(move.ok);assert.equal(move.status,'offered');
  assert.deepEqual(f.host.workspace(ids.main),f.main,'offering alone removes nothing');
  const result=f.accept(move);assert(result.ok);assert.equal(result.status,'committed');
  const a=f.host.workspace(ids.main),b=f.host.workspace(ids.outside);
  assert.deepEqual(a.buffers.find(x=>x.role==='prompt'),f.prompt);
  assert.deepEqual(b.buffers[0],f.doc);assert.equal(b.selectedBufferId,f.doc.id);
  assert.equal(a.buffers.find(x=>x.role==='document').text,'');assert.notEqual(a.selectedBufferId,f.doc.id);
  assert.deepEqual(f.host.owner(f.doc.id),{workspaceId:ids.outside,bufferId:f.doc.id,mode:'editor-only'});
  assert.deepEqual(f.host.findFile('/alias/notes.md'),f.host.owner(f.doc.id));
});

test('move-back uses the same document identity and an explicit existing full workspace',()=>{
  const f=fixture();assert(f.accept(f.offer()).ok);
  const source=f.host.workspace(ids.outside),target=f.host.workspace(ids.main);
  const move=f.host.beginMove({workspaceId:ids.outside,expectedRevision:source.revision,bufferId:f.doc.id,targetMode:'full',targetWorkspaceId:ids.main});assert(move.ok);
  assert(f.host.acceptMove({workspaceId:ids.main,expectedRevision:target.revision,targetBufferId:target.selectedBufferId,moveId:move.moveId}).ok);
  assert.deepEqual(f.host.workspace(ids.main).buffers.find(x=>x.id===f.doc.id),f.doc);
  assert.equal(f.host.workspace(ids.outside).buffers[0].text,'');
});

test('canonical aliases cannot silently acquire a second editor, including a second buffer in one workspace',()=>{
  for(const local of [true,false]){
    const f=fixture();const duplicate=createStudioBuffer({...f.doc,id:'other',sourceState:{...f.doc.sourceState,path:'/alias/notes.md'}});
    const candidate=local?{...f.main,revision:2,savedAt:11,order:[...f.main.order,'other'],buffers:[...f.main.buffers,duplicate]}
      :workspace(ids.third,'editor-only',[duplicate]);
    const result=f.host.checkpoint(candidate);assert.equal(result.reason,'already-open');assert.equal(result.owner.bufferId,'document');
    assert.deepEqual(f.host.workspace(ids.main),f.main);assert.equal(f.host.workspace(ids.third),null);
  }
});

test('old recovery cannot resurrect a moved or retired identity',()=>{
  const f=fixture();const oldDraft=createStudioBuffer({...f.outside.buffers[0],text:'Explicitly replaced draft'});
  assert(f.host.checkpoint({...f.outside,revision:2,savedAt:11,buffers:[oldDraft]}).ok);
  assert(f.accept(f.offer(),{discardTarget:true}).ok);
  assert.equal(f.host.checkpoint(f.main).reason,'stale-workspace');
  assert.equal(f.host.checkpoint({...f.main,revision:20,savedAt:200}).reason,'already-open');
  assert.equal(f.host.checkpoint(workspace(ids.third,'editor-only',[oldDraft])).reason,'retired-document');
});

test('no identity can teleport via a normal checkpoint',()=>{
  const f=fixture();const steal=workspace(ids.third,'editor-only',[f.doc]);
  assert.equal(f.host.checkpoint(steal).reason,'already-open');assert.equal(f.host.owner('document').workspaceId,ids.main);
});

test('source is frozen while offered, but exact checkpoint retry is harmless',()=>{
  const f=fixture(),move=f.offer();assert(move.ok);assert(f.host.checkpoint(f.main).ok);
  assert.equal(f.host.checkpoint({...f.main,revision:2,savedAt:11}).reason,'move-pending');
  assert.equal(f.offer().reason,'move-pending');assert.equal(f.host.workspace(ids.main).revision,1);
});

test('cancelled and expired offers retain source and never release file ownership',()=>{
  for(const expired of [true,false]){
    const f=fixture(),move=f.offer();
    if(expired)f.setTime(121000);else assert.equal(f.host.cancelMove(ids.main,move.moveId).status,'cancelled');
    assert.equal(f.accept(move).reason,'cancelled');assert.deepEqual(f.host.workspace(ids.main).buffers,f.main.buffers);
    assert(f.host.workspace(ids.main).revision>f.main.revision);
    assert.equal(f.host.findFile('/canonical/notes.md').workspaceId,ids.main);assert(f.offer().ok);
  }
});

test('lost accept acknowledgement is idempotent; late cancel cannot undo transfer',()=>{
  const f=fixture(),move=f.offer(),result=f.accept(move);assert(result.ok);
  const before=f.host.workspace(ids.outside);assert.deepEqual(f.accept(move,{expectedRevision:1,targetBufferId:'blank'}),result);
  assert.equal(f.host.workspace(ids.outside),before);assert.equal(f.host.cancelMove(ids.main,move.moveId).status,'committed');
  assert.equal(f.host.workspace(ids.outside),before);
});

test('third-party move inspection/cancellation and acceptance of a bound move are refused',()=>{
  const f=fixture(),move=f.host.beginMove({workspaceId:ids.main,expectedRevision:1,bufferId:'document',targetWorkspaceId:ids.outside});
  assert.equal(f.host.moveStatus(ids.third,move.moveId).reason,'forbidden');assert.equal(f.host.cancelMove(ids.outside,move.moveId).reason,'forbidden');
  assert.equal(f.host.acceptMove({workspaceId:ids.third,expectedRevision:1,targetBufferId:'x',moveId:move.moveId}).reason,'forbidden');
  assert(f.accept(move).ok);
});

test('only a selected Document can move; Prompt and wrong-mode targets never acquire submission authority',()=>{
  const f=fixture();
  assert.equal(f.host.beginMove({workspaceId:ids.main,expectedRevision:1,bufferId:'prompt'}).reason,'stale-workspace');
  assert(f.host.checkpoint({...f.main,selectedBufferId:'prompt',revision:2,savedAt:11}).ok);
  assert.equal(f.host.beginMove({workspaceId:ids.main,expectedRevision:2,bufferId:'prompt'}).reason,'not-document');
  const g=fixture();assert.equal(g.offer().status,'offered');
  assert.equal(g.host.beginMove({workspaceId:ids.outside,expectedRevision:1,bufferId:'blank',targetMode:'full'}).reason,'invalid-target');
});

test('target text, backing, or even metadata associations require explicit replacement consent',()=>{
  for(const patch of [{text:'Do not lose me'},{sourceState:{source:'file',label:'empty.md',path:'/empty.md'},baselineText:''},{metadata:{scratchpadKey:'valuable'}}]){
    const f=fixture(),entry=createStudioBuffer({id:'blank',role:'document',...patch});
    assert(f.host.checkpoint({...f.outside,revision:2,savedAt:11,buffers:[entry]}).ok);
    const move=f.offer(),before=f.host.workspace(ids.outside);assert.equal(f.accept(move).reason,'target-not-empty');
    assert.equal(f.host.workspace(ids.outside),before);assert.deepEqual(f.host.workspace(ids.main),f.main);
    assert(f.accept(move,{discardTarget:true}).ok);assert.deepEqual(f.host.workspace(ids.outside).buffers[0],f.doc);
  }
});

test('stale destination confirmation and a competing move cannot replace newer work',()=>{
  const f=fixture(),move=f.offer();assert(f.host.checkpoint({...f.outside,revision:2,savedAt:11}).ok);
  assert.equal(f.accept(move,{expectedRevision:1,discardTarget:true}).reason,'stale-workspace');
  const other=f.host.beginMove({workspaceId:ids.outside,expectedRevision:2,bufferId:'blank'});assert(other.ok);
  assert.equal(f.accept(move).reason,'move-pending');assert.equal(f.host.owner('document').workspaceId,ids.main);
});

test('failed atomic recovery commit changes neither registry nor source/destination; retry can succeed',()=>{
  let allow=false,seen;
  const f=fixture({commitMove:change=>{seen=change;return allow?{ok:true}:{ok:false,reason:'capacity',message:'No room'};}}),move=f.offer();
  assert.equal(f.accept(move).reason,'capacity');assert.deepEqual(f.host.workspace(ids.main),f.main);assert.deepEqual(f.host.workspace(ids.outside),f.outside);
  assert.equal(f.host.moveStatus(ids.main,move.moveId).status,'offered');assert.equal(seen.before.length,2);
  allow=true;assert(f.accept(move).ok);
});

test('opening/replacing another file atomically releases the old path; failed replacement releases nothing',()=>{
  const f=fixture();const occupied=workspace(ids.third,'editor-only',[createStudioBuffer({id:'occupied',role:'document',sourceState:{path:'/other.md'}})]);assert(f.host.checkpoint(occupied).ok);
  const replace=path=>({...f.main,revision:2,savedAt:11,buffers:[f.prompt,createStudioBuffer({...f.doc,sourceState:{...f.doc.sourceState,path}})]});
  assert.equal(f.host.checkpoint(replace('/other.md')).reason,'already-open');assert.equal(f.host.findFile('/canonical/notes.md').bufferId,'document');
  assert(f.host.checkpoint(replace('/new.md')).ok);assert.equal(f.host.findFile('/canonical/notes.md'),null);assert.equal(f.host.findFile('/new.md').bufferId,'document');
});

test('detached copy has new identity and no file write-back or shared external note associations',()=>{
  const f=fixture(),copy=createStudioDocumentCopy(f.doc,'copy');assert.equal(copy.text,f.doc.text);assert.equal(copy.sourceState.path,null);assert.equal(copy.diskRevision,null);
  assert.equal(copy.metadata.annotationsEnabled,false);assert.equal(copy.metadata.reviewNotesKey,null);assert.equal(copy.metadata.scratchpadKey,null);
  assert(f.host.checkpoint(workspace(ids.third,'editor-only',[copy])).ok);assert.equal(f.host.findFile('/canonical/notes.md').workspaceId,ids.main);
});

function serverFixture(options={}) {
  const f=fixture();const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p.replace('/alias/','/canonical/')},...options});
  const source=server.issue({workspaceId:ids.main,mode:'full'}).capability,target=server.issue({workspaceId:ids.outside,mode:'editor-only'}).capability;
  assert(server.write(source,null,f.main).ok);assert(server.write(target,null,f.outside).ok);
  let nonce=0;const begin=()=>server.hostingMove(source,{operation:'begin',moveId:(++nonce).toString(16).padStart(48,'d'),expectedRevision:server.read(source).revision,bufferId:'document'});
  const accept=(move,extra={})=>server.hostingMove(target,{operation:'accept',expectedRevision:server.read(target).revision,targetBufferId:'blank',moveId:move.moveId,...extra});
  return {...f,server,source,target,begin,accept};
}

test('server atomically persists both workspaces and returns only the requesting side',()=>{
  const f=serverFixture(),oldA=f.server.read(f.source),oldB=f.server.read(f.target),move=f.begin();assert(move.ok);
  const result=f.accept(move);assert(result.ok);assert.equal(result.state.workspaceId,ids.outside);assert.deepEqual(result.state.buffers[0],f.doc);
  assert.notEqual(result.revision,oldB.revision);const poll=f.server.hostingMove(f.source,{operation:'status',moveId:move.moveId});
  assert(poll.ok);assert.equal(poll.state.workspaceId,ids.main);assert.notEqual(poll.revision,oldA.revision);assert.equal(poll.state.buffers.find(b=>b.role==='document').text,'');
  assert.equal(f.server.write(f.source,oldA.revision,f.main).reason,'conflict');
  assert.equal(f.server.write(f.target,oldB.revision,f.outside).reason,'conflict');
  assert.deepEqual(f.accept(move,{expectedRevision:oldB.revision}),result);
});

test('server freezes pending source writes and cancellation permits a current revision update',()=>{
  const f=serverFixture(),before=f.server.read(f.source),move=f.begin(),changed={...f.main,revision:2,savedAt:11};
  assert(f.server.write(f.source,before.revision,f.main).ok);
  assert.equal(f.server.write(f.source,before.revision,changed).reason,'move-pending');
  const cancelled=f.server.hostingMove(f.source,{operation:'cancel',moveId:move.moveId});assert.equal(cancelled.status,'cancelled');
  assert.equal(f.server.write(f.source,before.revision,changed).reason,'conflict');
  assert(f.server.write(f.source,cancelled.revision,{...cancelled.state,revision:cancelled.state.revision+1,savedAt:cancelled.state.savedAt+1}).ok);
  assert.equal(f.accept(move).reason,'cancelled');
});

test('server rejects foreign capability, forged workspace, stale proof and wrong mode',()=>{
  const f=serverFixture();assert.equal(f.server.hostingMove('bad',{operation:'begin'}).reason,'forbidden');
  assert.equal(f.server.hostingMove(f.target,{operation:'begin',moveId:'e'.repeat(48),workspaceId:ids.main,bufferId:'document',expectedRevision:f.server.read(f.target).revision}).reason,'stale-workspace');
  assert.equal(f.server.hostingMove(f.source,{operation:'begin',moveId:'e'.repeat(48),expectedRevision:'stale',bufferId:'document'}).reason,'conflict');
  const wrong=f.server.issue({workspaceId:ids.main,mode:'editor-only'}).capability;
  assert.equal(f.server.hostingMove(wrong,{operation:'status'}).reason,'not-ready');
  assert.equal(f.server.hostingMove(f.source,{operation:'begin',moveId:'e'.repeat(48),expectedRevision:f.server.read(f.source).revision,bufferId:'document',targetWorkspaceId:{bad:'id'}}).reason,'invalid-target');
});

test('server duplicate file rejection changes neither recovery state nor existing ownership',()=>{
  const f=serverFixture(),third=f.server.issue({workspaceId:ids.third,mode:'editor-only'}).capability;
  const duplicate=createStudioBuffer({...f.doc,id:'duplicate',sourceState:{...f.doc.sourceState,path:'/alias/notes.md'}});
  assert.equal(f.server.write(third,null,workspace(ids.third,'editor-only',[duplicate])).reason,'already-open');
  assert.equal(f.server.read(third).state,null);assert.equal(f.server.hostingOwner(f.source,'/alias/notes.md').owner.workspaceId,ids.main);
});

test('hosting remains disabled without an explicit option and default expiry is unchanged',()=>{
  let time=0;const f=serverFixture({now:()=>time,ttlMs:10,hosting:undefined});
  assert.equal(f.begin().reason,'forbidden');time=11;const fresh=f.server.issue({workspaceId:ids.main,mode:'full'}).capability;
  assert.equal(f.server.read(fresh).state,null);
});

test('hosted checkpoints survive idle expiry but expired page capabilities do not',()=>{
  let time=0;const f=serverFixture({now:()=>time,ttlMs:10});time=11;
  assert.equal(f.server.read(f.source).reason,'forbidden');const fresh=f.server.issue({workspaceId:ids.main,mode:'full'}).capability;
  assert.deepEqual(f.server.read(fresh).state,f.main);assert.equal(f.server.size,1,'only the pristine idle host was reclaimed');
});

test('live view leases gate checkpoints and moves, refuse cloned tabs and fence late socket cleanup',()=>{
  const f=fixture(),server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true}});
  const pageA=server.issue({workspaceId:ids.main,mode:'full'}).capability,pageB=server.issue({workspaceId:ids.main,mode:'full'}).capability;
  const socketA={},socketB={};assert.equal(server.write(pageA,null,f.main).reason,'view-not-ready');
  assert.equal(server.bindHostingView(pageA,'editor-only',socketA).reason,'forbidden');const leaseA=server.bindHostingView(pageA,'full',socketA);assert(leaseA.ok);
  assert(server.write(pageA,null,f.main,leaseA.generation).ok);assert.deepEqual(server.activeHostingWorkspaces('full'),[ids.main]);
  assert.equal(server.bindHostingView(pageB,'full',socketB).reason,'view-already-open');
  assert.equal(server.bindHostingView(pageA,'full',socketB).reason,'view-already-open');
  assert.equal(server.hostingMove(pageB,{operation:'begin'}).reason,'view-not-ready');assert.equal(server.write(pageB,null,f.main).reason,'view-not-ready');
  assert(server.releaseHostingView(pageA,socketA).released);const leaseB=server.bindHostingView(pageB,'full',socketB);assert(leaseB.ok);
  assert.equal(server.releaseHostingView(pageA,socketA).released,false);assert.deepEqual(server.activeHostingWorkspaces('full'),[ids.main]);
  assert.equal(server.write(pageA,server.read(pageA).revision,f.main).reason,'view-not-ready');assert(server.write(pageB,server.read(pageB).revision,f.main,leaseB.generation).ok);
  server.clear();assert.deepEqual(server.activeHostingWorkspaces('full'),[]);
});

test('incoming bearer status exposes only the caller checkpoint, not source Prompt text',()=>{
  const f=serverFixture(),move=f.begin();assert(move.ok);
  const pending=f.server.hostingMove(f.target,{operation:'status',moveId:move.moveId,incoming:true});assert(pending.ok);assert.equal(pending.state,undefined);
  assert(f.server.hostingMove(f.source,{operation:'cancel',moveId:move.moveId}).ok);
  const cancelled=f.server.hostingMove(f.target,{operation:'status',moveId:move.moveId,incoming:true});assert(cancelled.ok);
  assert.equal(cancelled.state.workspaceId,ids.outside);assert.equal(JSON.stringify(cancelled).includes(f.prompt.text),false);
});

test('a retargeted file alias cannot silently rebind a draft during checkpoint or move',()=>{
  let actual='/disk/original.md';const f=fixture({canonicalPath:p=>p==='/canonical/notes.md'?actual:p});
  assert(f.host.checkWrite(ids.main,'document','/canonical/notes.md').ok);actual='/disk/replacement.md';
  assert(f.host.checkpoint({...f.main,revision:2,savedAt:11}).ok);
  assert.equal(f.host.checkWrite(ids.main,'document','/canonical/notes.md').reason,'source-changed');
  assert.equal(f.host.findFile('/disk/original.md').workspaceId,ids.main);assert.equal(f.host.findFile('/canonical/notes.md'),null);
  const move=f.offer();assert(move.ok);assert.equal(f.host.checkWrite(ids.main,'document','/disk/original.md').reason,'move-pending');
  assert(f.accept(move).ok);assert.equal(f.host.findFile('/disk/original.md').workspaceId,ids.outside);
  assert.equal(f.host.checkWrite(ids.outside,'document','/canonical/notes.md').reason,'source-changed');
  assert.equal(f.host.checkWrite(ids.main,'document','/disk/original.md').reason,'not-owner');
});

test('server save coordination rejects wrong identity and pending/transferred ownership without granting I/O',()=>{
  const f=serverFixture();assert(f.server.hostingWriteCheck(f.source,'document','/canonical/notes.md').ok);
  assert.equal(f.server.hostingWriteCheck(f.source,'prompt','/canonical/notes.md').reason,'not-file-backed');
  assert.equal(f.server.hostingWriteCheck(f.target,'document','/canonical/notes.md').reason,'not-owner');
  const move=f.begin();assert(move.ok);assert.equal(f.server.hostingWriteCheck(f.source,'document','/canonical/notes.md').reason,'move-pending');
  assert(f.accept(move).ok);assert(f.server.hostingWriteCheck(f.target,'document','/alias/notes.md').ok);
  assert.equal(f.server.hostingWriteCheck(f.source,'document','/canonical/notes.md').reason,'not-owner');
});

test('strict bounds and malformed paths fail closed without evicting current documents',()=>{
  const f=fixture({maxDocuments:3});assert(f.host.checkpoint({...f.outside,revision:2,savedAt:11,
    buffers:[createStudioBuffer({...f.outside.buffers[0],text:'Valuable draft'})]}).ok);
  assert.equal(f.accept(f.offer(),{discardTarget:true}).reason,'capacity');assert.deepEqual(f.host.workspace(ids.main),f.main);
  const g=fixture({maxMoves:0});assert.equal(g.offer().reason,'capacity');
  const h=fixture({canonicalPath:path=>{if(path==='/bad')throw Error('not canonical');return path;}});
  const bad=workspace(ids.third,'editor-only',[createStudioBuffer({id:'bad',role:'document',sourceState:{path:'/bad'}})]);
  assert.equal(h.host.checkpoint(bad).reason,'invalid-path');assert.equal(h.host.workspace(ids.third),null);
});
