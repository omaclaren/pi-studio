import test from 'node:test';
import assert from 'node:assert/strict';
import * as escrow from '../shared/studio-document-escrow.js';
import * as launch from '../shared/studio-document-launch-client.js';
import {createStudioDocumentHostController} from '../shared/studio-document-host-client.js';
const id=n=>n.toString(16).padStart(48,'0');
const request={operationId:id(1),bufferId:'source_doc',documentEpoch:3,expectedRevision:id(2)};
const receipt={ok:true,operationId:id(1),workspaceId:'destination',bufferId:'copy_doc',created:true};
function memory(){const map=new Map();return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function held(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function copyTracker(){const storage=memory(),tracker=escrow.createStudioDocumentCopyIntent(storage,'copy');assert(tracker.capture(request).ok);return {storage,tracker};}
test('verified copy retires only the pending intent and preserves a token-free destination across reload',()=>{
 const {storage,tracker}=copyTracker();assert.equal(typeof tracker.complete,'function');assert(tracker.complete({...receipt,url:'/editor?token=private'}).ok);
 assert.equal(tracker.peek().record,null);assert.equal(tracker.peek().destinations.length,1);assert.equal(tracker.peek().destinations[0].bufferId,'copy_doc');
 assert(!storage.getItem('copy').includes('private'));assert(!storage.getItem('copy').includes('url'));
 const reloaded=escrow.createStudioDocumentCopyIntent(storage,'copy');assert.equal(reloaded.peek().record,null);assert.equal(reloaded.peek().destinations[0].operationId,request.operationId);
 assert(reloaded.capture({...request,operationId:id(3)}).ok);assert.equal(reloaded.peek().destinations.length,1);
});
test('live, seen, URL and malformed/mismatched replies do not prove creation',()=>{
 for(const reply of [{ok:true,live:true,seen:true,url:'/owned'},{...receipt,operationId:id(9)},{...receipt,bufferId:''},{...receipt,workspaceId:'bad/path'},{...receipt,created:false},{...receipt,ok:false}]){
  const {tracker,storage}=copyTracker();const before=storage.getItem('copy');assert.equal(typeof tracker.complete,'function');assert.equal(tracker.complete(reply).ok,false);assert.equal(storage.getItem('copy'),before);assert.equal(tracker.peek().record.request.operationId,id(1));
 }
});
test('completion readback failure or a foreign write keeps pending identity and never clears foreign bytes',()=>{
 for(const mode of ['quota','foreign','readback']){
  const {tracker,storage}=copyTracker();const original=storage.getItem('copy');assert.equal(typeof tracker.complete,'function');
  if(mode==='quota')storage.setItem=()=>{throw Error('quota');};
  if(mode==='foreign')storage.map.set('copy','foreign');
  if(mode==='readback')storage.setItem=()=>{};
  assert.equal(tracker.complete(receipt).ok,false);assert.equal(tracker.peek().record.request.operationId,id(1));assert.equal(storage.getItem('copy'),mode==='foreign'?'foreign':original);
 }
});
test('retained destinations have bounded capacity; refusal never silently evicts an older identity',()=>{
 const {tracker}=copyTracker();assert.equal(typeof tracker.complete,'function');assert(tracker.complete(receipt).ok);
 for(let n=2;n<=32;n++){assert(tracker.capture({...request,operationId:id(n+20)}).ok);assert(tracker.complete({...receipt,operationId:id(n+20),bufferId:'copy_'+n}).ok);}
 assert.equal(tracker.peek().destinations.length,32);assert.equal(tracker.capture({...request,operationId:id(99)}).ok,false);assert.equal(tracker.peek().destinations[0].bufferId,'copy_doc');
});
test('legacy v1 pending bytes remain unchanged on a retry and are upgraded atomically on completion',()=>{
 const storage=memory();storage.map.set('copy',JSON.stringify({version:1,request}));const original=storage.getItem('copy');const c=escrow.createStudioDocumentCopyIntent(storage,'copy');assert(c.capture(request).ok);assert.equal(storage.getItem('copy'),original);assert(c.complete(receipt).ok);assert.equal(JSON.parse(storage.getItem('copy')).version,2);
});
test('clearing a pending attempt after reload preserves earlier completed destinations',()=>{
 const {storage,tracker}=copyTracker();assert(tracker.complete(receipt).ok);assert(tracker.capture({...request,operationId:id(7)}).ok);
 const reloaded=escrow.createStudioDocumentCopyIntent(storage,'copy');assert(reloaded.clear(true).ok);assert.equal(reloaded.peek().record,null);assert.equal(reloaded.peek().destinations[0].bufferId,'copy_doc');
});
test('a readback exception after completion cannot start another creation; reload restores the completed identity',()=>{
 const {storage,tracker}=copyTracker();const get=storage.getItem;let fail=false;storage.setItem=(key,value)=>{storage.map.set(key,value);fail=true;};storage.getItem=key=>{if(fail){fail=false;throw Error('readback');}return get(key);};assert.equal(tracker.complete(receipt).ok,false);assert.equal(tracker.capture({...request,operationId:id(9)}).ok,false);const reloaded=escrow.createStudioDocumentCopyIntent(storage,'copy');assert.equal(reloaded.peek().record,null);assert.equal(reloaded.peek().destinations[0].bufferId,'copy_doc');
});
function host(t){const storage=memory(),calls=[],opens=[],messages=[];let epoch=3,number=0;
 const o={workspaceId:'source',full:true,copyStorage:storage,generation:()=>1,client:()=>({hostingAuthority:()=>({ok:true,bufferId:'source_doc',documentEpoch:epoch,expectedRevision:id(2)})}),prepare:async()=>{},busy:()=>false,changed(){},capture(){},status:m=>messages.push(m),confirmCopy:async()=>true,confirmResume:async()=>true,open:(...a)=>opens.push(a)};
 o.request=async r=>{calls.push(r);if(r.operation==='copy')return {ok:true,operationId:r.operationId,created:true,workspaceId:'destination',bufferId:'copy_'+(++number),url:'/owned',live:false,seen:false};return {ok:true,owner:{workspaceId:'destination',bufferId:r.bufferId,mode:'editor-only'},url:'/owned',live:false,seen:false};};
 const c=createStudioDocumentHostController(o);t.after(()=>c.dispose());return {c,o,storage,calls,opens,messages,epoch:n=>{epoch=n;}};
}
test('two successful Copy commands are fresh creations, but Show reuses a destination without another copy RPC',async t=>{
 const f=host(t);await f.c.copy();assert.equal(f.c.copyState().record,null);f.epoch(4);await f.c.copy();const creations=f.calls.filter(r=>r.operation==='copy');assert.equal(creations.length,2);assert.notEqual(creations[0].operationId,creations[1].operationId);assert.equal(creations[1].documentEpoch,4);assert.equal(f.c.copyState().destinations.length,2);
 assert.equal(typeof f.c.openDestination,'function');await f.c.openDestination(f.c.copyState().destinations[0]);assert.equal(f.calls.filter(r=>r.operation==='copy').length,2);
});
test('lost Copy reply retains the same pending intent; completion works despite changed source proof',async t=>{
 const f=host(t),reply=f.o.request;f.o.request=async r=>{if(r.operation==='copy'){f.calls.push(r);throw Error('lost');}return reply(r);};await f.c.copy();const pending=f.c.copyState().record.request;f.epoch(19);f.o.request=reply;await f.c.copy();assert.equal(f.c.copyState().record,null);assert.equal(f.calls.filter(r=>r.operation==='copy')[1].operationId,pending.operationId);assert.equal(f.calls.filter(r=>r.operation==='copy')[1].documentEpoch,3);
});
test('popup refusal is not creation uncertainty: New becomes fresh, destination is still recheckable',async t=>{
 const storage=memory(),calls=[];const o={workspaceId:'source',storage,generation:()=>1,authority:()=>({ok:true,bufferId:'source_doc',documentEpoch:1,expectedRevision:id(2)}),prepare:async()=>{},busy:()=>false,changed(){},status(){},confirm:async()=>true,open:()=>null};
 o.request=async r=>{calls.push(r);return r.operation==='launch'?{ok:true,operationId:r.operationId,created:true,workspaceId:'target',bufferId:'new_'+calls.length,live:false,seen:false,url:'/owned'}:{ok:true,owner:{workspaceId:'target',bufferId:r.bufferId,mode:'editor-only'},live:false,seen:false,url:'/owned'};};
 const c=launch.createStudioDocumentLaunchController(o);t.after(()=>c.dispose());await c.start({kind:'blank'});assert.equal(c.state().record,null);assert.equal(c.state().destinations.length,1);assert(c.needsUnloadConfirmation());await c.start({kind:'blank'});assert.equal(calls.filter(r=>r.operation==='launch').length,2);await c.recheck();assert.equal(calls.filter(r=>r.operation==='launch').length,2);
});
function ownerOptions(){const calls=[],opened=[],notices=[];let generation=1;const o={workspaceId:'source',generation:()=>generation,current:()=>true,request:async r=>{calls.push(r);return {ok:true,owner:{workspaceId:'destination',bufferId:'draft_doc',mode:'editor-only'},live:false,seen:true,url:'/owned'};},confirm:async()=>true,open:(...a)=>opened.push(a),status:m=>notices.push(m),changed(){}};return {o,calls,opened,notices,disconnect:()=>{generation++;}};}
test('retained draft owner resume requires consent and a fresh matching owner check; no file-path or creation RPC',async()=>{
 assert.equal(typeof launch.openStudioRetainedDocument,'function');const f=ownerOptions();let asked=0;f.o.confirm=async()=>{asked++;return false;};assert.equal(await launch.openStudioRetainedDocument(f.o,'draft_doc'),false);assert.equal(f.opened.length,0);
 f.o.confirm=async()=>{asked++;return true;};assert(await launch.openStudioRetainedDocument(f.o,'draft_doc'));assert.equal(asked,2);assert.deepEqual(f.opened,[['/owned',true]]);assert(f.calls.every(r=>r.operation==='owner'&&r.bufferId==='draft_doc'&&!r.path));
});
test('late resume, changed owner, disposal and source reconnect cannot open a stale tab',async()=>{
 assert.equal(typeof launch.openStudioRetainedDocument,'function');
 for(const change of ['owner','closed','generation']){const f=ownerOptions();f.o.confirm=async()=>{if(change==='closed')f.o.current=()=>false;if(change==='generation')f.disconnect();if(change==='owner')f.o.request=async()=>({ok:true,owner:{workspaceId:'other',bufferId:'draft_doc'},url:'/other'});return true;};await launch.openStudioRetainedDocument(f.o,'draft_doc');assert.equal(f.opened.length,0,change);}
});
test('a live owner is focused and a local owner selected without spawning a second editor',async()=>{
 assert.equal(typeof launch.openStudioRetainedDocument,'function');const f=ownerOptions();f.o.request=async r=>{f.calls.push(r);return {ok:true,owner:{workspaceId:'source',bufferId:'draft_doc',mode:'full'},live:true,seen:true,url:'/source'};};let selected;f.o.selectOwner=id=>{selected=id;return true;};assert(await launch.openStudioRetainedDocument(f.o,'draft_doc'));assert.equal(selected,'draft_doc');assert.equal(f.opened.length,0);assert(f.calls.at(-1).focus);
});
test('an older live destination cannot hide a new uncertain copy attempt',async t=>{
 const f=host(t);await f.c.copy();const original=f.o.request;f.o.request=async r=>{if(r.operation==='copy'){f.calls.push(r);throw Error('unknown new copy');}return {...await original(r),live:true,seen:true};};await f.c.copy();await f.c.ready({});assert(f.c.copyState().record);assert.equal(f.c.copyState().live,false);assert.equal(f.c.copyState().destinations[0].live,true);assert(f.c.needsUnloadConfirmation());
});
test('a changed owner after a live lookup revokes positive connection proof',async()=>{
 const f=ownerOptions(),observations=[];let count=0;f.o.observed=(_id,r)=>observations.push(r.live);f.o.request=async()=>({ok:true,owner:{workspaceId:++count===1?'destination':'replacement',bufferId:'draft_doc'},live:true,seen:true,url:'/owned'});assert.equal(await launch.openStudioRetainedDocument(f.o,'draft_doc'),false);assert.equal(f.opened.length,0);assert.equal(observations.at(-1),false);
});
test('concurrent Show presses share one owner flight and open at most once',async t=>{
 const f=host(t);await f.c.copy();f.opens.length=0;const pause=held(),original=f.o.request;let heldOnce=false;f.o.request=r=>{if(r.operation==='owner'&&!heldOnce){heldOnce=true;return pause.promise;}return original(r);};const d=f.c.copyState().destinations[0],a=f.c.openDestination(d),b=f.c.openDestination(d);assert.equal(a,b);pause.resolve({ok:true,owner:{workspaceId:'destination',bufferId:d.bufferId,mode:'editor-only'},live:false,seen:false,url:'/owned'});await a;assert.equal(f.opens.length,1);
});
function observationRace(t,kind){
 const storage=memory(),calls=[],messages=[],pause=held(),started=held();let count=0,heldBuffer=null,holding=false,focusLive=false,lookupLive=true;
 const owner=(bufferId,live=true)=>({ok:true,owner:{workspaceId:'destination',bufferId,mode:'editor-only'},live,seen:true,url:'/retained'});
 const o={workspaceId:'source',full:true,storage,copyStorage:storage,generation:()=>1,current:()=>true,
  authority:()=>({ok:true,bufferId:'source_doc',documentEpoch:1,expectedRevision:id(2)}),prepare:async()=>{},busy:()=>false,
  changed(){},capture(){},status:m=>messages.push(m),confirm:async()=>true,confirmCopy:async()=>true,confirmResume:async()=>true,open(){}};
 o.client=()=>({hostingAuthority:o.authority});
 o.request=async r=>{calls.push(r);if(['copy','launch'].includes(r.operation))return {ok:true,operationId:r.operationId,created:true,workspaceId:'destination',bufferId:'destination_'+(++count)};
  if(heldBuffer){if(!r.focus&&r.bufferId===heldBuffer&&!holding){holding=true;started.resolve();return pause.promise;}if(r.focus)return owner(r.bufferId,focusLive);}
  return owner(r.bufferId,lookupLive);
 };
 const c=kind==='copy'?createStudioDocumentHostController(o):launch.createStudioDocumentLaunchController(o);t.after(()=>c.dispose());
 return {c,calls,messages,owner,pause,started,state:()=>kind==='copy'?c.copyState():c.state(),create:()=>kind==='copy'?c.copy():c.start({kind:'blank'}),hold:(bufferId,live=false)=>{heldBuffer=bufferId;focusLive=live;},lookupLive:live=>{lookupLive=live;}};
}
for(const kind of ['copy','launch']){
 test(kind+': late positive background observation cannot override newer failed focus',async t=>{
  const f=observationRace(t,kind);await f.create();const d=f.state().destinations[0];assert.equal(d.live,true);f.hold(d.bufferId);
  const background=f.c.ready({});await f.started.promise;assert.equal(await f.c.openDestination(d),false);assert.equal(f.state().destinations[0].live,false);
  f.pause.resolve(f.owner(d.bufferId,true));await background;assert.equal(f.state().destinations[0].live,false,'late positive must not hide destination uncertainty');assert.equal(f.c.needsUnloadConfirmation(),true);assert.equal(f.calls.filter(r=>['copy','launch'].includes(r.operation)).length,1);
 });
 test(kind+': late negative background observation cannot revoke newer successful focus',async t=>{
  const f=observationRace(t,kind);await f.create();const d=f.state().destinations[0];f.hold(d.bufferId,true);
  const background=f.c.ready({});await f.started.promise;assert.equal(await f.c.openDestination(d),true);assert.equal(f.state().destinations[0].live,true);
  f.pause.resolve(f.owner(d.bufferId,false));await background;assert.equal(f.state().destinations[0].live,true);assert.equal(f.c.needsUnloadConfirmation(),false);assert.equal(f.calls.filter(r=>r.operation==='owner'&&r.focus).length,2,'explicit focus is not dropped behind a silent flight');
 });
 test(kind+': fresh revalidation in an older action can supersede a newer silent lookup',async t=>{
  const f=observationRace(t,kind);await f.create();const d=f.state().destinations[0];f.hold(d.bufferId,true);
  const explicit=f.c.openDestination(d);await f.started.promise;f.lookupLive(false);await f.c.ready({});assert.equal(f.state().destinations[0].live,false);
  f.lookupLive(true);f.pause.resolve(f.owner(d.bufferId));assert.equal(await explicit,true);assert.equal(f.state().destinations[0].live,true,'order each RPC, not just action start');assert.equal(f.c.needsUnloadConfirmation(),false);
 });
 test(kind+': ordered background then failed focus remains conservative',async t=>{
  const f=observationRace(t,kind);await f.create();const d=f.state().destinations[0];f.hold(d.bufferId);
  const background=f.c.ready({});await f.started.promise;f.pause.resolve(f.owner(d.bufferId));await background;assert.equal(await f.c.openDestination(d),false);assert.equal(f.state().destinations[0].live,false);assert.equal(f.c.needsUnloadConfirmation(),true);
 });
 test(kind+': observation order is per destination, not a global request fence',async t=>{
  const f=observationRace(t,kind);await f.create();await f.create();const [a,b]=f.state().destinations;f.hold(a.bufferId);
  const background=f.c.ready({});await f.started.promise;assert.equal(await f.c.openDestination(b),false);f.pause.resolve(f.owner(a.bufferId));await background;
  assert.equal(f.state().destinations.find(d=>d.bufferId===a.bufferId).live,true);assert.equal(f.state().destinations.find(d=>d.bufferId===b.bufferId).live,false);assert.equal(f.c.needsUnloadConfirmation(),true);assert.equal(f.calls.filter(r=>['copy','launch'].includes(r.operation)).length,2);
 });
}
test('live-at-confirmation resumes through focus rather than an extra tab',async()=>{
 assert.equal(typeof launch.openStudioRetainedDocument,'function');const f=ownerOptions();let live=false;f.o.request=async r=>{f.calls.push(r);return {ok:true,owner:{workspaceId:'destination',bufferId:'draft_doc'},seen:true,live,url:'/owned'};};f.o.confirm=async()=>{live=true;return true;};assert(await launch.openStudioRetainedDocument(f.o,'draft_doc'));assert.equal(f.opened.length,0);assert.equal(f.calls.at(-1).focus,true);
});
