// Real reading/open/modal chains with deferred frame/transport fixtures.
// Reuses established fixture definitions without registering their tests; not a browser test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source=fs.readFileSync(join(repo,'client/studio-client.js'),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
function load(c,start,end){vm.runInContext(section(source,start,end),c);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
const payload={text:'new document',path:'/outside/next.md',label:'next.md',resourceDir:'/outside'};
const grantError=()=>Object.assign(new Error('Grant required'),{studioPayload:{code:'studio-resource-grant-required',path:payload.path,directoryPath:'/outside',label:payload.label}});
const helpers=vm.createContext({assert,vm,load,tick,deferred,payload,grantError,URLSearchParams,context:values=>vm.createContext({studioRunFollowingAvailable:()=>false,getStudioRunWorkingOwner:()=>null,pauseStudioRunFollowing(){},...values}),section,source}); // run-following defaults, as in the newer suites
Object.assign(helpers,{helpers,setTimeout});
const fixtureFiles=['test/studio-buffer-open-grant.test.js','test/studio-buffer-open-lifecycle.test.js','test/studio-buffer-switching-ui.test.js'];
const fixtures=fixtureFiles.map(n=>fs.readFileSync(join(repo,n),'utf8'));
vm.runInContext(section(fixtures[0],'function fixture()','const retirements ='),helpers);
vm.runInContext(section(fixtures[1],'function openFixture()','test(\'control: current grant'),helpers);
vm.runInContext(section(fixtures[2],'function bindingHarness(', 'test("returning to a following Prompt'),helpers);
vm.runInContext(section(fixtures[2],'function historyBindingHarness(', 'const shiftedHistory ='),helpers);
vm.runInContext(section(fixtures[2],'function traceReadingHarness(', 'for (const variant of ["same"'),helpers);
function reading(rightView='trace'){
 const f=helpers.traceReadingHarness(29,rightView),c=f.c,frames=[];
 const pane=()=>({scrollTop:480,scrollLeft:0,isConnected:true,classList:{add(){},remove(){}}});
 Object.assign(c,{rightView:'editor-preview',pendingResponseScrollReset:false,responsePreviewRenderNonce:0,critiqueViewEl:pane(),window:{requestAnimationFrame:fn=>frames.push(fn)},
  captureEditorAsyncConsent:()=>({}),editorAsyncConsentIsCurrent:()=>true,normalizeHistoryKind:k=>k||'direct',normalizeForCompare:s=>String(s||''),
  isStructuredCritique:()=>false,updateResultActionButtons(){},setStatus(){},
  replaceResponsePaneWithClone:()=>c.critiqueViewEl,
  refreshResponseUi:()=>{c.responsePreviewRenderNonce++;return c.rightView==='trace'?false:c.applyPendingResponseScrollReset();},setRightView:v=>{c.rightView=v;c.refreshResponseUi();}});
 load(c,'function applyPendingResponseScrollReset()', 'async function getMermaidApi()');
 load(c,'function handleIncomingResponse(', 'function sendMessage(');
 load(c,'function clearActiveResponseView(', 'function updateHistoryControls()');
 load(c,'function applySelectedHistoryItem(', 'function setResponseHistory(');
 const flush=()=>{while(frames.length){const pending=frames.splice(0);for(const fn of pending)fn();}};
 return{...f,frames,flush,finishBinding(){f.returnToPrompt();c.critiqueViewEl.scrollTop=c.bufferViewRestore.right;flush();},
  response(){c.setRightView('preview');flush();return c.critiqueViewEl.scrollTop;},
  state:()=>({mode:c.traceDisplayContext.mode,traceRun:c.traceState?.runId,scroll:c.critiqueViewEl.scrollTop,restore:c.bufferViewRestore?.right,pending:c.pendingResponseScrollReset,saved:structuredClone(c.bufferTransientStates.get('prompt'))})};
}
test('control: retired response resets when Response is the saved view',()=>{
 const f=reading('preview');f.deliver([{id:'new',markdown:'New'}]);f.finishBinding();assert.equal(f.c.critiqueViewEl.scrollTop,0);
});
test('control: unchanged trace/history restores its offset',()=>{
 const f=reading();f.finishBinding();assert.equal(f.c.critiqueViewEl.scrollTop,480);assert.equal(f.c.traceState.runId,'run-1');
});
for(const view of ['trace','editor-preview','editor-quarto-preview','side-questions'])test('REGRESSION: response retirement survives restoration of '+view,()=>{
 const f=reading(view);f.deliver([{id:'new',markdown:'New'}]);f.finishBinding();assert.equal(f.c.critiqueViewEl.scrollTop,480,'independent reading is retained before response selection');const responseScroll=f.response();
 assert.equal(responseScroll,0,'later response selection must consume its own retirement');
});
test('control: empty history with already-live context retains live trace and scroll',()=>{
 const f=reading();f.deliver([]);f.finishBinding();assert.equal(f.c.traceState.runId,'run-1');assert.equal(f.c.critiqueViewEl.scrollTop,480);
});
test('control: Document history browsing with nonempty history resolves Prompt live owner',()=>{
 const f=reading();f.c.selectHistoryIndex(9,{silent:true});assert.equal(f.c.traceDisplayContext.mode,'history');f.finishBinding();
 assert.equal(f.c.traceState.runId,'run-1');assert.equal(f.c.critiqueViewEl.scrollTop,480);
});
test('REGRESSION: empty history resolves Prompt trace after Document-side browsing',()=>{
 const f=reading();f.c.selectHistoryIndex(9,{silent:true});assert.equal(f.c.traceState.runId,'r10');f.deliver([]);f.finishBinding();
 assert.equal(f.c.traceState.runId,'run-1','no-item resolver must restore unchanged live trace, not Document historical owner');assert.equal(f.c.critiqueViewEl.scrollTop,480);
});
function appendFixture(){
 const f=helpers.openFixture(),c=f.c,d=c.bufferRecoveryClient.snapshot().buffers[0],button={disabled:false,title:''};d.text='unsaved document';c.sourceTextEl.value=d.text;
 Object.assign(c,{bufferSwitcherUi:{addDocument:button,documentInfo:{textContent:''}},getStudioSelectedBuffer:()=>d,isStudioDocumentBufferView:()=>true,
  pendingStudioBufferEditorView:()=>null,pendingPiEditorLoad:null,pendingPiEditorLink:null,pendingPiEditorClear:null,pendingTerminalDocument:null,activeFileImport:null,
  ws:{readyState:1},WebSocket:{OPEN:1},wsState:'Ready',agentBusyFromServer:false,shortcutsOverlayEl:{hidden:true},shortcutsBtn:null,
  isReviewNotesOpen:()=>false,isOutlineOpen:()=>false});
 c.bufferRecoveryClient.documentAppendInfo=()=>({ok:true,addedCharacters:30,availableCharacters:1000});
 load(c,'function isShortcutsOpen()', 'function handleShortcutsScrollShortcut(');
 load(c,'function closeShortcuts(', 'function closeScratchpad(');
 load(c,'function studioDocumentAppendAvailability(', 'function captureStudioDocumentAppend(');
 load(c,'function syncStudioDocumentAppendAction()', 'function setupStudioDocumentAppendAction(');
 c.syncStudioDocumentAppendAction();assert.equal(button.disabled,false);
 return{...f,button,async start(){
  const result=c.openStudioBufferDocument('/outside/next.md',f.context).then(value=>({value}),error=>({error}));
  await tick();assert.equal(f.titles.at(-1),'Replace Document?');c.finishStudioDecision(true,false);await tick();assert.equal(f.requests.length,1);return{result};
 },modal(){c.openShortcuts();c.closeShortcuts();},state:()=>({disabled:button.disabled,available:c.studioDocumentAppendAvailability().ok,retired:c.pendingBufferDocumentOpen===null})};
}
test('control: Shortcuts without pending read keeps whole-document append enabled',()=>{
 const f=appendFixture();f.modal();assert.equal(f.button.disabled,false);
});
test('control: current read disables then re-enables whole-document append on settlement',async()=>{
 const f=appendFixture(),{result}=await f.start();assert.equal(f.button.disabled,true);f.requests[0].resolve(payload);const out=await result;
 assert.equal(out.value,true);assert.equal(f.button.disabled,false);
});
test('REGRESSION: modal-retired open refreshes append before old read settles',async()=>{
 const f=appendFixture(),{result}=await f.start();assert.equal(f.button.disabled,true);f.modal();const afterClose=f.state();
 // Always settle old implementations before assertions, so red evidence is not a dangling promise.
 f.requests[0].resolve(payload);const out=await result;
 assert.equal(afterClose.retired,true,'modal must retire the older operation');assert.equal(afterClose.available,true);assert.equal(afterClose.disabled,false,'underlying available action must refresh immediately');
 assert.equal(out.value,false);assert.equal(f.replacements.length,0);
});

for(const view of ['trace','editor-preview','editor-quarto-preview','side-questions'])test('deferred response reset survives another '+view+' round trip and is consumed once',()=>{
 const f=reading(view);f.deliver([{id:'new',markdown:'New'}]);f.finishBinding();
 assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,true);
 f.c.captureStudioBufferTransientState();f.c.isStudioDocumentBufferView=()=>true;f.c.rightView='editor-preview';f.finishBinding();
 assert.equal(f.c.critiqueViewEl.scrollTop,480);assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,true);
 assert.equal(f.response(),0);assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,false);
 f.c.critiqueViewEl.scrollTop=f.entry.view.rightScrollTop=125;f.entry.view.rightView='preview';f.c.captureStudioBufferTransientState();
 f.c.isStudioDocumentBufferView=()=>true;f.c.rightView='editor-preview';f.finishBinding();assert.equal(f.c.critiqueViewEl.scrollTop,125);
});
test('Response Markdown also consumes deferred retirement',()=>{
 const f=reading();f.deliver([{id:'new',markdown:'New'}]);f.finishBinding();f.c.setRightView('markdown');f.flush();
 assert.equal(f.c.critiqueViewEl.scrollTop,0);assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,false);
});
test('unrendered response retirement survives a temporarily absent pane',()=>{
 const f=reading();f.deliver([{id:'new',markdown:'New'}]);f.finishBinding();const pane=f.c.critiqueViewEl;
 f.c.rightView='preview';f.c.critiqueViewEl=null;assert.equal(f.c.applyPendingResponseScrollReset(),false);
 assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,true);
 f.c.critiqueViewEl=pane;f.c.refreshResponseUi();f.flush();assert.equal(pane.scrollTop,0);
});
test('Document rendering cannot consume a Prompt response retirement',()=>{
 const f=reading();f.deliver([{id:'new',markdown:'New'}]);f.finishBinding();f.c.isStudioDocumentBufferView=()=>true;
 f.c.rightView='editor-preview';f.c.pendingResponseScrollReset=true;assert.equal(f.c.applyPendingResponseScrollReset(),false);
 assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,true);
});
for(const view of ['trace','repl','markdown'])test('deferred response reset frames cannot move a later '+view+' view',()=>{
 const f=reading('preview');f.deliver([{id:'new',markdown:'New'}]);f.returnToPrompt();assert(f.frames.length>0);
 f.c.setRightView(view);f.c.critiqueViewEl.scrollTop=325;f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,325);
});
test('response-to-trace-to-response ABA retires old reset frames',()=>{
 const f=reading('preview');f.deliver([{id:'new',markdown:'New'}]);f.returnToPrompt();assert(f.frames.length>0);
 f.c.setRightView('trace');f.c.setRightView('preview');f.c.critiqueViewEl.scrollTop=225;f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,225);
});
test('trace-only owner change does not defer an unrelated response reset',()=>{
 const f=reading();f.c.liveTraceState={runId:'new-run',requestId:'new-request'};f.finishBinding();assert.equal(f.c.critiqueViewEl.scrollTop,0);
 assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,false);assert.equal(f.c.pendingResponseScrollReset,false);
 f.c.critiqueViewEl.scrollTop=125;assert.equal(f.response(),125);
});
for(const mode of ['loading','missing'])test('empty history resolves live trace after Document '+mode+' context',()=>{
 const f=reading();if(mode==='loading')f.c.traceSnapshotCache.delete('r10');else f.c.responseHistory[9].traceSummary=null;
 f.c.selectHistoryIndex(9,{silent:true});assert.equal(f.c.traceDisplayContext.mode,mode);f.deliver([]);f.finishBinding();
 assert.equal(f.c.traceState.runId,'run-1');assert.equal(f.c.critiqueViewEl.scrollTop,480);
});
test('empty then restored history also resolves the Prompt trace after Document browsing',()=>{
 const f=reading(),items=f.c.responseHistory.slice();f.c.selectHistoryIndex(9,{silent:true});f.deliver([]);f.deliver(items);f.finishBinding();
 assert.equal(f.c.traceState.runId,'run-1');assert.equal(f.c.critiqueViewEl.scrollTop,480);assert.equal(f.response(),0);
});
test('queued payload without history resolves trace and preserves a deferred response reset',()=>{
 const f=reading();f.entry.view.followLatest=true;f.c.queuedLatestResponse={kind:'direct',markdown:'Queued payload',timestamp:1000};
 f.c.selectHistoryIndex(9,{silent:true});f.deliver([]);f.finishBinding();assert.equal(f.c.queuedLatestResponse,null);
 assert.equal(f.c.traceState.runId,'run-1');assert.equal(f.c.critiqueViewEl.scrollTop,480);assert.equal(f.response(),0);assert.equal(f.c.latestResponseMarkdown,'Queued payload');
});
test('default response reset does not acquire or consume buffer-local state',()=>{
 const f=reading('preview');f.c.bufferSwitchingEnabled=false;f.c.isStudioDocumentBufferView=()=>false;
 f.c.getStudioSelectedBuffer=()=>{throw new Error('Default mode must not inspect buffer ownership');};
 f.c.rightView='preview';f.c.pendingResponseScrollReset=true;assert.equal(f.c.applyPendingResponseScrollReset(),true);
 f.c.rightView='trace';f.c.responsePreviewRenderNonce++;f.c.critiqueViewEl.scrollTop=125;f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,0,'legacy non-buffer reset semantics retained');
});
for(const modal of ['scratchpad','quiz','pdf','html','image','recovery'])test(modal+' retirement refreshes whole-document append before settlement',async()=>{
 const f=appendFixture(),{result}=await f.start();f.c.modalFlags[modal]=true;f.c.syncStudioBufferOpenOperation();
 assert.equal(f.c.studioBuffersCanAddDocument(),false,'execution still refuses behind an open modal');
 f.c.modalFlags[modal]=false;const afterClose=f.state();f.requests[0].resolve(payload);const out=await result;
 assert.deepEqual(afterClose,{disabled:false,available:true,retired:true});assert.equal(out.value,false);assert.equal(f.replacements.length,0);
});
test('an unrelated decision refreshes retired-open append controls without reviving execution',async()=>{
 const f=appendFixture(),{result}=await f.start();const decision=f.c.requestStudioConfirmation('Newer decision',{title:'Other?'});await tick();
 assert.equal(f.c.studioBuffersCanAddDocument(),false);assert.equal(f.button.disabled,false,'underlying control is current even while execution is modal-fenced');
 f.c.finishStudioDecision(false,false);await decision;const afterClose=f.state();f.requests[0].resolve(payload);const out=await result;
 assert.deepEqual(afterClose,{disabled:false,available:true,retired:true});assert.equal(out.value,false);assert.equal(f.replacements.length,0);
});
