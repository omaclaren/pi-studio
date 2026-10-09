import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
const tick=()=>new Promise(r=>setImmediate(r));
function harness(){
 const c={documentHostingEnabled:true,bufferRecoveryEnabled:true,documentHostingResourceDir:'/old',documentHostingResourceEditGeneration:0,resourceDirInput:{value:'/old'},sourceTextEl:{value:'later text'},sourceState:{source:'file',path:'/old/a.md'},bufferRecoveryClient:null,
  captureEditorAsyncConsent:()=>({bufferId:'doc'}),editorAsyncConsentIsCurrent:()=>true,studioModalBlocksDraftAction:()=>false,
  prepareDocumentHostingReplacement:async()=>{throw Error('unresolved save');},setStatus:()=>{},getCurrentStudioDocumentDescriptor:()=>({fileBacked:true,label:'a.md'}),requestStudioConfirmation:async()=>true,
  makeStudioDraftId:()=> 'new-id',setSourceState:next=>{c.sourceState=next;},resourceDirLabel:{textContent:'Working dir: /old'},showResourceDirState:()=>{},updateSaveFileTooltip:()=>{},syncActionButtons:()=>{},refreshPreviewsForResourceContextChange:()=>{},scheduleWorkspacePersistence:()=>{},
 };
 vm.createContext(c);
 vm.runInContext(section('      function normalizeStudioResourceDirValue(', '      function stripImportedFileLabel('),c);
 // Load the shared gate only after it exists: old call sites must fail the
 // behavioural assertions below, rather than merely failing extraction.
 if(source.includes('      function runStudioEditorSourceMutation('))vm.runInContext(section('      function runStudioEditorSourceMutation(', '      async function prepareDocumentHostingReplacement('),c);
 else vm.runInContext(section('      async function applyDocumentHostingReplacement(', '      async function prepareDocumentHostingReplacement('),c);
 vm.runInContext(section('      async function resetEditorOrigin(', '      function normalizeStudioPaneLayout('),c);
 vm.runInContext(section('      function applyResourceDir(', '      if (sourceBadgeEl)'),c);
 return c;
}
test('Reset origin cannot detach backing before pending-save gate accepts',async()=>{
 const c=harness(),before=c.sourceState;await c.resetEditorOrigin();assert.equal(c.sourceState,before);assert.equal(c.sourceTextEl.value,'later text');
});
test('working-directory typing is staging, not live resource authority',()=>{
 const c=harness();c.resourceDirInput.value='/unapplied';assert.equal(c.getCurrentResourceDirValue(),'/old');
});
test('working-directory apply and clear refuse before changing committed context',async()=>{
 for(const value of ['/new','']){const c=harness();c.resourceDirInput.value=value;await c.applyResourceDir();assert.equal(c.getCurrentResourceDirValue(),'/old');assert.equal(c.resourceDirLabel.textContent,'Working dir: /old');}
});
test('resource apply rechecks later input and source consent after await',async()=>{
 for(const change of [c=>{c.resourceDirInput.value='/newer-choice';},c=>{c.editorAsyncConsentIsCurrent=()=>false;},c=>{c.documentHostingResourceEditGeneration+=2;}]){
  const c=harness();let release;c.prepareDocumentHostingReplacement=async()=>{await new Promise(r=>release=r);return()=>true;};c.resourceDirInput.value='/new';const p=c.applyResourceDir();await tick();change(c);release?.();await p;assert.equal(c.getCurrentResourceDirValue(),'/old');
 }
});
test('approved resource apply commits once and ordinary mode stays synchronous',async()=>{
 const c=harness();c.prepareDocumentHostingReplacement=async(_id,current)=>current;c.resourceDirInput.value='/new';await c.applyResourceDir();assert.equal(c.getCurrentResourceDirValue(),'/new');
 c.documentHostingEnabled=false;c.resourceDirInput.value='/legacy';c.applyResourceDir();assert.equal(c.resourceDirLabel.textContent,'Working dir: /legacy');
});
test('local source loads refuse before replacing either text or backing',async()=>{
 const c=harness();c.buildVisibleWorkingText=()=> 'working snapshot';c.getWorkingDocumentLabel=()=> 'Working';c.setEditorText=text=>{c.sourceTextEl.value=text;};
 vm.runInContext(section('      function loadVisibleWorkingIntoEditor(', '      function getKnownReplRuntime('),c);
 await c.loadVisibleWorkingIntoEditor();await tick();assert.equal(c.sourceTextEl.value,'later text');assert.equal(c.sourceState.path,'/old/a.md');
});
test('editor-only file opening checks the same replacement gate before fetching or changing DOM',async()=>{
 const c=harness();Object.assign(c,{bufferSwitchingEnabled:false,isWatchedFilePreview:false,studioPreviewInteractionIsCurrent:()=>true,
  confirmPreviewOfficeConversion:async()=>true,editorHasPotentialUnsavedContent:()=>false,getPreviewLocalLinkKind:()=> 'text',reuseHostedDocumentOwner:async()=>({handled:false}),
  fetchPreviewLocalLink:async()=>({text:'disk snapshot',path:'/new.md'}),setEditorText:text=>{c.sourceTextEl.value=text;},markFileBackedBaseline:()=>{},detectLanguageFromName:()=>'',setEditorView:()=>{},setActivePane:()=>{},isLikelyAbsoluteStudioPath:()=>true});
 vm.runInContext(section('      async function openPreviewDocumentHere(', '      async function openPreviewDocumentInNewEditor('),c);
 await Promise.resolve(c.openPreviewDocumentHere('/new.md',{})).catch(()=>{});assert.equal(c.sourceTextEl.value,'later text');assert.equal(c.sourceState.path,'/old/a.md');
});
test('hosted Reset both refuses before consent or mutation, including an unselected retained save',async()=>{
 const c=harness(),state={buffers:[{id:'prompt',text:'Prompt kept'},{id:'doc',text:'Retained save kept'}]},before=structuredClone(state),messages=[];
 Object.assign(c,{uiBusy:false,bufferSwitchingEnabled:true,bufferRecoveryClient:{snapshot:()=>state},setStatus:m=>messages.push(m),
  requestStudioConfirmation:()=>{throw Error('unsupported reset must not ask for destructive consent');},captureRecoveryConsent:()=>{throw Error('must refuse before preparing reset');}});
 vm.runInContext(section('      async function clearStudioWorkspace(', '      function setEditorText('),c);await c.clearStudioWorkspace();assert.match(messages[0],/unavailable/);assert.deepEqual(state,before);assert.equal(c.sourceTextEl.value,'later text');assert.equal(c.sourceState.path,'/old/a.md');
});
for(const kind of ['repl','git','history','comments','response','critique'])test(kind+' source replacement consults the gate before mutation',async()=>{
 const c=harness();let gates=0;c.prepareDocumentHostingReplacement=async()=>{gates++;throw Error('pending save');};
 Object.assign(c,{setEditorText:t=>{c.sourceTextEl.value=t;},setEditorLanguage:()=>{},getVisibleReplJournalEntries:()=>[{}],buildReplJournalMarkdown:()=> 'record',
  rightView:'changes',gitChangesState:{content:'diff',label:'diff'},Element:class{},
  captureEditorConsent:()=>({}),editorConsentIsCurrent:()=>true,fileBackedBaselineText:'disk',fileBackedDiskRevision:'hash',
  reviewNotesActionGeneration:0,reviewNotesAssociationGeneration:0,reviewNotesEditGeneration:0,reviewNotesAssociation:{key:'notes'},buildReviewNotesPrompt:()=> 'comments',editorDiffersFromFileBackedBaseline:()=>false,
  isEditorOnlyMode:false,isWatchedFilePreview:false,uiBusy:false,responseReplacementPending:false,editorSourceGeneration:0,bufferSwitchingEnabled:true,isStudioDocumentBufferView:()=>false,
  latestResponseMarkdown:'response',latestResponseIsStructuredCritique:true,responseHistoryIndex:0,latestResponseTimestamp:1,
  getEditorDraftSourceKey:()=> 'source',hasRefreshableFilePath:()=>true,editorDraftHelpers:{needsDraftReplacementConfirmation:()=>false},submittedEditorDrafts:{matches:()=>false},
  buildCritiqueNotesMarkdown:()=> 'critique',bufferRecoveryClient:{snapshot:()=>({selectedBufferId:'doc'})}});
 let run;
 if(kind==='repl'){vm.runInContext(section('      function loadReplJournalIntoEditor(', '      function addSelectedReplJournalNote('),c);run=()=>c.loadReplJournalIntoEditor();}
 if(kind==='git'){vm.runInContext(section('      async function handleGitChangesPaneClick(', '      function ',),c);const el=new c.Element();el.closest=()=>el;el.getAttribute=()=> 'load';run=()=>c.handleGitChangesPaneClick({target:el,preventDefault(){}});}
 if(kind==='history'){const item={prompt:'history'};c.getSelectedHistoryItem=()=>item;c.getHistoryPromptSourceStateLabel=()=> 'history';c.getHistoryPromptLoadedStatus=()=> 'loaded';c.loadHistoryPromptBtn={addEventListener:(_t,fn)=>{run=fn;}};vm.runInContext(section('      async function loadSelectedHistoryPromptIntoEditor()','      pullLatestBtn.addEventListener'),c);}
 if(kind==='comments'){vm.runInContext(section('      async function loadReviewNotesPromptIntoEditor(', '      function buildReviewNoteLineMap('),c);run=()=>c.loadReviewNotesPromptIntoEditor();}
 if(kind==='response'){vm.runInContext(section('      async function loadSelectedResponseIntoEditor(', '      loadResponseBtn.addEventListener'),c);run=()=>c.loadSelectedResponseIntoEditor();}
 if(kind==='critique'){vm.runInContext(section('      async function loadSelectedCritiqueIntoEditor(', '      loadCritiqueNotesBtn.addEventListener'),c);run=()=>c.loadSelectedCritiqueIntoEditor('notes');}
 await run();await tick();assert.equal(gates,1);assert.equal(c.sourceTextEl.value,'later text');assert.equal(c.sourceState.path,'/old/a.md');
});

