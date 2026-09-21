// Real response/capture/bind/render/set-view/finish/restore chains. VM adapters
// supply DOM, immutable-store selection, transport and pure rendering decoration.
// Native counterparts separately exercise real browser DOM/Pandoc/input.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
const fixtureSource=fs.readFileSync(new URL('./studio-buffer-switching-ui.test.js',import.meta.url),'utf8');
function section(text,start,end){const a=text.indexOf(start),b=text.indexOf(end,a);assert(a>=0&&b>a,start);return text.slice(a,b);}
function load(c,start,end){vm.runInContext(section(source,start,end),c);}
const helpers=vm.createContext({assert,load,context:values=>vm.createContext(values)});
for(const [start,end] of [['function bindingHarness(', 'test("returning to a following Prompt'],['function historyBindingHarness(', 'const shiftedHistory ='],['function traceReadingHarness(', 'for (const variant of ["same"']])vm.runInContext(section(fixtureSource,start,end),helpers);
const tick=()=>new Promise(r=>setImmediate(r));
class Pane {
 constructor(html=''){this.innerHTML=html;this.scrollTop=0;this.scrollLeft=0;this.scrollHeight=1600;this.isConnected=true;this.dataset={};this.classList={add(){},remove(){},toggle(){}};}
 closest(){return this;}
 remove(){}
}
function lifecycle(view='preview'){
 const f=helpers.traceReadingHarness(29,view),c=f.c,frames=[],held=[];
 const prompt=f.entry,document={...structuredClone(prompt),id:'document',role:'document',text:'DOCUMENT BODY',view:{...prompt.view,rightView:'editor-preview',rightScrollTop:0}};
 let selected=prompt,generation=1,delay=false;
 Object.assign(c,{
  bufferRecoveryEnabled:true,bufferPageClosed:false,editorView:'markdown',rightView:view,sourcePreviewRenderNonce:0,responsePreviewRenderNonce:0,
  studioEditorViewGeneration:0,studioRightViewGeneration:0,
  pendingResponseScrollReset:false,latestResponseMarkdown:'R30',latestResponseKind:'direct',latestResponseTimestamp:1,latestResponseNormalized:'R30',latestResponseThinkingNormalized:'',
  annotationsEnabled:false,editorLanguage:'markdown',sourceTextEl:{value:prompt.text,scrollTop:0,setSelectionRange(){}},sourcePreviewEl:new Pane(),critiqueViewEl:new Pane('OLD CONTENT'),
  Element:Pane,previewPendingTimers:new Map(),studioPreviewElementOwners:new WeakMap(),PREVIEW_PENDING_BADGE_DELAY_MS:200,
  window:{requestAnimationFrame:fn=>frames.push(fn),setTimeout:()=>1,clearTimeout(){}},getStudioSelectedBuffer:()=>selected,isStudioDocumentBufferView:()=>selected.role==='document',
  bufferRecoveryClient:{snapshot:()=>({selectedBufferId:selected.id,activePromptId:'prompt',buffers:[prompt,document]})},
  captureEditorAsyncConsent:()=>({generation,id:selected.id}),editorAsyncConsentIsCurrent:o=>o?.generation===generation&&o?.id===selected.id,
  clearEditorAsyncOperations:()=>{generation++;},setEditorText:text=>{c.sourceTextEl.value=text;},
  previewResourceHelpers:{areStudioPreviewResourceContextsEqual:(a,b)=>JSON.stringify(a)===JSON.stringify(b)},getHtmlPreviewResourceContextOptions:()=>({}),
  normalizeHistoryKind:k=>k||'direct',normalizeForCompare:s=>String(s||''),isStructuredCritique:()=>false,
  rightViewSelect:{value:view},normalizeRightViewValue:v=>v,editorViewSelect:{value:'markdown'},sourceEditorWrapEl:{style:{}},sourcePreviewRenderTimer:null,responseEditorPreviewTimer:null,
  replQuickFocusRequested:false,traceAutoScroll:true,shouldStickTraceToBottom:()=>false,buildTracePanelHtml:()=>c.traceState?.runId||'TRACE',
  hasMeaningfulPreviewContent:p=>Boolean(p.innerHTML),prepareEditorTextForPreview:s=>s,getEditorLanguageForPreview:()=> 'markdown',isHtmlArtifactPreviewText:()=>false,
  renderDelimitedTextPreview:()=>false,supportsCodePreviewCommentsForLanguage:()=>false,responseHighlightEnabled:false,buildPlainMarkdownHtml:s=>s,
  isCurrentStudioPreviewRender:(pane,n)=>n===(pane==='source'?c.sourcePreviewRenderNonce:c.responsePreviewRenderNonce),
  prepareMarkdownForPandocPreview:markdown=>({markdown,placeholders:[]}),stripAnnotationMarkers:s=>s,prepareStudioPdfBlocksForPreview:markdown=>({markdown,blocks:[]}),
  renderMarkdownWithPandoc:markdown=>delay&&markdown==='NEW RESPONSE'?new Promise(resolve=>held.push({resolve,markdown})):Promise.resolve(markdown),
  createStudioPreviewStagingElement:()=>new Pane(),sanitizeRenderedHtml:s=>s,commitStudioPreviewStagingElement:(target,staging)=>{target.innerHTML=staging.innerHTML;},
  supportsPreviewCommentsForCurrentEditor:()=>false,isWatchedFilePreview:false,buildPreviewErrorHtml:(_,s)=>s,replaceResponsePaneWithClone:()=>c.critiqueViewEl,
  pendingPiEditorDraftSnapshots:new Map(),pendingRequestId:null,pendingKind:null,
 });
 const noops=['hydrateStudioPreviewLocalMedia','renderStudioPdfBlocksInElement','applyPreviewAnnotationPlaceholdersToElement','renderAnnotationMathInElement','decoratePdfEmbeds','renderPdfPreviewsInElement','decoratePreviewPdfFigures','applyAnnotationMarkersToElement','renderMermaidInElement','renderMathFallbackInElement','decorateCopyablePreviewBlocks','decoratePreviewImages','clearPreviewJumpHighlight','clearWatchedPreviewRenderError','scheduleWatchedPreviewReadingPositionRestore','scheduleResponsePaneRepaintNudge','updateSourceBadge','updateReferenceBadge','updateResultActionButtons','syncRightViewModeOptions','syncActionButtons','scheduleWorkspacePersistence','updateEditorHighlightState','syncHighlightSelectUi','updateLineNumberGutterVisibility','scheduleEditorLineNumberRender','updateReviewNotesUi','updateEditorSelectionCommentUi','updateOutlineUi','syncStudioSelectionAppendAction','setStatus','setBusy','setWsState','finishTrackedStudioActivity','maybeShowTitleAttentionForCompletedRequest'];
 for(const name of noops)c[name]=()=>{};
 for(const [start,end] of [
  ['function beginPreviewRender(', 'function scheduleResponsePaneRepaintNudge('],
  ['function captureStudioPreviewOwner(', 'function buildStudioPreviewInteractionContext('],
  ['async function applyRenderedMarkdown(', 'function renderSourcePreviewNow('],
  ['function renderTraceView()', 'function renderReplView()'],
  ['function renderActiveResult()', 'function updateResultActionButtons('],
  ['function refreshResponseUi()', 'function normalizeStudioResourceDirValue('],
  ['function setEditorView(', 'function lineNumbersShouldBeVisible('],
  ['function scheduleStudioBufferScrollRestore(', 'function captureStudioBufferTransientState('],
  ['function applyPendingResponseScrollReset()', 'async function getMermaidApi()'],
  ['function handleIncomingResponse(', 'function sendMessage('],
  ['function clearActiveResponseView(', 'function updateHistoryControls()'],
  ['function applySelectedHistoryItem(', 'function setResponseHistory('],
 ])load(c,start,end);
 vm.runInContext('function receive(message) {'+section(source,'if (message.type === "response") {','if (message.type === "latest_response") {')+'}',c);
 c.renderSourcePreview=()=>{};
 function flush(){let count=0;while(frames.length){assert(count++<30);for(const cb of frames.splice(0))cb();}}
 async function settle(){await tick();flush();await tick();flush();}
 function save(){selected.view.rightView=c.rightView;selected.view.rightScrollTop=c.critiqueViewEl.scrollTop;c.captureStudioBufferTransientState();}
 function select(entry){save();selected=entry;c.bindSelectedStudioBuffer();}
 return{c,prompt,document,held,frames,flush,settle,save,leave:()=>select(document),back:()=>select(prompt),
  delay:()=>{delay=true;},release:async()=>{delay=false;for(const h of held.splice(0))h.resolve(h.markdown);await settle();},
  arrive:()=>c.receive({type:'response',kind:'direct',requestId:'synthetic',markdown:'NEW RESPONSE',timestamp:2,responseHistory:[{id:'new',kind:'direct',markdown:'NEW RESPONSE',timestamp:2}]}),
  edit:()=>{generation++;},state:()=>({prompt:structuredClone(prompt),document:structuredClone(document)})};
}
for(const view of ['editor-preview','trace','preview'])test('active Prompt capture retains outstanding response retirement from '+view,async()=>{
 const f=lifecycle(view);if(view==='preview')f.delay();f.c.critiqueViewEl.scrollTop=430;f.arrive();await f.settle();
 assert.equal(f.c.pendingResponseScrollReset,true);f.leave();await f.settle();f.back();await f.settle();
 assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,true,'active-Prompt retirement must survive its capture');
 f.c.setRightView('preview');await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,0);assert.equal(f.c.bufferTransientStates.get('prompt').responseScrollPending,false);
 f.c.critiqueViewEl.scrollTop=125;f.leave();await f.settle();f.back();await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,125,'consumed retirement stays consumed');
 assert.equal(f.prompt.text,'kept draft');assert.equal(f.document.text,'DOCUMENT BODY');
});
async function pendingReturn(view='preview',changed=true){
 const f=lifecycle(view);f.c.critiqueViewEl.scrollTop=430;f.leave();await f.settle();
 if(changed)f.c.setResponseHistory([{id:'new',markdown:'NEW RESPONSE',kind:'direct',timestamp:2}],{autoSelectLatest:true,silent:true});
 f.delay();f.back();await f.settle();return f;
}
for(const view of ['trace','markdown','editor-preview'])test('pending response restoration cannot be adopted by '+view,async()=>{
 const f=await pendingReturn();assert(f.held.length>0);assert.equal(f.c.bufferViewRestore.right,0);assert.equal(f.c.critiqueViewEl.innerHTML,'DOCUMENT BODY');
 f.c.setRightView(view);if(view==='trace')assert.equal(f.c.critiqueViewEl.scrollTop,1600);await f.settle();
 if(view==='trace')assert.equal(f.c.critiqueViewEl.scrollTop,1600);else {f.c.critiqueViewEl.scrollTop=215;await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,215);}
 assert.equal(f.c.bufferViewRestore.right,null,'retirement is permanent, not delayed until view equality returns');
 const reading=f.c.critiqueViewEl.scrollTop;await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,reading);
});
test('delayed render consumes current restoration once, then Working keeps its bottom',async()=>{
 const f=await pendingReturn();await f.release();assert.equal(f.c.critiqueViewEl.innerHTML,'NEW RESPONSE');assert.equal(f.c.critiqueViewEl.scrollTop,0);assert.equal(f.c.bufferViewRestore.right,null);
 f.c.critiqueViewEl.scrollTop=125;f.c.refreshResponseUi();await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,125);
 f.c.setRightView('trace');await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,1600);
});
test('header view ABA cannot revive a pending restoration',async()=>{
 const f=await pendingReturn();f.c.setRightView('trace');f.c.setRightView('preview');assert.equal(f.c.bufferViewRestore.right,null);await f.release();
 f.c.critiqueViewEl.scrollTop=225;f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,225);
});
test('pane cancellation leaves Working independent of a late renderer',async()=>{
 const f=await pendingReturn();f.c.bufferViewRestore.right=null;f.c.setRightView('trace');await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,1600);
});
test('same-view response change retires the old numeric reading owner before rendering',async()=>{
 const f=await pendingReturn('preview',false);await f.settle();
 // Create a pending current-response restore against an old committed owner.
 f.c.bufferViewRestore.right=430;f.c.studioPreviewElementOwners.delete(f.c.critiqueViewEl);f.delay();f.arrive();await f.settle();
 assert.equal(f.c.bufferViewRestore.right,null);await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,0);
});
test('an explicit new completion reset wins even if response identity and text are unchanged',async()=>{
 const f=lifecycle();f.c.critiqueViewEl.scrollTop=430;f.leave();await f.settle();f.back();assert.equal(f.c.bufferViewRestore.right,430);
 const item=structuredClone(f.c.getSelectedHistoryItem());f.c.receive({type:'response',kind:'direct',requestId:'synthetic-repeat',markdown:item.markdown,timestamp:3,responseHistory:[{...item,timestamp:3}]});
 await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,0,'a pending old offset must not overrule explicit response retirement');
});
test('same-view response ABA cannot revive the old pending position',async()=>{
 const f=await pendingReturn();const item=structuredClone(f.c.getSelectedHistoryItem());f.c.setResponseHistory([{...item,id:'other',markdown:'OTHER'}],{autoSelectLatest:true,silent:true});
 f.c.setResponseHistory([item],{autoSelectLatest:true,silent:true});assert.equal(f.c.bufferViewRestore.right,null);await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,0);
});
for(const change of ['buffer','content','trace'])test('queued restore is fenced by originating '+change+' owner',async()=>{
 const f=await pendingReturn('trace',false);f.c.bufferViewRestore.right=430;
 f.c.scheduleStudioBufferScrollRestore(f.c.critiqueViewEl);
 if(change==='buffer')f.leave();else if(change==='content')f.edit();else {f.c.liveTraceState={runId:'new-run',requestId:'new-request'};f.c.syncTraceForSelectedHistoryItem();}
 f.c.critiqueViewEl.scrollTop=275;f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,275);await f.release();
});
test('same live trace growth retains a current pending reading position',async()=>{
 const f=await pendingReturn('trace',false);f.c.bufferViewRestore.right=430;f.c.liveTraceState.entries=['growth'];f.c.refreshResponseUi();f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,430);
});
test('recovered positional fallback without saved page-local history identity still restores',async()=>{
 const f=lifecycle();f.c.bufferTransientStates.delete('prompt');f.prompt.view.rightScrollTop=430;f.c.bindSelectedStudioBuffer();await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,430);
});
test('source preview restoration cannot survive a source view ABA',async()=>{
 const f=lifecycle('trace');f.prompt.view.editorView='preview';f.c.bindSelectedStudioBuffer();
 f.c.setEditorView('markdown');f.c.setEditorView('preview');f.c.sourcePreviewEl.scrollTop=275;f.flush();assert.equal(f.c.bufferViewRestore.source,null);assert.equal(f.c.sourcePreviewEl.scrollTop,275);await f.settle();
});
test('a redundant same-content response render retains the original reading owner',async()=>{
 const f=lifecycle();f.c.responseHistory=[{id:'same',markdown:'NEW RESPONSE'}];f.c.responseHistoryIndex=0;f.c.latestResponseMarkdown='NEW RESPONSE';f.c.critiqueViewEl.scrollTop=430;
 f.leave();await f.settle();f.delay();f.back();await f.settle();assert.equal(f.c.bufferViewRestore.right,430);
 f.c.refreshResponseUi();await f.settle();assert.equal(f.c.bufferViewRestore.right,430);assert(f.held.length>=2);await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,430);
});
for(const change of ['annotations','resource','source-generation'])test('late scheduling cannot acquire a new '+change+' owner',async()=>{
 const f=await pendingReturn();
 if(change==='annotations')f.c.annotationsEnabled=true;
 else if(change==='resource')f.c.getHtmlPreviewResourceContextOptions=()=>({resourceDir:'/other'});
 else f.edit();
 f.c.refreshResponseUi();assert.equal(f.c.bufferViewRestore.right,null);await f.release();assert.equal(f.c.critiqueViewEl.scrollTop,0);
});
for(const change of ['annotations','language','resource'])test('editor preview owner observes '+change+' changes before a delayed finish',async()=>{
 const f=lifecycle('editor-preview');f.c.bindSelectedStudioBuffer();
 if(change==='annotations')f.c.annotationsEnabled=true;else if(change==='language')f.c.editorLanguage='python';else f.c.getHtmlPreviewResourceContextOptions=()=>({resourceDir:'/other'});
 f.c.refreshResponseUi();assert.equal(f.c.bufferViewRestore.right,null);await f.settle();
});
test('response changes do not retire independent source-preview restoration',async()=>{
 const f=lifecycle();f.prompt.view.editorView='preview';f.c.bindSelectedStudioBuffer();f.arrive();assert.equal(f.c.bufferViewRestore.source,90);await f.settle();
});
test('old callback cleanup cannot retire a newer buffer restore',async()=>{
 const f=await pendingReturn();f.c.scheduleStudioBufferScrollRestore(f.c.critiqueViewEl);const old=f.frames.splice(0);f.leave();const newer=f.c.bufferViewRestore;
 for(const cb of old)cb();assert.equal(f.c.bufferViewRestore,newer);assert.equal(newer.right,0);await f.release();
});
for(const change of ['disconnect','replace'])test('a '+change+'d preview node cannot consume current restoration',async()=>{
 const f=await pendingReturn('trace',false);f.c.bufferViewRestore.right=430;const old=f.c.critiqueViewEl;f.c.scheduleStudioBufferScrollRestore(old);
 if(change==='disconnect')old.isConnected=false;else f.c.critiqueViewEl=new Pane('replacement');
 old.scrollTop=275;f.flush();assert.equal(old.scrollTop,275);assert.equal(f.c.bufferViewRestore.right,430);
 old.isConnected=true;f.c.finishPreviewRender(f.c.critiqueViewEl);f.flush();assert.equal(f.c.critiqueViewEl.scrollTop,430);await f.release();
});
for(const recovery of [false,true])test('non-switching rendering does not inspect opt-in restoration (recovery '+recovery+')',async()=>{
 const f=lifecycle('trace');f.c.bufferRecoveryEnabled=recovery;f.c.bufferSwitchingEnabled=false;f.c.studioBufferScrollRestoreIsCurrent=()=>{throw new Error('Opt-in restore inspected');};
 f.c.setRightView('trace');f.c.setEditorView('markdown');await f.settle();assert.equal(f.c.critiqueViewEl.scrollTop,1600);
});
