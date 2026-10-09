import test from 'node:test';
import assert from 'node:assert/strict';
import {createStudioBuffer} from '../shared/studio-buffer-store.js';
import {createStudioBufferServerStore} from '../shared/studio-buffer-server.js';
const id=n=>n.toString(16).padStart(48,'0');
function fixture(options={}){
 const server=createStudioBufferServerStore({...options,hosting:{requireView:true,canonicalPath:p=>p,...options.hosting}});
 const workspaceId='origin_workspace_launch_01',cap=server.issue({workspaceId,mode:'full'}).capability,handle={};let generation=server.bindHostingView(cap,'full',handle).generation;
 const p=createStudioBuffer({id:'prompt',role:'prompt',text:'Prompt work'}),d=createStudioBuffer({id:'doc',role:'document',text:'Unsaved document',resourceDir:'/old'});
 assert(server.write(cap,null,{version:2,workspaceId,mode:'full',revision:1,savedAt:1,selectedBufferId:d.id,activePromptId:p.id,order:[p.id,d.id],buffers:[p,d]},generation).ok);
 const request=(n=1,kind='blank',path='')=>({operationId:id(n),kind,path,sourcePath:'',resourceDir:'',bufferId:'doc',documentEpoch:server.read(cap).documents.doc,expectedRevision:server.read(cap).revision,generation});
 const file=path=>({ok:true,path,label:'file.md',text:'Disk text',diskRevision:'sha256:'+ 'a'.repeat(64),resourceDir:'/files'});
 return {server,cap,handle,request,file,reconnect(){server.releaseHostingView(cap,handle);generation=server.bindHostingView(cap,'full',{}).generation;return generation;}};
}
test('blank launch creates an independent pristine Document and retries exact identity',()=>{
 const f=fixture(),before=f.server.read(f.cap),r=f.request(),a=f.server.hostingLaunch(f.cap,r);
 assert(a.ok);const w=f.server.hostedWorkspace(a.workspaceId);assert.equal(w.mode,'editor-only');assert.equal(w.buffers.length,1);const d=w.buffers[0];
 assert.equal(d.text,'');assert.equal(d.baselineText,'');assert.equal(d.resourceDir,'');assert.equal(d.sourceState.path,null);assert.equal(d.sourceState.draftId,d.id);assert.equal(d.role,'document');assert.notEqual(d.id,'doc');assert.deepEqual(f.server.read(f.cap),before);
 assert.equal(f.server.hostingLaunch(f.cap,{...r,generation:f.reconnect()}).bufferId,a.bufferId);
 assert.equal(f.server.hostingLaunch(f.cap,{...r,generation:f.request().generation,kind:'file',path:'/files/a.md'},()=>f.file('/files/a.md')).reason,'invalid-request');
});
test('separate file launch intents atomically reuse one canonical owner without reloading unsaved work',()=>{
 const f=fixture();let reads=0;const load=()=>{reads++;return f.file('/files/a.md');};
 const a=f.server.hostingLaunch(f.cap,f.request(1,'file','/files/a.md'),load);assert(a.ok);
 const b=f.server.hostingLaunch(f.cap,f.request(2,'file','/files/a.md'),load);assert(b.ok);assert.equal(a.bufferId,b.bufferId);assert.equal(reads,1);
 const cap=f.server.issue({workspaceId:a.workspaceId,mode:'editor-only'}).capability,g=f.server.bindHostingView(cap,'editor-only',{}).generation,current=f.server.read(cap),next=structuredClone(current.state);next.revision++;next.savedAt++;next.buffers[0].text='New unsaved text';next.buffers[0].revision++;
 assert(f.server.write(cap,current.revision,next,g,current.documents).ok);
 assert.equal(f.server.hostingLaunch(f.cap,f.request(3,'file','/files/a.md'),load).bufferId,a.bufferId);assert.equal(f.server.hostedWorkspace(a.workspaceId).buffers[0].text,'New unsaved text');assert.equal(reads,1);
});
test('an owner arriving during a file read wins without a second identity',()=>{
 const f=fixture();let winner;const first=f.server.hostingLaunch(f.cap,f.request(1,'file','/files/a.md'),()=>{winner=f.server.hostingLaunch(f.cap,f.request(2,'file','/files/a.md'),()=>f.file('/files/a.md'));return f.file('/files/a.md');});
 assert(first.ok);assert.equal(first.bufferId,winner.bufferId);
});
test('launch requires the live source generation, epoch and checkpoint before reading',()=>{
 const f=fixture(),r=f.request(1,'file','/files/a.md');let calls=0;const load=()=>{calls++;return f.file(r.path);};
 assert.equal(f.server.hostingLaunch(f.cap,{...r,generation:0},load).ok,false);
 assert.equal(f.server.hostingLaunch(f.cap,{...r,documentEpoch:r.documentEpoch+1},load).ok,false);
 assert.equal(f.server.hostingLaunch(f.cap,{...r,expectedRevision:id(900)},load).ok,false);assert.equal(calls,0);
});
test('permission refusal and changed canonical file cannot create a hosted editor',()=>{
 const f=fixture(),r=f.request(1,'file','/files/a.md');assert.equal(f.server.hostingLaunch(f.cap,r,()=>({ok:false,reason:'grant-required',message:'Ask first'})).reason,'grant-required');
 assert.equal(f.server.hostingLaunch(f.cap,r,()=>f.file('/elsewhere/b.md')).reason,'source-changed');assert.equal(f.server.hostingOwner(f.cap,r.path).owner,null);
 assert(f.server.hostingLaunch(f.cap,r,()=>f.file(r.path)).ok);
});
test('verified hard-link aliases reuse the existing owner before any second read',()=>{
 const f=fixture({hosting:{sameFile:(a,b)=>['/files/a.md','/files/alias.md'].includes(a)&&['/files/a.md','/files/alias.md'].includes(b)}});
 const a=f.server.hostingLaunch(f.cap,f.request(1,'file','/files/a.md'),()=>f.file('/files/a.md'));assert(a.ok);
 assert.equal(f.server.hostingLaunch(f.cap,f.request(2,'file','/files/alias.md'),()=>{throw Error('must not read');}).bufferId,a.bufferId);
});
test('a reclaimed pristine target is never recreated by an old launch retry',()=>{
 const f=fixture({maxEntries:2}),request=f.request(),a=f.server.hostingLaunch(f.cap,request);assert(a.ok);
 assert(f.server.hostingLaunch(f.cap,f.request(2)).ok);assert.equal(f.server.hostedWorkspace(a.workspaceId),null);
 assert.equal(f.server.hostingLaunch(f.cap,request).reason,'launch-closed');
});
test('retired source connection and asynchronous loader cannot register a new owner',()=>{
 const f=fixture(),r=f.request(1,'file','/files/a.md');const result=f.server.hostingLaunch(f.cap,r,()=>{f.reconnect();return f.file(r.path);});assert.equal(result.reason,'lease-stale');
 assert.equal(f.server.hostingLaunch(f.cap,f.request(2,'file',r.path),async()=>f.file(r.path)).reason,'authority-required');assert.equal(f.server.hostingOwner(f.cap,r.path).owner,null);
});
test('retained successful-save paths reuse their owning Document before attachment',()=>{
 const f=fixture(),r={...f.request(90,'file','/files/saved.md'),kind:'save-as',content:'Unsaved document',expectedDiskRevision:null,overwrite:false,force:false};
 assert(f.server.hostingSave(f.cap,r,authorize=>{assert(authorize(r.path).ok);return {...f.file(r.path),text:r.content};}).ok);
 const opened=f.server.hostingLaunch(f.cap,f.request(1,'file',r.path),()=>{throw Error('pending saved file must not be independently read');});assert(opened.ok);assert.equal(opened.bufferId,'doc');assert.equal(f.server.read(f.cap).pendingSaves.length,1);
});
test('file launch keeps the language detected by the authorized loader',()=>{
 const f=fixture(),result=f.server.hostingLaunch(f.cap,f.request(1,'file','/files/code.py'),()=>({...f.file('/files/code.py'),editorLanguage:'python'}));assert(result.ok);assert.equal(f.server.hostedWorkspace(result.workspaceId).buffers[0].view.editorLanguage,'python');
});
test('capacity refusal never evicts meaningful work or consumes the launch intent',()=>{
 const f=fixture({maxEntries:1}),before=f.server.read(f.cap);assert.equal(f.server.hostingLaunch(f.cap,f.request()).reason,'capacity');assert.deepEqual(f.server.read(f.cap),before);
});
