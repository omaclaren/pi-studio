// Real open/activity/decision chains, with deferred transport and DOM effects.
// Reuses the existing grant fixture without registering its tests. Not a browser test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {dirname,join,resolve} from 'node:path';
const repo=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source=fs.readFileSync(join(repo,'client/studio-client.js'),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
function load(c,start,end){vm.runInContext(section(source,start,end),c);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
const tick=()=>new Promise(r=>setImmediate(r));
const payload={text:'new document',path:'/outside/next.md',label:'next.md',resourceDir:'/outside'};
const grantError=()=>Object.assign(new Error('Grant required'),{studioPayload:{code:'studio-resource-grant-required',path:payload.path,directoryPath:'/outside',label:payload.label}});
const helpers=vm.createContext({assert,vm,load,tick,deferred,payload,grantError,URLSearchParams,context:values=>vm.createContext(values)});
const grantTest=fs.readFileSync(join(repo,'test/studio-buffer-open-grant.test.js'),'utf8');
vm.runInContext(section(grantTest,'function fixture()','const retirements ='),helpers);
function openFixture(){
 const f=helpers.fixture(),c=f.c,sent=[],titles=[];
 const element=()=>({hidden:false,value:'',textContent:'',disabled:false,classList:{add(){},remove(){},toggle(){}},setAttribute(){},focus(){},select(){}});
 Object.assign(c,{bufferSwitchingEnabled:true,workspacePersistenceReady:true,bufferBindingInProgress:false,bufferRecoveryInitializing:false,bufferPageClosed:false,
  pendingKind:null,replBusy:false,completionSuggestionInFlight:false,pendingEditorRefresh:null,responseReplacementPending:false,pendingSaveOperations:new Map(),pendingPiEditorDraftSnapshots:new Map(),
  studioDecisionState:null,bufferRecoveryPanel:{isOpen:()=>Boolean(c.modalFlags.recovery)},modalFlags:{},
  isScratchpadOpen:()=>Boolean(c.modalFlags.scratchpad),isShortcutsOpen:()=>Boolean(c.modalFlags.shortcuts),isQuizOpen:()=>Boolean(c.modalFlags.quiz),
  isStudioPdfFocusOpen:()=>Boolean(c.modalFlags.pdf),isStudioHtmlFocusOpen:()=>Boolean(c.modalFlags.html),isStudioImageFocusOpen:()=>Boolean(c.modalFlags.image),studioDecisionOverlayEl:{hidden:true},studioDecisionDialogEl:element(),
  studioDecisionTitleEl:element(),studioDecisionMessageEl:element(),studioDecisionInputEl:element(),studioDecisionCancelBtn:element(),studioDecisionConfirmBtn:element(),
  studioDecisionSecondaryBtn:element(),studioDecisionTertiaryBtn:element(),ensureStudioDecisionDialog(){},document:{activeElement:null,body:{classList:{add(){},remove(){},toggle(){}}}},
  HTMLElement:class {},window:{requestAnimationFrame(){},setTimeout},
  sourceTextEl:{value:'Nonempty Prompt',selectionStart:0,selectionEnd:0,selectionDirection:'none',scrollTop:0},sourcePreviewEl:{scrollTop:0},
  editorLanguage:'markdown',editorView:'markdown',rightView:'preview',followLatest:false,responseHistoryIndex:-1,fileBackedDiskRevision:null,annotationsEnabled:false,
  scratchpadEditGeneration:0,scratchpadAssociationGeneration:0,scratchpadActionGeneration:0,reviewNotesEditGeneration:0,reviewNotesAssociationGeneration:0,reviewNotesActionGeneration:0,
  bufferConnectionGeneration:1,captureEditorConsent:()=>({generation:c.generation,text:c.sourceTextEl.value}),editorConsentIsCurrent:o=>o.generation===c.generation&&o.text===c.sourceTextEl.value,
  getCurrentResourceDirValue:()=>'/project',isEditorOnlyMode:false,sourceState:{path:'/prompt.md',label:'Prompt'},
  completionSuggestionRequestId:null,completionSuggestionState:null,completionSuggestionPendingSnapshot:null,completionSuggestionRefocusEditorOnResult:false,
  getCompletionSuggestionContextText:()=>'',getCompletionSuggestionModelSelection:()=>null,makeRequestId:()=> 'synthetic-suggestion',
  shouldRefocusEditorForCompletionRequest:()=>false,hideCompletionSuggestion(){},syncActionButtons(){},completionSuggestionContextMode:'cursor',
  captureEditorAsyncConsent:()=>({generation:c.generation}),editorAsyncConsentIsCurrent:o=>o.generation===c.generation,
  sendMessage:m=>{sent.push(m);return true;},
 });
 Object.defineProperty(c.studioDecisionTitleEl,'textContent',{get:()=>titles.at(-1)||'',set:value=>titles.push(value)});
 load(c,'function studioModalBlocksDraftAction(', 'function triggerLoadResponseShortcut(');
 // Execute the real status-sync entry before unrelated button rendering.
 vm.runInContext(section(source,'function syncActionButtons()', 'const canRefreshFromDisk =')+'}',c);
 load(c,'function syncModalOpenState()', 'function describeStudioDocument(');
 load(c,'function studioBuffersCanSwitch(', 'function studioBufferScrollPosition(');
 load(c,'function captureBufferRecoveryInitializationOwner()', 'function recoveryCanChangeWorkspace()');
 load(c,'function captureStudioBufferOpenConsent()', 'async function promptStudioBufferDocumentPath()');
 load(c,'function finishStudioDecision(', 'function getStudioDecisionFocusableElements()');
 load(c,'function openStudioDecision(', 'async function requestStudioTextInput(');
 load(c,'function cancelCompletionSuggestion()', 'function requestCompletionSuggestion(');
 load(c,'async function clearStudioWorkspace()', 'function setEditorText(');
 load(c,'function requestCompletionSuggestion(', 'function insertCompletionSuggestion()');
 load(c,'function handleCompletionSuggestionServerMessage(', 'function getSourceTextLineEditBounds(');
 return{...f,sent,titles,
  startSuggestion(){c.requestCompletionSuggestion();assert.equal(c.completionSuggestionInFlight,true);assert.equal(sent.at(-1).type,'completion_suggestion_request');},
  failSuggestion(){c.handleCompletionSuggestionServerMessage({type:'completion_suggestion_error',requestId:sent.at(-1).requestId,message:'synthetic failure'});assert.equal(c.completionSuggestionInFlight,false);},
  async settle(approve=false){if(c.studioDecisionState)c.finishStudioDecision(approve,false);await tick();if(f.requests[1])f.requests[1].resolve({message:'Allowed file'});await tick();if(f.requests[2])f.requests[2].resolve(payload);await tick();}
 };
}

test('control: current grant keeps source query and completes after explicit own decision',async()=>{
 const f=openFixture(),{result}=await f.start();f.requests[0].reject(grantError());await tick();assert.equal(f.titles.at(-1),'Allow next.md?');
 await f.settle(true);const out=await result;assert.equal(out.value,true);assert.equal(f.replacements.length,1);
 for(const i of [0,2])assert.deepEqual({...f.requests[i].options.query},{path:payload.path,sourcePath:'/prompt.md',resourceDir:'/project',action:'document'});
 assert.equal(f.requests.length,3);
});
test('control: active suggestion fences a late grant-required response',async()=>{
 const f=openFixture(),{result}=await f.start();f.startSuggestion();f.requests[0].reject(grantError());await tick();const shown=f.titles.length;
 await f.settle(false);const out=await result;f.failSuggestion();
 assert.equal(shown,0);assert.equal(f.replacements.length,0);assert.equal(out.value,false);
});
test('REGRESSION: suggestion start then failure must not revive the older open',async()=>{
 const f=openFixture(),{result}=await f.start(),consent=f.c.captureRecoveryConsent();f.startSuggestion();f.failSuggestion();
 assert(f.c.recoveryConsentIsCurrent(consent),'Real captured workspace fields are equal again');
 f.requests[0].reject(grantError());await tick();const shown=f.titles.length;await f.settle(true);const out=await result;
 assert.equal(shown,0,'completed intervening suggestion must permanently retire old open permission');
 assert.equal(out.value,false);assert.equal(f.requests.length,1);assert.equal(f.replacements.length,0);
});
for (const end of ['failed send', 'cancelled send']) {
 test(`a suggestion ${end} cannot restore old open authority`, async()=>{
  const f=openFixture(),{result}=await f.start();
  if(end==='cancelled send') f.startSuggestion();
  f.c.sendMessage=()=>false;
  if(end==='failed send') f.c.requestCompletionSuggestion(); else f.c.cancelCompletionSuggestion();
  assert.equal(f.c.completionSuggestionInFlight,false);
  f.requests[0].reject(grantError());await tick();const shown=f.titles.length;
  await f.settle(false);await result;assert.equal(shown,0);assert.equal(f.requests.length,1);
 });
}

for(const flag of ['uiBusy','replBusy','pendingEditorRefresh','responseReplacementPending','bufferRecoveryInitializing','bufferPageClosed']) {
 test(`status synchronization permanently retires opens across ${flag} ABA`,async()=>{
  const f=openFixture(),{result}=await f.start(),before=f.c[flag];
  f.c[flag]=true;f.c.syncActionButtons();f.c[flag]=before;f.c.syncActionButtons();
  f.requests[0].reject(grantError());await tick();const shown=f.titles.length;
  await f.settle(false);assert.equal((await result).value,false);assert.equal(shown,0);
 });
}
for(const field of ['pendingSaveOperations','pendingPiEditorDraftSnapshots']) {
 test(`status synchronization retires opens across ${field} insertion/deletion`,async()=>{
  const f=openFixture(),{result}=await f.start();
  f.c[field].set('operation',{});f.c.syncActionButtons();f.c[field].clear();f.c.syncActionButtons();
  f.requests[0].reject(grantError());await tick();const shown=f.titles.length;
  await f.settle(false);await result;assert.equal(shown,0);
 });
}

for(const modal of ['scratchpad','shortcuts','quiz','pdf','html','image','recovery']) {
 test(`own grant decision never exempts a concurrent ${modal} modal`,async()=>{
  const f=openFixture(),{result}=await f.start();f.requests[0].reject(grantError());await tick();
  f.c.modalFlags[modal]=true;f.c.syncActionButtons();f.c.modalFlags[modal]=false;
  await f.settle(true);assert.equal((await result).value,false);assert.equal(f.requests.length,1);
 });
}
for(const modal of ['scratchpad','shortcuts']) {
 test(`${modal} modal-open synchronization retires old opens even after closure`,async()=>{
  const f=openFixture(),{result}=await f.start();f.c.modalFlags[modal]=true;f.c.syncModalOpenState();
  f.c.modalFlags[modal]=false;f.c.syncModalOpenState();f.requests[0].reject(grantError());await tick();
  const shown=f.titles.length;await f.settle(false);await result;assert.equal(shown,0);
 });
}

test('opening recovery retires an older read before its async panel work finishes',async()=>{
 const f=openFixture(),{result}=await f.start(),ready=deferred();
 f.c.bufferRecoveryPanel.open=()=>{f.c.modalFlags.recovery=true;return ready.promise;};
 load(f.c,'async function openBufferRecoveryPanel()', 'async function clearStudioWorkspace()');
 const opening=f.c.openBufferRecoveryPanel();f.c.modalFlags.recovery=false;ready.resolve();await opening;
 f.requests[0].reject(grantError());await tick();const shown=f.titles.length;
 await f.settle(false);await result;assert.equal(shown,0);
});

for(const [start,end,shown] of [
 ['function openStudioHtmlFocusViewer(', 'function closeStudioHtmlFocusViewer(', 'studioHtmlFocusOverlayEl.hidden = false'],
 ['function openStudioPdfFocusViewer(', 'function closeStudioPdfFocusViewer(', 'studioPdfFocusOverlayEl.hidden = false'],
 ['function openStudioImageFocusViewer(', 'function closeStudioImageFocusViewer(', 'studioImageFocusOverlayEl.hidden = false'],
 ['function openQuizOverlay()', 'function closeQuizOverlay()', 'quizOverlayEl.hidden = false'],
]) {
 test(`${start} notifies open ownership after making its modal visible`,()=>{
  const body=section(source,start,end),notification=body.indexOf('syncStudioBufferOpenOperation()');
  assert(notification>body.indexOf(shown), 'actual modal entrypoint must synchronously invalidate pending open after visibility changes');
 });
}

test('a newer decision cancelled before GET completion cannot revive old permission',async()=>{
 const f=openFixture(),{result}=await f.start(),reset=f.c.clearStudioWorkspace();
 f.c.finishStudioDecision(false,false);await reset;f.requests[0].reject(grantError());await tick();
 const titles=f.titles.slice();await f.settle(false);await result;assert.deepEqual(titles,['Reset both buffers?']);
});

test('a newer decision during an approved POST prevents retry even after the decision closes',async()=>{
 const f=openFixture(),{result}=await f.start();f.requests[0].reject(grantError());await tick();
 f.c.finishStudioDecision(true,false);await tick();assert.equal(f.requests[1].path,'/resource-grants');
 const reset=f.c.clearStudioWorkspace();f.c.finishStudioDecision(false,false);await reset;
 await f.settle();assert.equal((await result).value,false);assert.equal(f.requests.length,2);
});

test('fresh open after retired activity is allowed; old cleanup cannot retire it',async()=>{
 const f=openFixture(),{result}=await f.start();f.startSuggestion();f.failSuggestion();
 const next=f.c.openStudioBufferDocument('/outside/fresh.md',f.context);await tick();
 const owner=f.c.pendingBufferDocumentOpen;assert.equal(f.requests.length,2);
 f.requests[0].reject(grantError());await tick();assert.equal((await result).value,false);
 assert.equal(f.c.pendingBufferDocumentOpen,owner);assert.equal(f.titles.length,0);
 f.requests[1].resolve(payload);assert.equal(await next,true);assert.equal(f.replacements.length,1);
});

test('own conversion, replacement and grant decisions survive ordinary status updates',async()=>{
 const f=openFixture();f.c.bufferRecoveryClient.snapshot().buffers[0].text='unsaved document';
 Object.assign(f.c,{getPreviewLocalLinkKind:()=> 'office',getPreviewOfficeConversionLabel:()=> 'next.docx'});
 load(f.c,'async function confirmPreviewOfficeConversion(', 'function isLikelyAbsoluteStudioPath(');
 const result=f.c.openStudioBufferDocument('/outside/next.docx',f.context);
 for(const title of ['Convert document?','Replace Document?']) {
  await tick();assert.equal(f.titles.at(-1),title);const owner=f.c.pendingBufferDocumentOpen;
  f.c.syncActionButtons();assert.equal(f.c.pendingBufferDocumentOpen,owner);
  f.c.finishStudioDecision(true,false);
 }
 await tick();f.requests[0].reject(grantError());await tick();assert.equal(f.titles.at(-1),'Allow next.md?');
 const owner=f.c.pendingBufferDocumentOpen;f.c.syncActionButtons();assert.equal(f.c.pendingBufferDocumentOpen,owner);
 await f.settle(true);assert.equal(await result,true);assert.equal(f.requests.length,3);
});

test('control: real Reset decision can be cancelled without mutating buffers',async()=>{
 const f=openFixture(),pending=f.c.clearStudioWorkspace();assert.equal(f.titles.at(-1),'Reset both buffers?');f.c.finishStudioDecision(false,false);await pending;
 assert.equal(f.c.studioDecisionState,null);assert.equal(f.replacements.length,0);
});
test('REGRESSION: late grant must not cancel and replace unrelated Reset confirmation',async()=>{
 const f=openFixture(),{result}=await f.start(),reset=f.c.clearStudioWorkspace(),owner=f.c.studioDecisionState;
 f.requests[0].reject(grantError());await tick();const same=f.c.studioDecisionState===owner;
 await f.settle(false);await reset;await result;
 assert.equal(same,true,'pending Reset must keep its own modal owner');
 assert.deepEqual(f.titles,['Reset both buffers?']);assert.equal(f.requests.length,1);assert.equal(f.replacements.length,0);
});
