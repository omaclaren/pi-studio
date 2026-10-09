import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
function fixture(replies,options={}) {
 const start=source.indexOf('      async function reuseHostedDocumentOwner('),end=source.indexOf('      function openFileBackedStudioEditorTab(',start);assert(start>=0&&end>start);
 const calls=[],opened=[],selected=[],messages=[];let current=true;
 const c=vm.createContext({documentHostingEnabled:true,studioTabStateId:'here',documentHostingGeneration:4,
  requestDocumentHosting:async body=>{calls.push(body);return typeof replies[0]==='function'?replies.shift()():replies.shift();},
  getPreviewLinkResourceQuery:(path,context)=>({path,...context}),selectStudioBuffer:id=>{selected.push(id);return true;},
  bufferRecoveryClient:{snapshot:()=>({selectedBufferId:'prompt',buffers:[{id:'prompt'},{id:'doc'}]})},
  requestStudioConfirmation:async()=>options.confirm!==false,openStudioTabDirect:url=>opened.push(url),setStatus:msg=>messages.push(msg),
  URL,window:{location:{href:'http://localhost:1234/?token=private'}},
 });vm.runInContext(source.slice(start,end),c);
 return {calls,opened,selected,messages,run:()=>c.reuseHostedDocumentOwner('/a',{}, {isCurrent:()=>current}),invalidate:()=>{current=false;}};
}
const owner={workspaceId:'there',bufferId:'doc',mode:'editor-only'};
const found=(live=true)=>({ok:true,owner,live,url:'/?mode=editor-only&workspace=there'});
test('same-host owner is selected without another tab or disk load',async()=>{
 const f=fixture([{...found(),owner:{...owner,workspaceId:'here'}}]);assert.equal((await f.run()).handled,true);assert.deepEqual(f.selected,['doc']);assert.deepEqual(f.opened,[]);assert.equal(f.calls[0].focus,false);
});
test('live other owner gets a separate identity-checked focus request, never a new tab',async()=>{
 const f=fixture([found(),found()]);assert.equal((await f.run()).handled,true);assert.equal(f.calls[1].focus,true);assert.equal(f.calls[1].expectedOwner.workspaceId,'there');assert.equal(f.calls[1].generation,4);assert.deepEqual(f.opened,[]);
});
test('focus failure is not permission to open a second editor',async()=>{
 const f=fixture([found(),{ok:false,message:'Owner changed'}]);await assert.rejects(f.run(),/Owner changed/);assert.deepEqual(f.opened,[]);
});
test('inactive owner needs explicit consent and a fresh identity check before resuming the same workspace',async()=>{
 const no=fixture([found(false)],{confirm:false});assert.equal((await no.run()).handled,true);assert.deepEqual(no.opened,[]);
 const yes=fixture([found(false),found(false)]);assert.equal((await yes.run()).handled,true);assert.equal(yes.calls.length,2);assert.match(yes.opened[0],/workspace=there/);assert.match(yes.opened[0],/resumeAcknowledged=1/);
});
test('owner becoming live during resume consent is focused, not reopened',async()=>{
 const f=fixture([found(false),found(),found()]);await f.run();assert.equal(f.calls[2].focus,true);assert.deepEqual(f.opened,[]);
});
test('changed owner or stale source consent cannot open a retained snapshot',async()=>{
 const f=fixture([found(false),{...found(false),owner:{...owner,bufferId:'replacement'}}]);await assert.rejects(f.run(),/changed/);assert.deepEqual(f.opened,[]);
 let finish;const stale=fixture([()=>new Promise(r=>{finish=r;})]);const run=stale.run();stale.invalidate();finish(found(false));assert.equal((await run).handled,true);assert.deepEqual(stale.opened,[]);
});
test('absence of an owner is explicit; a lookup error cannot fall through to independent opening',async()=>{
 const f=fixture([{ok:true,owner:null}]);assert.equal((await f.run()).handled,false);
 const bad=fixture([{ok:false,message:'unavailable'}]);await assert.rejects(bad.run(),/unavailable/);assert.deepEqual(bad.opened,[]);
});
