import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createStudioBuffer,validateStudioBufferWorkspace} from '../shared/studio-buffer-store.js';
import {encodeStudioBufferRecovery,decodeStudioBufferRecovery} from '../shared/studio-buffer-recovery.js';
import {createStudioDocumentCopy} from '../shared/studio-document-hosting.js';
const client=readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8'),helper=readFileSync(new URL('../client/studio-editor-draft-helpers.js',import.meta.url),'utf8');
function section(start,end){const a=client.indexOf(start),b=client.indexOf(end,a);assert(a>=0&&b>a,start);return client.slice(a,b);}
function helpers(){const c=vm.createContext({});vm.runInContext(helper,c);return c.PiStudioEditorDraftHelpers;}
const origin=(changes={})=>({version:1,kind:'response',responseId:'response-id-3',responseNumber:3,annotated:false,...changes});
function workspace(sourceState){const b=createStudioBuffer({id:'doc',role:'document',text:'# Heading',sourceState});return{version:2,workspaceId:'workspace_'+'a'.repeat(24),mode:'editor-only',revision:1,savedAt:1,selectedBufferId:'doc',activePromptId:null,order:['doc'],buffers:[b]};}

test('Save control is enabled for a draft, but never for a watched or busy editor',()=>{
 const code=section('        saveAsBtn.disabled =','        if (refreshFromDiskBtn)'),c=vm.createContext({saveAsBtn:{},saveOverBtn:{},uiBusy:false,isWatchedFilePreview:false,canSaveOver:false});vm.runInContext(code,c);assert.equal(c.saveOverBtn.disabled,false);
 for(const key of ['uiBusy','isWatchedFilePreview']){c[key]=true;vm.runInContext(code,c);assert.equal(c.saveOverBtn.disabled,true);c[key]=false;}
});
test('ordinary Save routes draft to Save As and a backing file to guarded Save Over without submission',async()=>{
 const calls=[],c=vm.createContext({uiBusy:false,isWatchedFilePreview:false,bufferPageClosed:false,studioModalBlocksDraftAction:()=>false,hasRefreshableFilePath:()=>false,openEditorSaveAsDialog:()=>calls.push('as'),sendEditorSaveOverRequest:()=>calls.push('over')});vm.runInContext(section('      function requestEditorSave(','      function sendEditorSaveOverRequest('),c);
 await c.requestEditorSave();assert.deepEqual(calls,['as']);c.hasRefreshableFilePath=()=>true;await c.requestEditorSave();assert.deepEqual(calls,['as','over']);
 for(const key of ['uiBusy','isWatchedFilePreview','bufferPageClosed']){c[key]=true;await c.requestEditorSave();assert.equal(calls.length,2);c[key]=false;}c.studioModalBlocksDraftAction=()=>true;await c.requestEditorSave();assert.equal(calls.length,2);
});
test('Save button and Ctrl/Cmd+S share the same draft/file dispatch',()=>{
 assert.match(section('      saveOverBtn.addEventListener(', '      if (refreshFromDiskBtn)'),/requestEditorSave\(\)/);
 assert.doesNotMatch(section('      function triggerEditorSaveShortcut()', '      function triggerEditorSaveAsShortcut()'),/hasRefreshableFilePath\(\)/);
});

test('response names use captured response number and annotation preparation, never current history position',()=>{
 const h=helpers();assert.equal(h.buildDraftSaveFilename({sourceState:{provenance:origin()},text:'# Ignore this heading'}),'response-3.md');assert.equal(h.buildDraftSaveFilename({sourceState:{provenance:origin({annotated:true})},text:''}),'response-3-annotated.md');assert.equal(h.buildDraftSaveFilename({sourceState:{provenance:origin()},text:'',annotated:true}),'response-3-annotated.md');
 assert.equal(h.buildDraftSaveFilename({sourceState:{provenance:origin({responseNumber:null,responseId:null})},text:''}),'response.md');
});
test('heading-derived names skip front matter and fenced examples and preserve readable Unicode',()=>{
 const h=helpers(),name=text=>h.buildDraftSaveFilename({sourceState:{source:'blank',label:'Prompt'},text});
 assert.equal(name('---\ntitle: metadata\n---\n```md\n# Example\n```\n## [Useful](url) **Heading**'),'useful-heading.md');
 assert.equal(name('~~~\n# Sample\n~~~\nGeothermal reservoir\n===================='),'geothermal-reservoir.md');
 assert.equal(name('# Mātauranga Māori'),'mātauranga-māori.md');assert.equal(name('ordinary paragraph'),'draft.md');
});
test('filename suggestions are bounded basenames, not authority or traversal, with safe reserved-name fallback',()=>{
 const h=helpers(),name=text=>h.buildDraftSaveFilename({sourceState:{},text});assert.equal(name('# ../../private/<bad>:file?'),'private-bad-file.md');assert.equal(name('# CON'),'document-con.md');assert(name('# '+ 'long '.repeat(200)).length<=83);assert(Buffer.byteLength(name('# '+ '\u{20000}'.repeat(200)))<=163);assert.equal(name('# /\\ ?'),'draft.md');
 assert.equal(h.buildDraftSaveFilename({sourceState:{source:'upload',label:'imported copy: C:\\folder\\script.py'},text:''}),'script.py');
});
test('detached imported HTML preserves its informational filename extension before Markdown-only heading heuristics',()=>{
 const h=helpers();for(const source of ['import','upload'])for(const text of ['<!doctype html><h1>Generated</h1>','<!doctype html>\n<style>\n# Not a Markdown heading\n</style>'])assert.equal(h.buildDraftSaveFilename({sourceState:{source,label:'Result.studio.html',path:null},text}),'result-studio.html');
 assert.equal(h.buildDraftSaveFilename({sourceState:{source:'import',label:'imported copy: ../../CON.htm'},text:'# Not a heading'}),'document-con.htm');assert.equal(h.buildDraftSaveFilename({sourceState:{source:'import',label:'x'.repeat(500)+'.html'},text:''}).length,85);
 assert.equal(h.buildDraftSaveFilename({sourceState:{source:'import',label:'named.html',provenance:origin()},text:''}),'response-3.md','captured response provenance still outranks informational import label');
});
test('provenance captures response identity and position without claiming a durable save or annotation preference',()=>{
 const h=helpers(),p=h.createResponseDraftProvenance({id:'stable-id',index:2,annotated:true});assert.deepEqual(JSON.parse(JSON.stringify(p)),origin({responseId:'stable-id',annotated:true}));
 const unknown=h.createResponseDraftProvenance({id:null,index:-1,annotated:false});assert.equal(unknown.responseId,null);assert.equal(unknown.responseNumber,null);
 assert.match(h.describeSourceProvenance(origin({annotated:true})),/Loaded from response 3 for annotation/);assert.doesNotMatch(h.describeSourceProvenance(origin()),/saved|guarantee|submitted/i);
});

test('response provenance survives strict codec round trips for drafts and saved file backing',()=>{
 for(const file of [false,true]){const s=workspace({source:file?'file':'last-response',label:'response',path:file?'/saved.md':null,draftId:file?null:'draft',provenance:origin()});const encoded=encodeStudioBufferRecovery(s,s);assert(encoded.ok);const read=decodeStudioBufferRecovery(encoded.raw,s);assert(read.ok);assert.deepEqual(read.state.buffers[0].sourceState.provenance,origin());assert(Object.isFrozen(read.state.buffers[0].sourceState.provenance));}
});
test('malformed or unsupported provenance fails closed without partial recovery or identity truncation',()=>{
 const good=workspace({source:'blank',label:'draft',path:null,draftId:'draft'});
 for(const bad of [null,origin({version:2}),origin({kind:'file'}),origin({responseId:'x'.repeat(257)}),origin({responseNumber:0}),origin({annotated:'true'}),origin({url:'https://secret.invalid'})]){const raw=structuredClone(good);raw.buffers[0].sourceState.provenance=bad;assert.equal(validateStudioBufferWorkspace(raw).ok,false);assert.equal(decodeStudioBufferRecovery(JSON.stringify(raw),good).ok,false);}
 assert(validateStudioBufferWorkspace(good).ok);
});
test('copy preserves response provenance while remaining detached and independently identified',()=>{
 const b=createStudioBuffer({id:'prompt',role:'prompt',text:'response edits',sourceState:{source:'last-response',label:'response 3',path:null,draftId:'original',provenance:origin()}}),copy=createStudioDocumentCopy(b,'copy');assert.equal(copy.sourceState.path,null);assert.equal(copy.sourceState.draftId,'copy');assert.deepEqual(copy.sourceState.provenance,origin());assert.equal(copy.id,'copy');
});

function suggestionHarness({sourceState={source:'blank',label:'Prompt',path:null},current=true,choice='/work/new.md'}={}){
 const calls=[],c=vm.createContext({bufferSwitcherUi:null,sourceState,sourceTextEl:{value:'# Useful heading'},uiBusy:false,isWatchedFilePreview:false,bufferPageClosed:false,studioModalBlocksDraftAction:()=>false,getCurrentResourceDirValue:()=>'/work',getEffectiveSavePath:()=>sourceState.path,captureEditorConsent:()=>({}),editorConsentIsCurrent:()=>current,editorDraftHelpers:helpers(),requestStudioTextInput:async(...args)=>{calls.push(args);return choice;},sendEditorSaveAsRequest:(...args)=>calls.push(['write',...args]),setStatus:t=>calls.push(['status',t])});vm.runInContext(section('      async function openEditorSaveAsDialog(options)','      function requestEditorSave('),c);return{c,calls};
}
test('draft Save As suggests heading in current controlled working directory but writes only explicit choice',async()=>{
 const f=suggestionHarness();await f.c.openEditorSaveAsDialog();assert.equal(f.calls[0][1],'/work/useful-heading.md');assert.deepEqual(f.calls.at(-1),['write','/work/new.md','# Useful heading',false]);
});
test('HTML detached Save As suggests .html but writes only the confirmed literal path and exact current HTML bytes',async()=>{
 const f=suggestionHarness({sourceState:{source:'import',label:'Generated.studio.html',path:null},choice:'/work/literal%20#?.html'});f.c.sourceTextEl.value='<!doctype html>\n# This is authored HTML, not a Markdown heading';await f.c.openEditorSaveAsDialog();assert.equal(f.calls[0][1],'/work/generated-studio.html');assert.deepEqual(f.calls.at(-1),['write','/work/literal%20#?.html',f.c.sourceTextEl.value,false]);
});
test('backed Save As retains current path; annotated draft uses captured origin name and explicit override wins',async()=>{
 const file=suggestionHarness({sourceState:{path:'/old/file.qmd'}});await file.c.openEditorSaveAsDialog();assert.equal(file.calls[0][1],'/old/file.qmd');
 const response=suggestionHarness({sourceState:{path:null,provenance:origin({annotated:true})}});await response.c.openEditorSaveAsDialog();assert.equal(response.calls[0][1],'/work/response-3-annotated.md');await response.c.openEditorSaveAsDialog({suggestedPath:'./explicit.md'});assert.equal(response.calls[2][1],'./explicit.md');
});
test('Save As cancellation or stale consent never writes or mutates current text',async()=>{
 for(const args of [{choice:null},{current:false}]){const f=suggestionHarness(args);await f.c.openEditorSaveAsDialog();assert(!f.calls.some(c=>c[0]==='write'));assert.equal(f.c.sourceTextEl.value,'# Useful heading');}
});
test('busy, watched, closed and modal readers cannot open a draft Save dialog',async()=>{
 for(const key of ['uiBusy','isWatchedFilePreview','bufferPageClosed','modal']){const f=suggestionHarness();if(key==='modal')f.c.studioModalBlocksDraftAction=()=>true;else f.c[key]=true;await f.c.openEditorSaveAsDialog();assert.deepEqual(f.calls,[]);}
});

test('source normalization and setter explicitly preserve provenance; reset/import replacements do not inherit it',()=>{
 const c=vm.createContext({editorDraftHelpers:helpers()});vm.runInContext(section('      function normalizeWorkspaceSourceState(value)','      function getWorkspaceStateIdentity('),c);assert.deepEqual(JSON.parse(JSON.stringify(c.normalizeWorkspaceSourceState({source:'last-response',provenance:origin()}))).provenance,origin());assert(!Object.hasOwn(c.normalizeWorkspaceSourceState({source:'blank'}),'provenance'));
 assert.match(section('      function setSourceState(next, options)','      function normalizeWorkspaceSourceState(value)'),/next\.provenance/);
 assert.match(section('        if (message.type === "saved")','        if (message.type === "pi_editor_draft_result")'),/provenance/);
});
test('File details describe persisted source while draft filename remains plain and undotted',()=>{
 const c=vm.createContext({studioUiRefreshUi:{filenameButton:{},pathDetails:{}},sourceState:{path:null,provenance:origin({annotated:true})},editorDraftHelpers:helpers(),editorDiffersFromFileBackedBaseline:()=>true});vm.runInContext(section('      function syncStudioWorkspaceFilename()','      function setupStudioUiRefreshPrototype()'),c);c.syncStudioWorkspaceFilename();assert.equal(c.studioUiRefreshUi.filenameButton.textContent,'Untitled');assert.match(c.studioUiRefreshUi.pathDetails.textContent,/Not saved to a file/);assert.match(c.studioUiRefreshUi.pathDetails.textContent,/Loaded from response 3 for annotation/);assert.match(c.studioUiRefreshUi.pathDetails.title,/response-id-3/);
});
