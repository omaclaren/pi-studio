import test from 'node:test';import assert from 'node:assert/strict';
import {createStudioDocumentLaunchController} from '../shared/studio-document-launch-client.js';
const id=n=>n.toString(16).padStart(48,'0');const key='piStudio.bufferWorkspace.v2:origin:launch';
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const reply=(r,facts={})=>r.operation==='launch'?{ok:true,operationId:r.operationId,created:true,bufferId:'created',workspaceId:'target',url:'/owned',live:false,seen:false,...facts}:{ok:true,owner:{bufferId:r.bufferId,workspaceId:'target',mode:'editor-only'},url:'/owned',live:false,seen:false,...facts};
function fixture(t,overrides={}){let generation=1;const map=new Map(),requests=[],opened=[],messages=[];const options={workspaceId:'origin',storage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},generation:()=>generation,prepare:async()=>{},authority:()=>({ok:true,bufferId:'doc',documentEpoch:1,expectedRevision:id(1)}),busy:()=>false,changed(){},status:m=>messages.push(m),request:async r=>{requests.push(r);return reply(r);},open:(...args)=>opened.push(args),confirm:async()=>true,...overrides};const c=createStudioDocumentLaunchController(options);t.after(()=>c.dispose());return {c,options,map,requests,opened,messages,reconnect:()=>{generation++;}};}
test('lost reply persists original intent; reload/reconnect reuses it rather than current proof',async t=>{
 const f=fixture(t);f.options.request=async r=>{f.requests.push(r);throw Error('lost response');};await f.c.start({kind:'blank'});assert(f.c.needsUnloadConfirmation());const saved=JSON.parse(f.map.get(key));assert.equal(f.opened.length,0);
 f.c.dispose();f.reconnect();const other=fixture(t,{storage:f.options.storage,generation:()=>2,authority:()=>{throw Error('must not borrow new source');}});await other.c.recheck();assert.equal(other.requests[0].operationId,saved.request.operationId);assert.equal(other.requests[0].documentEpoch,1);assert.equal(other.requests[0].generation,2);assert.equal(other.opened.length,1);assert.equal(other.c.state().record,null);
});
test('concurrent presses share one creation; popup refusal keeps destination for identity-only recheck',async t=>{
 const held=pause();const f=fixture(t,{prepare:()=>held.promise,open(){return null;}});const a=f.c.start({kind:'blank'}),b=f.c.start({kind:'blank'});assert.equal(a,b);held.resolve();await a;assert.equal(f.requests.filter(r=>r.operation==='launch').length,1);assert(f.c.needsUnloadConfirmation());assert.equal(f.c.state().record,null);await f.c.recheck();assert.equal(f.requests.filter(r=>r.operation==='launch').length,1);assert.equal(f.c.state().destinations.length,1);
});
test('quota/corrupt/foreign tracking prevents creation dispatch and preserves stored bytes',async t=>{
 const f=fixture(t);f.options.storage.setItem=()=>{throw Error('quota');};await f.c.start({kind:'blank'});assert.equal(f.requests.length,0);
 const g=fixture(t);g.map.set(key,'{broken');await g.c.start({kind:'blank'});assert.equal(g.requests.length,0);assert.equal(g.map.get(key),'{broken');assert(g.c.needsUnloadConfirmation());
 const h=fixture(t);await h.c.start({kind:'blank'});h.map.set(key,'foreign');await h.c.start({kind:'blank'});assert.equal(h.requests.filter(r=>r.operation==='launch').length,1);assert.equal(h.map.get(key),'foreign');
});
test('live owner reuse does not open; a disconnected owner needs consent and a fresh identity check',async t=>{
 let live=true;const f=fixture(t,{request:async r=>reply(r,{seen:true,live})});await f.c.start({kind:'blank'});assert.equal(f.opened.length,0);assert.equal(f.c.needsUnloadConfirmation(),false);
 live=false;f.options.confirm=async()=>false;await f.c.recheck();assert.equal(f.opened.length,0);assert(f.c.needsUnloadConfirmation());
 f.options.confirm=async()=>{live=true;return true;};await f.c.recheck();assert.equal(f.opened.length,0);assert.equal(f.c.state().live,true);
});
test('Forget is explicit pending removal, not destination deletion or mutation of a foreign record',async t=>{
 const f=fixture(t);f.options.request=async r=>{f.requests.push(r);throw Error('unknown creation');};await f.c.start({kind:'blank'});f.options.confirm=async()=>false;assert.equal(await f.c.forget(),false);assert(f.map.has(key));
 f.options.confirm=async()=>true;assert(await f.c.forget());assert.equal(f.requests.length,1);assert.equal(f.map.has(key),false);await f.c.start({kind:'blank'});assert.notEqual(f.requests[0].operationId,f.requests[1].operationId);
});
test('disposal during preparation prevents persistence, RPC and opening',async t=>{
 const held=pause(),f=fixture(t,{prepare:()=>held.promise});const task=f.c.start({kind:'blank'});f.c.dispose();held.resolve();await task;assert.equal(f.requests.length,0);assert.equal(f.opened.length,0);assert.equal(f.map.size,0);
});
test('a failed identity-only recheck revokes earlier live confirmation',async t=>{
 const f=fixture(t,{request:async r=>reply(r,{live:true,seen:true})});await f.c.start({kind:'blank'});assert.equal(f.c.needsUnloadConfirmation(),false);f.options.request=async()=>{throw Error('offline');};await f.c.recheck();assert.equal(f.c.needsUnloadConfirmation(),true);
});
test('another target never silently replaces an unresolved request',async t=>{
 const f=fixture(t);f.options.request=async r=>{f.requests.push(r);throw Error('unknown');};await f.c.start({kind:'blank'});await f.c.start({kind:'file',path:'/another.md'});assert.equal(f.requests.length,1);assert.match(f.messages.at(-1),/different editor request/);
});
