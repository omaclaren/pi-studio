import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
function section(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a,start);return source.slice(a,b);}
function savedHandler(){
 const calls=[],statuses=[],operation={hosting:{operationId:'save-op'},sourceKey:'old',content:'saved bytes'};
 const c={documentHostingEnabled:true,bufferRecoveryEnabled:true,pendingSaveOperations:new Map([['request',operation]]),settledHostingSaveRequests:new Map(),pendingRequestId:'request',pendingKind:'save',stickyStudioKind:null,
  bufferRecoveryClient:{noteHostingSave:()=>({ok:true})},getEditorDraftSourceKey:()=> 'old',sourceTextEl:{value:'later typing'},resourceDirInput:{value:'/'},
  normalizeStudioResourceDirValue:x=>x,dirnameForDisplayPath:()=> '/',setSourceState:()=>calls.push('source mutated'),markFileBackedBaseline:()=>calls.push('baseline mutated'),
  abandonPendingSaveRequest(){},clearArmedTitleAttention(){},setBusy(){},setWsState(){},persistWorkspaceStateNow(){},syncDocumentHostingReadiness(){},setStatus:text=>statuses.push(text),
  resolveDocumentHostingSave:opts=>{calls.push(opts);return Promise.resolve();}};
 vm.createContext(c);vm.runInContext('function deliver(message){'+section('        if (message.type === "saved")','        if (message.type === "pi_editor_draft_result")')+'}',c);
 return {c,calls,statuses,message:{type:'saved',requestId:'request',path:'/saved.md',hosting:{operationId:'save-op'}}};
}
test('hosting bootstrap refreshes action availability after workspace persistence becomes ready',()=>{
 const calls=[],c=vm.createContext({workspacePersistenceReady:false,documentHostingEnabled:true,initializePromptRunIndicator(){},syncStudioRunFollowingFromMessage(){},syncActionButtons:()=>calls.push(c.workspacePersistenceReady)});
 vm.runInContext(section('      workspacePersistenceReady = true;','      persistWorkspaceStateNow({ skipServer:'),c);
 assert.deepEqual(calls,[true]);
 c.documentHostingEnabled=false;c.workspacePersistenceReady=false;calls.length=0;
 vm.runInContext(section('      workspacePersistenceReady = true;','      persistWorkspaceStateNow({ skipServer:'),c);assert.deepEqual(calls,[]);
});

test('hosted saved notification initiates retained-outcome reconciliation, not immediate DOM/backing mutation',()=>{
 const f=savedHandler();f.c.deliver(f.message);assert.deepEqual(f.calls.map(x=>typeof x==='string'?x:x.automaticOperationId),['save-op']);
 assert.equal(f.c.sourceTextEl.value,'later typing');
});
test('late saved notification for an already inspected request is ignored without a new warning',()=>{
 const f=savedHandler();f.c.pendingSaveOperations.clear();f.c.settledHostingSaveRequests.set('request','save-op');f.c.deliver(f.message);
 assert.deepEqual(f.calls,[]);assert.deepEqual(f.statuses,[]);
});
function resolutionHarness({conflict=false,choice=true,commitFails=false}={}){
 const calls=[],statuses=[],record={operationId:'op',bufferId:'doc',path:'/new.md'},entry={id:'doc',sourceState:{path:'/old.md'}};let claims=[record];
 const c={documentHostingSaveResolution:null,documentHostingSaveResolutionBufferId:null,documentHostingEnabled:true,documentHostingGeneration:1,documentHostingRetired:false,bufferPageClosed:false,
  bufferConnectionGeneration:1,editorContentGeneration:1,editorSourceGeneration:1,sourceTextEl:{value:'later typing'},sourceState:entry.sourceState,fileBackedBaselineText:'saved',fileBackedDiskRevision:'hash',getCurrentResourceDirValue:()=> '/',editorView:'markdown',rightView:'preview',scratchpadAssociationGeneration:1,reviewNotesAssociationGeneration:1,
  scratchpadText:'Kept scratchpad',reviewNotes:[{id:'n',text:'Kept comment'}],scratchpadAssociation:{key:'old'},reviewNotesAssociation:{key:'old'},scratchpadLoadedKeys:new Set(['old']),reviewNotesLoadedKeys:new Set(['old']),studioMetadataKeyIsLoaded:(keys,key)=>keys.has(key),documentHostingMetadataIsIdle:()=>true,cloneReviewNotes:notes=>notes,
  studioModalBlocksDraftAction:()=>false,syncDocumentHostingReadiness(){},captureStudioBufferTransientState(){},persistWorkspaceStateNow(){},bindSelectedStudioBuffer:()=>calls.push('bind'),setStatus:t=>statuses.push(t),
  pendingSaveOperations:new Map(),settledHostingSaveRequests:new Map(),documentHostingLastRemote:{pendingSaves:claims},abandonPendingSaveRequest(){},studioDecisionState:null,
  openStudioDecision:async opts=>{calls.push(opts);return choice;},
  requestDocumentHosting:async req=>{calls.push(req.operation+(req.choice?':'+req.choice:''));if(req.operation==='discard-save'){claims=[];return{ok:true};}
   if(!req.choice)return{ok:true,conflict,metadataRevision:'revision',source:{scratchpadText:c.scratchpadText,reviewNotes:c.reviewNotes}};
   if(commitFails)return{ok:false,message:'Metadata changed; copies kept.'};record.metadataTransfer={destinationKey:'file:/new.md',choice:req.choice};return{ok:true,prepared:true};},
  bufferRecoveryClient:{snapshot:()=>({selectedBufferId:'doc',buffers:[entry]}),settled:async()=>{},retry:async()=>{calls.push('recheck');return{ok:true};},pendingHostingSaves:()=>claims,hostingAuthority:()=>({ok:true,bufferId:'doc'}),attachHostingSave:()=>{assert(record.metadataTransfer);calls.push('attach');claims=[];return{ok:true};}}};
 vm.createContext(c);vm.runInContext(section('      function hostedSaveMetadataCan','      function documentHostingMetadataIsIdle('),c);return{c,calls,statuses};
}
test('automatic Save As transfers nonempty metadata before attaching and rebinding the saved baseline',async()=>{
 const f=resolutionHarness();await f.c.resolveDocumentHostingSave({automaticOperationId:'op'});
 assert.deepEqual(f.calls,['recheck','save-metadata','save-metadata:carry','recheck','attach','bind']);assert.equal(f.c.scratchpadText,'Kept scratchpad');
});
test('automatic Save As stops for destination conflicts and manual resolution explicitly selects destination notes',async()=>{
 const automatic=resolutionHarness({conflict:true});await automatic.c.resolveDocumentHostingSave({automaticOperationId:'op'});assert.deepEqual(automatic.calls,['recheck','save-metadata']);
 const manual=resolutionHarness({conflict:true});await manual.c.resolveDocumentHostingSave();const dialog=manual.calls.find(c=>typeof c==='object');assert.equal(dialog.confirmLabel,'Use destination notes');assert(manual.calls.includes('save-metadata:destination'));assert(manual.calls.includes('attach'));
});
test('changed destination or cancelled consent cannot attach or discard the retained file outcome',async()=>{
 const changed=resolutionHarness({conflict:true,commitFails:true});await changed.c.resolveDocumentHostingSave();assert(!changed.calls.includes('attach'));assert(!changed.calls.includes('discard-save'));assert.equal(changed.c.scratchpadText,'Kept scratchpad');
 const cancelled=resolutionHarness({conflict:true,choice:false});await cancelled.c.resolveDocumentHostingSave();assert(!cancelled.calls.some(c=>typeof c==='string'&&c.includes(':destination')));assert(!cancelled.calls.includes('attach'));assert(!cancelled.calls.includes('discard-save'));
});

test('changing backing may transfer nonempty metadata only when both selected records are loaded and idle',()=>{
 const c={documentHostingMetadataIsIdle:()=>true,scratchpadAssociation:{key:'scratch'},reviewNotesAssociation:{key:'notes'},scratchpadLoadedKeys:new Set(['scratch']),reviewNotesLoadedKeys:new Set(['notes']),
  scratchpadText:'',reviewNotes:[],studioMetadataKeyIsLoaded:(keys,key)=>keys.has(key)};
 vm.createContext(c);vm.runInContext(section('      function hostedSaveMetadataCanTransfer(', '      function retireConfirmedHostingSaveRequests('),c);
 assert.equal(c.hostedSaveMetadataCanTransfer('doc'),true);
 c.reviewNotes.push({text:'keep note'});assert.equal(c.hostedSaveMetadataCanTransfer('doc'),true);
 c.scratchpadText='keep scratchpad';assert.equal(c.hostedSaveMetadataCanTransfer('doc'),true);
 c.documentHostingMetadataIsIdle=()=>false;assert.equal(c.hostedSaveMetadataCanTransfer('doc'),false);c.documentHostingMetadataIsIdle=()=>true;
 c.scratchpadLoadedKeys.clear();assert.equal(c.hostedSaveMetadataCanTransfer('doc'),false);
});
