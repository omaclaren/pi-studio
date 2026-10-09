import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioBuffer as buffer,validateStudioBufferWorkspace} from '../shared/studio-buffer-store.js';
import {createStudioDocumentHostingStore} from '../shared/studio-document-hosting.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
const main='main_'+'a'.repeat(24),tab='tab_'+'b'.repeat(24);
const nonce=n=>n.toString(16).padStart(48,'0');
const ws=(workspaceId,mode,buffers)=>validateStudioBufferWorkspace({version:2,workspaceId,mode,revision:1,savedAt:1,
 selectedBufferId:buffers.at(-1).id,activePromptId:mode==='full'?'prompt':null,order:buffers.map(b=>b.id),buffers}).state;
const initial=()=>ws(main,'full',[buffer({id:'prompt',role:'prompt',text:'keep Prompt'}),buffer({id:'doc',role:'document',text:'unsaved draft'})]);
function model(options={}){let n=0;const host=createStudioDocumentHostingStore({canonicalPath:p=>p,makeId:()=>`fresh-${++n}`,...options});assert(host.checkpoint(initial()).ok);return host;}
const begin=(host,id=nonce(1))=>host.beginMove({workspaceId:main,expectedRevision:host.workspace(main).revision,bufferId:'doc',moveId:id,targetWorkspaceId:tab});

test('early cancellation advances authority before terminal records can be reclaimed',()=>{
 let now=100;const host=model({now:()=>now,terminalLifetimeMs:10});const before=host.workspace(main);
 assert.equal(host.cancelMove(main,nonce(1)).status,'cancelled');assert(host.workspace(main).revision>before.revision);
 assert.deepEqual(host.workspace(main).buffers,before.buffers);
 now=1000;host.sweep();
 assert.equal(host.beginMove({workspaceId:main,expectedRevision:before.revision,bufferId:'doc',moveId:nonce(1)}).reason,'stale-workspace');
});
test('cancel retries do not advance authority twice; altered Begin intent is rejected',()=>{
 const host=model(),offered=begin(host);assert(offered.ok);
 assert.equal(host.beginMove({workspaceId:main,expectedRevision:1,bufferId:'prompt',moveId:nonce(1),targetWorkspaceId:tab}).reason,'invalid-move');
 const cancelled=host.cancelMove(main,nonce(1));assert(cancelled.ok);const revision=host.workspace(main).revision;
 assert.deepEqual(host.cancelMove(main,nonce(1)),cancelled);assert.equal(host.workspace(main).revision,revision);
});
test('hundreds of cancellations do not consume the lifetime move budget',()=>{
 const host=model();for(let i=1;i<=400;i++){const move=begin(host,nonce(i));assert(move.ok,JSON.stringify(move));assert(host.cancelMove(main,move.moveId).ok);}
});
test('hundreds of round trips do not retire empty placeholders forever',()=>{
 const host=model();assert(host.checkpoint(ws(tab,'editor-only',[buffer({id:'blank',role:'document'})])).ok);
 for(let i=1;i<=400;i++){
  const from=host.owner('doc').workspaceId,to=from===main?tab:main,source=host.workspace(from),target=host.workspace(to);
  const move=host.beginMove({workspaceId:from,expectedRevision:source.revision,bufferId:'doc',targetWorkspaceId:to,targetMode:target.mode,moveId:nonce(i)});assert(move.ok,JSON.stringify(move));
  const result=host.acceptMove({workspaceId:to,expectedRevision:target.revision,targetBufferId:target.buffers.find(b=>b.role==='document').id,moveId:move.moveId});assert(result.ok,JSON.stringify(result));
 }
 assert.equal(host.owner('doc').workspaceId,main);
});
test('lease incarnation fences recovery and Begin; release cancels outstanding source offer',()=>{
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true}});
 const cap=server.issue({workspaceId:main,mode:'full'}).capability,first={},second={};
 const a=server.bindHostingView(cap,'full',first);assert(a.ok&&Number.isSafeInteger(a.generation));
 assert(server.write(cap,null,initial(),a.generation).ok);const old=server.read(cap);
 assert(server.releaseHostingView(cap,first).released);const b=server.bindHostingView(cap,'full',second);assert(b.generation>a.generation);
 assert.equal(server.write(cap,old.revision,initial(),a.generation).reason,'lease-stale');
 assert.equal(server.hostingMove(cap,{operation:'begin',moveId:nonce(1),bufferId:'doc',expectedRevision:old.revision,generation:a.generation}).reason,'lease-stale');
 const move=server.hostingMove(cap,{operation:'begin',moveId:nonce(2),bufferId:'doc',expectedRevision:server.read(cap).revision,generation:b.generation});assert(move.ok);
 assert(server.releaseHostingView(cap,second).released);
 assert.equal(server.hostingMove(cap,{operation:'status',moveId:nonce(2)}).status,'cancelled');
});
test('pristine lease-less workspaces are reclaimable while valuable drafts survive',()=>{
 let time=0;const server=createStudioBufferServerStore({now:()=>time,ttlMs:10,hosting:{canonicalPath:p=>p}});
 const valuable=server.issue({workspaceId:main,mode:'full'}).capability;assert(server.write(valuable,null,initial()).ok);
 for(let i=0;i<40;i++){
  time+=20;const id='empty_'+String(i).padStart(24,'0'),cap=server.issue({workspaceId:id,mode:'editor-only'}).capability;
  assert(server.write(cap,null,ws(id,'editor-only',[buffer({id:'empty-'+i,role:'document'})])).ok);
 }
 const restored=server.issue({workspaceId:main,mode:'full'}).capability;
 assert.deepEqual(server.read(restored).state,initial());assert(server.size<=2);
});
for(const acceptFirst of [false,true])test(`destination decline is terminal in either Accept ordering (${acceptFirst})`,()=>{
 const host=model();assert(host.checkpoint(ws(tab,'editor-only',[buffer({id:'blank',role:'document'})])).ok);
 const move=begin(host),accept=()=>host.acceptMove({workspaceId:tab,expectedRevision:1,targetBufferId:'blank',moveId:move.moveId});assert(move.ok);
 if(acceptFirst)assert(accept().ok);
 const declined=host.declineMove(tab,move.moveId);assert(declined.ok);assert.equal(declined.status,acceptFirst?'committed':'cancelled');
 if(!acceptFirst){assert.equal(accept().reason,'cancelled');assert.equal(host.owner('doc').workspaceId,main);}
 else {assert.equal(host.owner('doc').workspaceId,tab);assert(host.adoptMove(tab,move.moveId,'doc').adopted);assert(host.moveStatus(main,move.moveId).adopted);}
});

test('one-step move-out creates the actual destination atomically, with no placeholder or Accept',()=>{
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p}}),cap=server.issue({workspaceId:main,mode:'full'}).capability;
 assert(server.write(cap,null,initial()).ok);const before=server.read(cap);
 const request={operation:'move-out',moveId:nonce(55),bufferId:'doc',expectedRevision:before.revision};
 const moved=server.hostingMove(cap,request);assert(moved.ok,JSON.stringify(moved));assert.equal(moved.status,'committed');
 const destination=server.hostedWorkspace(moved.targetWorkspaceId);assert.equal(destination.mode,'editor-only');assert.equal(destination.buffers.length,1);
 assert.deepEqual(destination.buffers[0],initial().buffers[1]);assert.deepEqual(moved.state.buffers[0],initial().buffers[0]);
 assert.equal(moved.state.buffers[1].text,'');assert.equal(server.size,2);
 assert.deepEqual(server.hostingMove(cap,request),moved);assert.equal(server.size,2);
 assert.equal(server.hostingMove(cap,{...request,bufferId:'prompt'}).reason,'invalid-move');
});

test('failed one-step destination allocation changes no recovery record; cancellation resumes source safely',()=>{
 const server=createStudioBufferServerStore({maxEntries:1,hosting:{canonicalPath:p=>p}}),cap=server.issue({workspaceId:main,mode:'full'}).capability;
 assert(server.write(cap,null,initial()).ok);const before=server.read(cap),moveId=nonce(66);
 assert.equal(server.hostingMove(cap,{operation:'move-out',moveId,bufferId:'doc',expectedRevision:before.revision}).reason,'capacity');
 assert.deepEqual(server.read(cap).state,before.state);assert.equal(server.size,1);
 const cancelled=server.hostingMove(cap,{operation:'cancel',moveId,expectedRevision:before.revision});assert.equal(cancelled.status,'cancelled');
 assert.notEqual(cancelled.revision,before.revision);assert.deepEqual(cancelled.state.buffers,before.state.buffers);
});

test('a late unknown cancellation cannot invalidate a newer unrelated checkpoint',()=>{
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p}}),cap=server.issue({workspaceId:main,mode:'full'}).capability;
 assert(server.write(cap,null,initial()).ok);const before=server.read(cap);
 assert(server.write(cap,before.revision,{...before.state,revision:2,savedAt:2}).ok);const current=server.read(cap);
 assert.equal(server.hostingMove(cap,{operation:'cancel',moveId:nonce(77),expectedRevision:before.revision}).reason,'conflict');
 assert.equal(server.read(cap).revision,current.revision);
});

test('document authority changes across move-out/back and source ABA; Prompt authority survives',()=>{
 const host=model();assert(host.checkpoint(ws(tab,'editor-only',[buffer({id:'blank',role:'document'})])).ok);
 const first=host.documentAuthorities(main),move=begin(host);assert(host.acceptMove({workspaceId:tab,expectedRevision:1,targetBufferId:'blank',moveId:move.moveId}).ok);
 const back=host.beginMove({workspaceId:tab,expectedRevision:host.workspace(tab).revision,bufferId:'doc',moveId:nonce(2),targetMode:'full',targetWorkspaceId:main});
 assert(host.acceptMove({workspaceId:main,expectedRevision:host.workspace(main).revision,targetBufferId:host.workspace(main).selectedBufferId,moveId:back.moveId}).ok);
 const returned=host.documentAuthorities(main);assert.equal(returned.prompt,first.prompt);assert(returned.doc>first.doc);
 assert.equal(host.checkAuthority(main,'doc',first.doc).reason,'document-stale');assert(host.checkAuthority(main,'doc',returned.doc).ok);
 const original=host.workspace(main),doc=original.buffers.find(b=>b.id==='doc');
 for(const sourceState of [{...doc.sourceState,source:'upload',label:'other'},doc.sourceState]){
  const current=host.workspace(main);assert(host.checkpoint({...current,revision:current.revision+1,savedAt:current.savedAt+1,
   buffers:current.buffers.map(b=>b.id==='doc'?buffer({...b,sourceState}):b)}).ok);
 }
 assert.equal(host.checkAuthority(main,'doc',returned.doc).reason,'document-stale');assert.equal(host.documentAuthorities(main).prompt,first.prompt);
});

test('recovery cannot use fresh CAS with a stale document generation to revert backing',()=>{
 const server=createStudioBufferServerStore({hosting:{canonicalPath:p=>p,requireView:true}}),cap=server.issue({workspaceId:main,mode:'full'}).capability;
 const lease=server.bindHostingView(cap,'full',{});assert(server.write(cap,null,initial(),lease.generation).ok);const first=server.read(cap);
 const updated={...first.state,revision:2,savedAt:2,buffers:first.state.buffers.map(b=>b.id==='doc'?buffer({...b,sourceState:{...b.sourceState,source:'upload',label:'other'}}):b)};
 assert(server.write(cap,first.revision,updated,lease.generation,first.documents).ok);const current=server.read(cap);
 assert.equal(server.write(cap,current.revision,{...first.state,revision:3,savedAt:3},lease.generation,first.documents).reason,'document-stale');
 assert.deepEqual(server.read(cap).state,current.state);
});
