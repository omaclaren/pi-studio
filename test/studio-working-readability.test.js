// Actual Working formatter/state/controller helpers. No SDK/provider/REPL.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=fs.readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8'),css=fs.readFileSync(new URL('../client/studio.css',import.meta.url),'utf8'),index=fs.readFileSync(new URL('../index.ts',import.meta.url),'utf8');
function section(a,b){const x=source.indexOf(a),y=source.indexOf(b,x);assert(x>=0&&y>x,'missing '+a);return source.slice(x,y);}
const escape=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
class Node{constructor(key='',open=false){this.key=key;this.open=open;this.attrs={'data-trace-details-key':key,'data-trace-expected-open':String(open)};this.isConnected=true;this.tagName='DETAILS';this.editable=false;}matches(s){return s==='details[data-trace-details-key]';}getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}closest(){return this.editable?this:null;}}
function fixture(){const nodes=[],c={studioUiRefreshUi:null,document:{activeElement:null},traceStepsShownOpen:new Set(),traceStepsPaused:false,traceOwnScrollTop:null,traceStepsFolded:false,Element:Node,traceExpandedOutputs:new Set(),traceOpenDetails:new Set(),traceClosedDetails:new Set(),traceSectionDefaults:new Map(),traceAutoScroll:true,TRACE_OUTPUT_PREVIEW_MAX_LINES:50,TRACE_OUTPUT_PREVIEW_MAX_CHARS:8000,TRACE_SECTION_AUTO_OPEN_MAX_LINES:6,TRACE_SECTION_AUTO_OPEN_MAX_CHARS:600,rightView:'trace',readerActive:false,modal:false,escapeHtml:escape,formatCompactNumber:x=>String(x),normalizeFenceLanguage:x=>x,wrapHighlight:(cls,x)=>`<span class='${cls}'>${escape(x)}</span>`,EMPTY_OVERLAY_LINE:'',critiqueViewEl:{querySelectorAll:()=>nodes,contains:n=>nodes.includes(n)||n.inPane},studioLinkedReaderIsActive:()=>c.readerActive,studioModalBlocksDraftAction:()=>c.modal,isTextEntryShortcutTarget:n=>n?.editable===true,normalizeTraceImage:()=>null,renderTraceImages:()=>'',formatReferenceTime:x=>String(x||''),normalizeTraceFilter:x=>x||'all',traceFilter:'all',traceDisplayContext:{},traceState:{status:'running',entries:[]},createEmptyTraceState:()=>({status:'idle',entries:[]}),getTraceHistoryContextLabel:()=>'',buildVisibleWorkingText:()=> 'retained Working text'};
 c.getTraceEntriesForFilter=()=>c.traceState.entries;c.renderTraceViewIfActive=()=>{};vm.createContext(c);vm.runInContext(section('function formatTraceOutputSize(','function renderTraceImages('),c);vm.runInContext(section('function highlightCodeTokens(','function getEditorLanguageForPreview('),c);vm.runInContext(section('function handleTraceDetailsToggle(','function handleReplPaneClick('),c);vm.runInContext(section('function buildTracePanelHtml(','function renderTraceView('),c);return {c,nodes};}
const tool=(changes={})=>({id:'tool-one',type:'tool',toolName:'codemode',label:'Execute JavaScript',args:JSON.stringify({code:'  const value = 3;\n  console.log(value);'}),output:'3\n',images:[],status:'complete',isError:false,startedAt:1000,updatedAt:2250,...changes});
test('codemode JSON wrapper becomes Code with exact indentation and modest escaped JavaScript highlighting',()=>{const {c}=fixture(),entry=tool(),p=c.getTraceToolInputPresentation(entry);assert.equal(p.label,'Code');assert.equal(p.language,'javascript');assert.equal(p.text,'  const value = 3;\n  console.log(value);');const html=c.renderTraceToolInput(entry);assert.match(html,/hl-code-kw/);assert.match(html,/  <span/);assert(!html.includes('&quot;code&quot;'));assert(!html.includes('data-repl-action'));assert(!html.includes('textarea'));});
test('namespaced and raw codemode input retain literal source; unknown tool JSON stays Input',()=>{const {c}=fixture();for(const toolName of ['codemode','functions.codemode']){const p=c.getTraceToolInputPresentation(tool({toolName,args:'  await tools.read({path: "x"});\n'}));assert.equal(p.text,'  await tools.read({path: "x"});\n');assert.equal(p.label,'Code');}assert.equal(c.getTraceToolInputPresentation(tool({toolName:'unknown',args:'{"code":"example"}'})).label,'Input');});
test('codemode extra fields are not silently discarded; source is escaped rather than executed',()=>{const {c}=fixture();const html=c.renderTraceToolInput(tool({args:JSON.stringify({code:'  const x = "</pre><script>bad()</script>";',metadata:'kept'})}));assert(!html.includes('<script>'));assert(html.includes('&lt;'));assert(html.includes('metadata'));assert(html.includes('kept'));});
test('short section defaults visible and long section compact with summary/line count, independently',()=>{const {c}=fixture();assert.equal(c.traceSectionIsOpen('a','one\ntwo'),true);assert.equal(c.traceSectionIsOpen('b','x'.repeat(601)),false);assert.equal(c.traceSectionIsOpen('b',Array(8).fill('x').join('\n')),false);const html=c.buildTracePanelHtml.call(c);assert(html.includes('trace-toolbar'));c.traceState.entries=[tool({output:Array(15).fill('line').join('\n')})];const cards=c.buildTracePanelHtml();assert(cards.includes('Code ·'));assert(cards.includes('Output ·'));assert(cards.includes('15 lines'));assert(!cards.includes("data-trace-details-key='tool-one:output' data-trace-expected-open='true'"));});
test('native initial-open toggle does not invent a user expansion or stop streaming Follow',()=>{const {c,nodes}=fixture(),node=new Node('a',true);nodes.push(node);c.handleTraceDetailsToggle({target:node});assert.equal(c.traceOpenDetails.size,0);assert.equal(c.traceClosedDetails.size,0);assert.equal(c.traceAutoScroll,true);});
test('explicit collapse and expansion survive streamed text growth and never affect the other section',()=>{const {c,nodes}=fixture(),node=new Node('tool-one:input',true);nodes.push(node);node.open=false;c.handleTraceDetailsToggle({target:node});assert(c.traceClosedDetails.has(node.key));assert.equal(c.traceSectionIsOpen(node.key,'short'),false);assert.equal(c.traceSectionIsOpen('tool-one:output','short'),true);node.open=true;c.handleTraceDetailsToggle({target:node});assert.equal(c.traceSectionIsOpen(node.key,'x'.repeat(50000)),true);assert(!c.traceClosedDetails.has(node.key));assert.equal(c.traceAutoScroll,false);});
test('summary activation commits explicit choice synchronously before a streaming rerender can detach the node',()=>{const {c,nodes}=fixture(),detail=new Node('stream:input',false),summary=new Node();summary.tagName='SUMMARY';summary.parentElement=detail;summary.closest=s=>s==='summary'?summary:null;nodes.push(detail,summary);c.handleTracePaneClick({target:summary,defaultPrevented:false,preventDefault(){}});assert(c.traceOpenDetails.has(detail.key));assert.equal(c.traceSectionIsOpen(detail.key,'x'.repeat(50000)),true);detail.isConnected=false;detail.open=true;c.handleTraceDetailsToggle({target:detail});assert(c.traceOpenDetails.has(detail.key));});
test('queued toggles from detached/foreign/reader nodes cannot change current Working choices',()=>{for(const kind of ['detached','foreign','reader','view']){const {c,nodes}=fixture(),node=new Node('a',true);if(kind!=='foreign')nodes.push(node);node.open=false;if(kind==='detached')node.isConnected=false;if(kind==='reader')c.readerActive=true;if(kind==='view')c.rightView='preview';c.handleTraceDetailsToggle({target:node});assert.equal(c.traceClosedDetails.size,0,kind);}});
test('Collapse/Expand affects only currently displayed details, not hidden-filter choices or full-output bounds',()=>{const {c,nodes}=fixture();nodes.push(new Node('shown-input',true),new Node('shown-output',false));c.traceOpenDetails.add('hidden');c.traceExpandedOutputs.add('shown-output');c.setTraceVisibleDetails(false);assert(nodes.every(n=>!n.open));assert(c.traceOpenDetails.has('hidden'));assert(c.traceExpandedOutputs.has('shown-output'));c.setTraceVisibleDetails(true);assert(nodes.every(n=>n.open));assert.equal(c.traceAutoScroll,false);assert(nodes.every(n=>n.getAttribute('data-trace-expected-open')==='true'));});
test('bulk toolbar controls preserve filters/copy/load and do not add a whole-card nesting layer',()=>{const {c}=fixture();c.traceState.entries=[tool()];const html=c.buildTracePanelHtml();for(const action of ['collapse','expand','copy','load'])assert(html.includes(`data-trace-action='${action}'`));for(const filter of ['all','messages','thinking','tools'])assert(html.includes(`data-trace-filter='${filter}'`));assert(!html.includes('<details class=\'trace-card'));assert(html.includes("<article class='trace-card trace-card-tool'"));});
test('full/preview remains bounded separately from fold expansion and highlighting escapes truncation',()=>{const {c}=fixture(),text='  const x = "<script>";\n'.repeat(1000);const preview=c.renderTraceOutput(text,'a',{label:'Code',language:'javascript'});assert(preview.includes('Show full code'));assert(!preview.includes('<script>'));c.traceExpandedOutputs.add('a');const full=c.renderTraceOutput(text,'a',{label:'Code',language:'javascript'});assert(full.includes('Collapse code'));assert(full.length>preview.length);});
test('collapsed errors remain explicit and red even when entry status is complete; timing/tool/status are retained',()=>{const {c}=fixture();c.traceState.entries=[tool({isError:true,status:'complete',output:'failure\n'.repeat(100)})];const html=c.buildTracePanelHtml();assert(html.includes('trace-entry-status-error'));assert(html.includes('Error'));assert(html.includes('codemode'));assert(html.includes('1.3s'));assert(html.includes('is-error'));assert(html.includes('Output ·'));});
test('explicit error status remains an error even without the separate error flag',()=>{const {c}=fixture();c.traceState.entries=[tool({isError:false,status:'error',output:'Failure fixture\n'.repeat(100)})];const html=c.buildTracePanelHtml();assert(html.includes('trace-entry-status-error'));assert(html.includes('is-error'));assert(html.includes('Output · Error'));assert(!html.includes('>Complete</span>'));});
function keyEvent(target,changes={}){return {target,ctrlKey:true,shiftKey:true,metaKey:false,altKey:false,code:'BracketLeft',key:'{',repeat:false,isComposing:false,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...changes};}
test('Control+Shift+[ / ] is Working-content local, keyboard accessible and excludes editors/modal/reader/composition/repeats',()=>{const {c,nodes}=fixture(),n=new Node('a',true);nodes.push(n);const collapse=keyEvent(n);c.handleTracePaneKeydown(collapse);assert(collapse.defaultPrevented);assert.equal(n.open,false);const expand=keyEvent(n,{code:'BracketRight',key:'}'});c.handleTracePaneKeydown(expand);assert(expand.defaultPrevented);assert.equal(n.open,true);for(const change of [{repeat:true},{isComposing:true},{metaKey:true},{altKey:true},{ctrlKey:false},{shiftKey:false},{defaultPrevented:true},{code:'KeyC',key:'C'}]){const e=keyEvent(n,change);c.handleTracePaneKeydown(e);assert.equal(n.open,true);}for(const condition of ['editable','outside','reader','modal','view']){n.open=true;const target=condition==='outside'?new Node('other'):n;n.editable=condition==='editable';c.readerActive=condition==='reader';c.modal=condition==='modal';c.rightView=condition==='view'?'repl':'trace';const e=keyEvent(target);c.handleTracePaneKeydown(e);assert.equal(n.open,true,condition);assert.equal(e.defaultPrevented,false,condition);}});
test('output images remain inside their own fold and existing image policy is retained',()=>{const {c}=fixture();c.renderTraceImages=()=>'<div class="trace-image-gallery">image preserved</div>';c.traceState.entries=[tool({output:'',images:[{label:'fixture'}]})];const html=c.buildTracePanelHtml();assert(html.includes('image preserved'));assert(html.includes('1 image'));assert(html.includes("data-trace-details-key='tool-one:output'"));});
test('single-image output retains text-size default and then its first-content pin; multiple images start compact',()=>{
 const {c}=fixture(),long='long image caption\n'.repeat(75);
 assert(c.renderTraceSection('Output',long,'one-long','',{imageCount:1}).includes("data-trace-expected-open='false'"));
 assert(c.renderTraceSection('Output','short','one-long','',{imageCount:1}).includes("data-trace-expected-open='false'"));
 assert(c.renderTraceSection('Output','short','one-short','',{imageCount:1}).includes("data-trace-expected-open='true'"));
 assert(c.renderTraceSection('Output','short','many','',{imageCount:2}).includes("data-trace-expected-open='false'"));
});
test('code whitespace selector outranks rendered-markdown pre without changing general output wrapping',()=>{assert(css.includes(".trace-output.trace-output-code {"));});
test('nested Raw, Write and Edit disclosures mark parser state and preserve explicit collapse over full output',()=>{
 const {c,nodes}=fixture(),text='line\n'.repeat(70);
 const cases=[['raw:raw-input',()=>c.renderTraceRawInputDetails(text,'raw'),['raw:raw-input']],['write:content',()=>c.renderTraceToolTextDetails('Content',text,'write:content','Content'),['write:content']],['edit:edit:0',()=>c.renderTraceEditInput({id:'edit'},{edits:[{oldText:text,newText:text}]},'{}'),['edit:edit:0:old','edit:edit:0:new']]];
 for(const [key,render,fullKeys] of cases){
  c.traceOpenDetails.add(key);let html=render();const marker=`data-trace-details-key='${key}' data-trace-expected-open='true' open`;
  assert(html.includes(marker),key+' must mark remembered-open parser insertion');
  const n=new Node(key,true);n.attrs['data-trace-expected-open']=html.includes(marker)?'true':null;nodes.push(n);c.traceAutoScroll=true;c.handleTraceDetailsToggle({target:n});assert.equal(c.traceAutoScroll,true,key+' parser toggle cannot stop Follow');
  for(const k of fullKeys)c.traceExpandedOutputs.add(k);c.setTraceVisibleDetails(false);html=render();assert(html.includes(`data-trace-details-key='${key}' data-trace-expected-open='false'>`),key+' full output must not undo collapse');
  c.setTraceVisibleDetails(true);assert(render().includes(marker));
 }
});
test('untouched streaming sections keep their first-content default through growth and shrink, independently',()=>{
 const {c}=fixture();assert.equal(c.traceSectionIsOpen('live','short'),true);assert.equal(c.traceSectionIsOpen('live','x'.repeat(20000)),true);
 assert.equal(c.traceSectionIsOpen('complete','x'.repeat(20000)),false);assert.equal(c.traceSectionIsOpen('complete','short'),false);
 c.traceClosedDetails.add('live');assert.equal(c.traceSectionIsOpen('live','short'),false);c.traceClosedDetails.delete('live');assert.equal(c.traceSectionIsOpen('live','long'.repeat(1000)),true);
});
test('pending empty output does not freeze the default before actual text or images arrive',()=>{
 const {c}=fixture();c.renderTraceSection('Output','','pending','',{pending:true});assert.equal(c.traceSectionDefaults.has('pending'),false);
 c.renderTraceSection('Output','x'.repeat(20000),'pending','',{pending:true});assert.equal(c.traceSectionIsOpen('pending','short'),false);
 c.renderTraceSection('Output','','image','',{imageCount:1,pending:true});assert.equal(c.traceSectionDefaults.get('image'),true);
 assert(c.renderTraceSection('Output','','image','',{imageCount:3}).includes("data-trace-expected-open='true'"));
});
test('new run clears cached initial defaults together with explicit choices; same run keeps them',()=>{
 const {c}=fixture();c.normalizeTraceState=x=>x;vm.runInContext(section('function replaceTraceState(','function upsertTraceEntry('),c);
 c.traceState.runId='old';c.traceSectionIsOpen('section','short');c.traceOpenDetails.add('explicit');
 c.replaceTraceState({runId:'old',entries:[]});assert.equal(c.traceSectionDefaults.get('section'),true);assert(c.traceOpenDetails.has('explicit'));
 c.replaceTraceState({runId:'new',entries:[]});assert.equal(c.traceSectionDefaults.size,0);assert.equal(c.traceOpenDetails.size,0);assert.equal(c.traceSectionIsOpen('section','long'.repeat(5000)),false);
});
test('new-run reset and keyboard wiring preserve existing state/filter/shortcut ownership',()=>{assert.match(section('function replaceTraceState(','function upsertTraceEntry('),/traceClosedDetails\.clear\(\)/);assert(source.includes('addEventListener("keydown", handleTracePaneKeydown)'));assert.match(index,/Control.*Shift.*\[/);assert.match(css,/\.trace-output-code/);assert.match(css,/white-space: pre;/);assert.match(css,/\.trace-section-fold\.is-error/);});

// Oliver, 27 Oct: in the new layout Working reads like agent-markdown-preview's page: one header line, the prompt
// first, and each step one numbered line, open while it runs or is the latest. The classic layout is unchanged.
const assistant=(changes={})=>({id:'a1',type:'assistant',thinking:'',text:'Answer',status:'complete',stopReason:null,startedAt:1000,updatedAt:2000,...changes});
const stepRe=(id,n,open)=>new RegExp(`<details class='trace-card [^']*trace-step' data-trace-details-key='step:${id}' data-trace-expected-open='${open}'${open?' open':''}><summary class='trace-card-header'><span class='trace-step-number'>${n}</span>`);
test('new layout: one header line, the prompt first, and steps as numbered lines open while running or latest',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};
  c.traceState={status:'running',runId:'run-1',prompt:'Check the repo\nand report',entries:[assistant({text:'Looking at <files>\nmore'}),tool({id:'t1'}),tool({id:'t2',status:'streaming',output:''})]};
  const html=c.buildTracePanelHtml();
  assert(!html.includes('trace-summary-badge'),'the pane is already called Working');assert(html.includes('>3 steps<'));assert(html.includes('>Running<'));
  assert(html.includes("<details class='trace-card trace-card-prompt trace-step' data-trace-details-key='prompt:run-1' data-trace-expected-open='true' open>"));
  const at=['trace-card-prompt','step:a1','step:t1','step:t2'].map(s=>html.indexOf(s));assert(at[0]>0);assert.deepEqual([...at].sort((a,b)=>a-b),at,'prompt, then the steps in order');
  assert.match(html,stepRe('a1',1,false));assert.match(html,stepRe('t1',2,false));assert.match(html,stepRe('t2',3,true));
  // Oliver, 29 Oct (option C): a step's line names its kind; a folded Assistant step adds its first line, a tool what it acted on.
  assert(html.includes("<span class='trace-step-number'>1</span><span class='trace-card-title'>Assistant</span><span class='trace-step-preview'>Looking at &lt;files&gt;</span><span class='trace-step-meta'>"),'escaped');
  assert(html.includes("<span class='trace-card-title'>codemode</span><span class='trace-step-detail'>Execute JavaScript</span><span class='trace-step-meta'><span class='trace-card-meta'>2250</span>"));
  assert(html.includes("<div class='trace-prompt-text'>Check the repo\nand report</div>"));
  assert(!html.includes("<article class='trace-card"),'no boxes inside a box');
});
test('new layout: a choice wins over the default, and a finished run opens only its last step',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};c.traceState={status:'running',runId:'r',prompt:null,entries:[assistant(),tool({id:'t1'}),tool({id:'t2',status:'streaming'})]};
  c.traceOpenDetails.add('step:a1');c.traceClosedDetails.add('step:t2');
  let html=c.buildTracePanelHtml();assert.match(html,stepRe('a1',1,true));assert.match(html,stepRe('t2',3,false));assert(!html.includes('trace-card-prompt'));
  c.traceOpenDetails.clear();c.traceClosedDetails.clear();c.traceState.status='complete';c.traceState.entries[2].status='complete';
  html=c.buildTracePanelHtml();assert.match(html,stepRe('a1',1,false));assert.match(html,stepRe('t1',2,false));assert.match(html,stepRe('t2',3,true));
  // A collapsed step still says it failed.
  c.traceState.entries[1]=tool({id:'t1',isError:true,status:'complete',output:'failure\n'.repeat(80)});html=c.buildTracePanelHtml();
  const t1=html.slice(html.indexOf("step:t1"),html.indexOf('</summary>',html.indexOf("step:t1")));assert(t1.includes('trace-entry-status-error')&&t1.includes('Error'));
});
test('new layout: a long prompt is one line with its start; the prompt shows under any filter and above an empty run',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};const long='First line of a long prompt\n'+'more\n'.repeat(20);
  c.traceState={status:'running',runId:'r2',prompt:long,entries:[tool({id:'t1'})]};
  let html=c.buildTracePanelHtml();assert(html.includes("data-trace-details-key='prompt:r2' data-trace-expected-open='false'>"));assert(html.includes("<span class='trace-step-preview'>First line of a long prompt</span>"));
  c.traceFilter='tools';html=c.buildTracePanelHtml();assert(html.includes('trace-card-prompt'));
  c.traceFilter='all';c.traceState.entries=[];html=c.buildTracePanelHtml();assert(html.includes('trace-card-prompt')&&html.includes("class='trace-empty'"));
  c.studioUiRefreshUi=null;c.traceState.entries=[tool()];html=c.buildTracePanelHtml();
  assert(!html.includes('trace-card-prompt')&&html.includes('trace-summary-badge')&&html.includes("<article class='trace-card trace-card-tool'"),'classic layout unchanged');
});
test('new layout: steps keep their whole-run numbers under Thinking and Tools',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);
  c.traceState={status:'complete',runId:'r3',prompt:null,entries:[assistant({id:'a1',thinking:'Considering',text:''}),tool({id:'t1'}),assistant({id:'a2',text:'Reply'}),tool({id:'t2'})]};
  c.traceFilter='tools';let html=c.buildTracePanelHtml();assert.match(html,stepRe('t1',2,false));assert.match(html,stepRe('t2',4,true));assert(!html.includes('step:a1'));
  c.traceFilter='thinking';html=c.buildTracePanelHtml();assert.match(html,stepRe('a1',1,true));assert(html.includes("<span class='trace-card-title'>Thinking</span><span class='trace-step-preview'>Considering</span>"));
});
test('the prompt rides on Working state, its status updates and its saved copy',()=>{
  assert.match(source,/prompt: normalizeTracePrompt\(raw\.prompt\),/);
  assert.equal(source.match(/if \(Object\.prototype\.hasOwnProperty\.call\(message, "prompt"\)\) state\.prompt = normalizeTracePrompt\(message\.prompt\);/g).length,2,'live and displayed status');
  assert.match(source,/\(studioUiRefreshUi && \(rightView === "editor-preview" \|\| rightView === "trace"\)\)/,'the line above Working is hidden in the new layout');
  assert.match(index,/prompt: studioTraceState\.prompt,\n\t\t\}\);/);
  // Cut once on arrival; the saved copy keeps that text and the flag, not a second cut (Sol, Astra).
  assert.match(index,/prompt: typeof source\.prompt === "string" \? source\.prompt : null,\n\t\t\tpromptTruncated: source\.promptTruncated === true,/);
  // The run's first user message, before any step; a later one is a steer step (Oliver, 29 Oct).
  assert.match(index,/const cut = userPrompt \? truncateStudioTraceSnapshotText\(userPrompt\) : null;\n\t\t\t\tif \(cut && first\) \{\n\t\t\t\t\tstudioTraceState\.prompt = cut\.text;\n\t\t\t\t\tstudioTraceState\.promptTruncated = cut\.truncated;/);
});
test('collapsing a step that holds the focus moves the focus to that step\'s own line',()=>{
  const {c,nodes}=fixture();
  // Pane > step (details) > section (details) > summary (focused).
  class El{constructor(tag,parent,key){this.tagName=tag;this.parentElement=parent;this.key=key;this.open=true;this.attrs={'data-trace-details-key':key};this.children=[];this.focused=0;this.isConnected=true;}
    matches(s){return s==='details[data-trace-details-key]'&&this.tagName==='DETAILS';}querySelector(s){return s===':scope > summary'?this.children.find(n=>n.tagName==='SUMMARY')||null:null;}
    setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}focus(){this.focused+=1;c.document.activeElement=this;}}
  const pane=new El('DIV',null),step=new El('DETAILS',pane,'step:t1'),stepLine=new El('SUMMARY',step),section=new El('DETAILS',step,'t1:input'),header=new El('SUMMARY',section);
  step.children.push(stepLine,section);section.children.push(header);
  c.Element=El;c.critiqueViewEl={querySelectorAll:()=>[step,section],contains:n=>n!==pane&&n instanceof El};c.document.activeElement=header;
  assert.equal(c.setTraceVisibleDetails(false),true);assert.equal(step.open,false);assert.equal(stepLine.focused,1);assert.equal(c.document.activeElement,stepLine);
  // Focus already on a step's own line stays put.
  stepLine.focused=0;assert.equal(c.setTraceVisibleDetails(false),true);assert.equal(stepLine.focused,0);
});
test('new layout: scrolled up to read, an open step stays open when the next one starts; following, it folds',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};
  c.traceState={status:'running',runId:'r4',prompt:null,entries:[tool({id:'t1',status:'streaming'})]};
  assert.match(c.buildTracePanelHtml(),stepRe('t1',1,true));
  c.traceState.entries=[tool({id:'t1'}),tool({id:'t2',status:'streaming'})];c.traceStepsPaused=true;
  let html=c.buildTracePanelHtml();assert.match(html,stepRe('t1',1,true),'kept open while the person reads');assert.match(html,stepRe('t2',2,true));
  c.traceStepsPaused=false;html=c.buildTracePanelHtml();assert.match(html,stepRe('t1',1,false),'folds once Working follows again');
  assert(source.includes('traceSectionDefaults.clear();\n          traceStepsShownOpen.clear();'),'a new run starts afresh');
});
test('a Bash step shows its command, not its JSON; other fields stay in Raw input',()=>{
  const {c}=fixture();
  const p=c.getTraceToolInputPresentation(tool({toolName:'bash',args:JSON.stringify({command:'npm test',timeout:60})}));
  assert.deepEqual([p.label,p.text,Boolean(p.extraInput)],['Command','npm test',true]);
  const html=c.renderTraceToolInput(tool({toolName:'bash',args:JSON.stringify({command:'npm test',timeout:60})}));
  const raw=html.indexOf("<details class='trace-tool-details trace-tool-raw-input'");assert(raw>0,'the timeout stays in Raw input');
  assert(html.slice(0,raw).includes('npm test')&&!html.slice(0,raw).includes('&quot;command&quot;'),'the command itself comes first');
  const plain=c.renderTraceToolInput(tool({toolName:'bash',args:JSON.stringify({command:'ls -la'})}));assert(!plain.includes('command&quot;')&&plain.includes('ls -la'));
  // Input that isn't JSON is shown as it was.
  assert(c.renderTraceToolInput(tool({toolName:'bash',args:'echo hi'})).includes('echo hi'));
});
test('Ctrl+Option+L goes to the latest response, also while editing on a Mac; the shortcuts list says so',()=>{
  assert.match(source,/if \(event\.ctrlKey && event\.altKey && !event\.metaKey && !event\.shiftKey && code === "KeyL"\n\s+&& \(isMacShortcutPlatform\(\) \|\| !isTextEntryShortcutTarget\(event\.target\)\)\) \{\n\s+event\.preventDefault\(\);\n\s+triggerResponseHistoryShortcut\("latest"\);/);
  assert(index.includes('<div><dt>Option/Alt+L, or Ctrl+Option/Alt+L</dt><dd>Latest response when not editing text; Ctrl+Option+L also while editing on a Mac</dd></div>'));
});
test('new layout: Copy visible and Load include the prompt shown first, and are available when it is all there is',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};c.describeTraceImageForText=()=>'';
  vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);
  vm.runInContext(section('function buildVisibleWorkingText(','function getWorkingDocumentLabel('),c);
  c.traceState={status:'running',runId:'r6',prompt:'Check the repo',entries:[assistant({text:'Done.'})]};
  assert.equal(c.buildVisibleWorkingText('all'),'Prompt:\nCheck the repo\n\n---\n\nAssistant\n\n[Response]\nDone.');
  c.traceState.entries=[];assert.equal(c.buildVisibleWorkingText('all'),'Prompt:\nCheck the repo');
  const html=c.buildTracePanelHtml();assert(html.includes("data-trace-action='copy'")&&!/data-trace-action='copy'[^>]*disabled/.test(html),'available with only the prompt');
  assert(!html.includes("data-trace-action='load'"),'the new layout has Copy only (Oliver, 29 Oct)');
  c.studioUiRefreshUi=null;assert.equal(c.buildVisibleWorkingText('all'),'','the classic layout shows no prompt and copies none');
});
test('new layout: scrolled up, a filter round trip folds nothing (Astra)',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);
  c.traceState={status:'running',runId:'r7',prompt:null,entries:[assistant({id:'a1',thinking:'Considering',text:'Plan'}),tool({id:'t1',status:'streaming'})]};
  assert.match(c.buildTracePanelHtml(),stepRe('t1',2,true));
  c.traceState.entries=[assistant({id:'a1',thinking:'Considering',text:'Plan'}),tool({id:'t1'}),assistant({id:'a2',thinking:'Next',text:'',status:'streaming'})];c.traceStepsPaused=true;
  assert.match(c.buildTracePanelHtml(),stepRe('t1',2,true),'kept open while paused');
  c.traceFilter='thinking';assert(!c.buildTracePanelHtml().includes('step:t1'));
  c.traceFilter='all';assert.match(c.buildTracePanelHtml(),stepRe('t1',2,true),'still open after All → Thinking → All');
  c.traceStepsPaused=false;assert.match(c.buildTracePanelHtml(),stepRe('t1',2,false),'folds once Working follows');
});
test('only the person\'s own scrolling in a pane that scrolls pauses or resumes folding; a short filtered list does neither (Sol)',()=>{
  const {c}=fixture();const pane={scrollHeight:2000,clientHeight:400,scrollTop:0};c.critiqueViewEl=pane;
  let atBottom=false;c.shouldStickTraceToBottom=()=>atBottom;c.replFollow=true;
  vm.runInContext(section('function handleTracePaneScroll(','function handleTraceDetailsToggle('),c);
  c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,true,'scrolled up in a pane that scrolls');
  pane.scrollHeight=380;atBottom=true;c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,true,'a short list (Thinking) is "at the bottom" but ends nothing');
  assert.equal(c.traceAutoScroll,true,'scrolling may still stick to the bottom');
  pane.scrollHeight=2000;atBottom=true;c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,false,'back at the bottom of a pane that scrolls');
  assert.match(source,/traceStepsShownOpen\.clear\(\);\n\s+traceStepsPaused = false;/,'a new run starts unpaused');
  assert.match(source,/traceStepIsOpen\(key, !traceStepsFolded && \(typeof settings\.openByDefault === "boolean" \? settings\.openByDefault\n\s+: \(running \|\| entry\.id === latestId \|\| \(traceStepsPaused && traceStepsShownOpen\.has\(key\)\)\)\)\)/);
});
test('Studio\'s own scroll to the bottom, as on returning to All from a short list, leaves the pause alone (Sol, round 3)',()=>{
  const {c}=fixture();const pane={scrollHeight:2000,clientHeight:400,top:0,get scrollTop(){return this.top;},set scrollTop(v){this.top=Math.max(0,Math.min(v,this.scrollHeight-this.clientHeight));},set innerHTML(v){},classList:{remove(){}}};
  c.critiqueViewEl=pane;c.replFollow=true;
  for(const name of ['finishPreviewRender','decoratePreviewImages','scheduleResponsePaneRepaintNudge'])c[name]=()=>{};
  vm.runInContext(section('function handleTracePaneScroll(','function handleTraceDetailsToggle('),c);
  vm.runInContext(section('function shouldStickTraceToBottom(','function getActiveReplJournalSessionName('),c);
  vm.runInContext(section('function renderTraceView(','function renderReplView('),c);c.buildTracePanelHtml=()=>'';
  pane.scrollTop=200;c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,true,'the person scrolls up to read');
  c.traceAutoScroll=true;c.renderTraceView();assert.equal(pane.scrollTop,1600,'Studio sticks to the bottom');
  c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,true,'its scroll event is Studio\'s, not the person\'s');
  pane.scrollHeight=2200;c.renderTraceView();assert.equal(pane.scrollTop,1800);c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,true,'still paused at the next streamed update');
  pane.scrollTop=900;c.handleTracePaneScroll();pane.scrollTop=1800;c.handleTracePaneScroll();assert.equal(c.traceStepsPaused,false,'the person scrolls back to the bottom');
  pane.scrollTop=200;c.handleTracePaneScroll();pane.scrollTop=1800;c.renderTraceView();c.handleTracePaneScroll();
  assert.equal(c.traceStepsPaused,false,'a render that doesn\'t move the pane claims no scroll: the person\'s own still counts');
});
// Oliver, 28 Oct: Collapse all holds for steps that start later; sections are open in an open step; an Assistant
// step's title is its first line in plain words; Working is lit like agent-markdown-preview's page.
test('new layout: Collapse all folds the steps and the prompt, not what\'s inside them, and later steps arrive folded until Expand all',()=>{
  const {c,nodes}=fixture();c.studioUiRefreshUi={};
  const step=(key,open)=>Object.assign(new Node(key,open),{step:true});
  nodes.push(step('prompt:r1',true),step('step:a1',true),new Node('a1:thinking',true));
  c.critiqueViewEl.querySelectorAll=sel=>sel.startsWith('details.trace-step')?nodes.filter(n=>n.step):nodes;
  c.traceState={status:'running',runId:'r1',prompt:null,entries:[assistant({id:'a1',thinking:'Considering'})]};
  c.setTraceVisibleDetails(false);
  assert.deepEqual(nodes.map(n=>n.open),[false,false,true],'the section inside keeps its state');
  assert(c.traceClosedDetails.has('step:a1')&&!c.traceClosedDetails.has('a1:thinking'));assert.equal(c.traceStepsFolded,true);
  c.traceState.entries.push(tool({id:'t2',status:'streaming',output:''}));let html=c.buildTracePanelHtml();
  assert.match(html,stepRe('t2',2,false),'a step that starts after Collapse all arrives folded, though running and latest');
  assert(html.includes("data-trace-details-key='t2:output' data-trace-expected-open='true'"),'its sections are open for when it is opened');
  c.traceOpenDetails.add('step:t2');assert.match(c.buildTracePanelHtml(),stepRe('t2',2,true),'opening one by hand still opens it');
  c.setTraceVisibleDetails(true);assert.equal(c.traceStepsFolded,false);assert(nodes.every(n=>n.open),'Expand all opens everything');
  c.traceState.entries.push(tool({id:'t3',status:'streaming',output:''}));assert.match(c.buildTracePanelHtml(),stepRe('t3',3,true),'after Expand all, the usual rule');
  c.setTraceVisibleDetails(false);c.normalizeTraceState=x=>x;vm.runInContext(section('function replaceTraceState(','function upsertTraceEntry('),c);
  c.replaceTraceState({status:'running',runId:'r2',prompt:null,entries:[tool({id:'n1',status:'streaming',output:''})]});
  assert.equal(c.traceStepsFolded,false);assert.match(c.buildTracePanelHtml(),stepRe('n1',1,true),'a new run starts unfolded');
  const old=fixture();old.nodes.push(new Node('a1:thinking',true));old.c.critiqueViewEl.querySelectorAll=sel=>{assert.equal(sel,'details[data-trace-details-key]');return old.nodes;};
  old.c.setTraceVisibleDetails(false);assert.equal(old.nodes[0].open,false,'the earlier layout still folds every section');assert.equal(old.c.traceStepsFolded,false);
});
test('new layout: a section is open whenever its step is, whatever its length, unless the person folds it; the earlier layout keeps its length rule',()=>{
  const {c}=fixture(),long='x'.repeat(2000),many=Array(40).fill('line').join('\n');
  c.studioUiRefreshUi={};
  for(const [key,text,images] of [['k1',long,0],['k2',many,0],['k3','',3]])assert(c.renderTraceSection('Output',text,key,'',{imageCount:images}).includes("data-trace-expected-open='true'"),key);
  c.traceClosedDetails.add('k4');assert(c.renderTraceSection('Thinking',long,'k4','').includes("data-trace-expected-open='false'"),'the person\'s fold wins');
  c.studioUiRefreshUi=null;assert(c.renderTraceSection('Thinking',long,'k5','').includes("data-trace-expected-open='false'"));
});
test('new layout: an Assistant step\'s line adds its first line in plain words, open or folded; Thinking and Response read as prose',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};
  for(const [text,title] of [['**Inspecting alias settings**\n\nI need to check','Inspecting alias settings'],['\n## Plan\nx','Plan'],['- run `npm test` first','run npm test first'],['See [the docs](http://x) now','See the docs now'],['**Inspect','Inspect'],['snake_case_name and a*b*c','snake_case_name and a*b*c'],['x'.repeat(400),'x'.repeat(300)],
    // Astra, c100: code spans keep their text, underscores are left alone, and leading markers go however many there are.
    ['`__init__` prepares the object','__init__ prepares the object'],['Editing __init__.py','Editing __init__.py'],['`**kwargs` passes through','**kwargs passes through'],
    ['> ## Heading','Heading'],['**bold** and `code` and **more**','bold and code and more']])assert.equal(c.plainTraceTitle(text),title);
  c.traceState={status:'complete',runId:'r1',prompt:null,entries:[assistant({id:'a1',thinking:'**Inspecting alias settings**\n\nMore.',text:''}),assistant({id:'a2',text:'Done.'})]};
  let html=c.buildTracePanelHtml();
  const line="<span class='trace-card-title'>Assistant</span><span class='trace-step-preview'>Inspecting alias settings</span>";
  assert.match(html,stepRe('a1',1,false));assert(html.includes(line),'folded');
  c.traceOpenDetails.add('step:a1');html=c.buildTracePanelHtml();assert.match(html,stepRe('a1',1,true));assert(html.includes(line),'open too');
  assert.equal(html.match(/trace-output trace-output-prose/g).length,2,'the Thinking and the Response');
  assert(html.includes('<strong>Inspecting alias settings</strong>\n\nMore.'),'Thinking\'s bold line reads as a heading');
  assert(!c.renderTraceOutput('ls','t1:input',{label:'Command'}).includes('trace-output-prose'),'code and output stay monospaced');
  c.studioUiRefreshUi=null;html=c.buildTracePanelHtml();assert(!html.includes('trace-card-title')&&!html.includes('<strong>'),'the earlier layout is unchanged');
});
test('new layout CSS: steps are the light surface on the pane\'s page colour, with no frames inside them; a step\'s line is its kind in bold, the time on the right',()=>{
  for(const rule of ['body.studio-workspace-layout #critiqueView:has(> .trace-panel) { background: var(--bg); }',
    'body.studio-workspace-layout details.trace-step { border-color: var(--panel-border); background: var(--panel); box-shadow: none; }',
    'body.studio-workspace-layout details.trace-step > .trace-step-body { gap: 4px; border-top: 1px solid var(--panel-border); padding: 8px 14px 10px; }',
    'body.studio-workspace-layout .trace-step .trace-image-gallery { border: 0; border-radius: 0; background: transparent; padding-left: 0; padding-right: 0; }',
    'body.studio-workspace-layout .trace-prompt-text { font-family: inherit; line-height: 1.5; }',
    'body.studio-workspace-layout details.trace-step > summary > .trace-step-detail { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 12px; }',
    'body.studio-workspace-layout details.trace-step > summary > .trace-step-meta { margin-left: auto; padding-left: 8px; display: inline-flex; align-items: baseline; gap: 8px; }',
    'body.studio-workspace-layout .trace-step .trace-section-fold:not(.is-error) > summary { color: var(--muted); }',
    'body.studio-workspace-layout .trace-section-metrics { font-weight: 400; }',
    'body.studio-workspace-layout .trace-step code.trace-tool-field-value { padding: 0; border: 0; background: transparent; }',
    'body.studio-workspace-layout .trace-step .trace-output-truncation { padding: 4px 0; background: transparent; }'])assert(css.includes(rule),rule);
  assert(!css.includes('.trace-card-assistant > summary > .trace-card-title { font-weight: 400; }'),'an Assistant step\'s kind is bold like any other');
});
test('Working shows a tool\'s output without terminal colour codes, hyperlinks or a code cut off by a streamed update; the text stays',()=>{
  const c={parseFiniteNumber:Number,parseNonEmptyString:x=>typeof x==='string'&&x.trim()?x:null,normalizeTraceEntryStatus:x=>x,normalizeTraceImage:x=>x};vm.createContext(c);
  vm.runInContext(section('const TRACE_TERMINAL_CODE_RE','function normalizeTraceState('),c);
  const E='\u001b',B='\u0007';
  for(const [raw,shown] of [[E+'[0;32mdefault'+E+'[0m '+E+'[0;90m->'+E+'[0m '+E+'[0;32m22'+E+'[0m','default -> 22'],[E+'[38;2;255;0;0mred'+E+'[39m and '+E+'[1mbold'+E+'[22m','red and bold'],
    [E+']8;;https://example.org'+B+'link'+E+']8;;'+B+' text',  'link text'],[E+']8;;https://example.org'+E+'\\link'+E+']8;;'+E+'\\ text','link text'],['progress'+E+'[2K'+E+'[1G done','progress done'],
    ['cut'+E+'[0;3','cut'],['cut'+E+']8;;https://unfinished','cut'],['cut'+E+'[0;3\n\nnext','cut\n\nnext'],['stray '+E+'x and '+B+'bell','stray x and bell'],['charset '+E+'(Bok','charset ok'],
    // Sol, c100 round 2: a hyperlink cut off by a saved snapshot's omission stops at its line, keeping the notice and what follows.
    ['prev'+E+']8;;https://exa\n\n… 23000 chars omitted …\n\nwarning: kept\n'+E+']8;;https://e.org'+B+'file.js'+E+']8;;'+B+': warning','prev\n\n… 23000 chars omitted …\n\nwarning: kept\nfile.js: warning'],['plain [brackets], ;semicolons; and \\x1b as text','plain [brackets], ;semicolons; and \\x1b as text'],['line\r\nnext','line\r\nnext']])
    assert.equal(c.stripTraceTerminalCodes(raw),shown,JSON.stringify(raw));
  const entry=c.normalizeTraceEntry({type:'tool',id:'t1',toolName:'bash',args:JSON.stringify({command:'nvm ls'}),output:E+'[0;32mdefault'+E+'[0m',status:'complete'},0);
  assert.equal(entry.output,'default','the entry Working renders, counts, copies and loads');
  assert.equal(c.normalizeTraceEntry({type:'assistant',id:'a1',text:'Use '+E+'[1m?',status:'complete'},0).text,'Use '+E+'[1m?','only a tool\'s output');
});
test('saved Working: a hyperlink cut off by the snapshot\'s omission keeps the notice and every retained line, through the server snapshot, the client and Copy/Load (Sol, c100 round 2)',()=>{
  const start=index.indexOf('function truncateStudioTraceSnapshotText('),end=index.indexOf('\nfunction summarizeStudioTraceSnapshot(',start);assert(start>=0&&end>start);
  const server={};vm.createContext(server);
  for(const name of ['STUDIO_TRACE_SNAPSHOT_MAX_ENTRIES','STUDIO_TRACE_SNAPSHOT_MAX_FIELD_CHARS','STUDIO_TRACE_SNAPSHOT_MAX_IMAGES','STUDIO_TRACE_SNAPSHOT_MAX_IMAGE_BASE64_CHARS'])
    vm.runInContext(index.match(new RegExp('^const '+name+' = [\\d_]+;','m'))[0].replace('const ','var '),server);
  Object.assign(server,{normalizeStudioTraceImageMimeType:x=>x,isStudioTraceSafeImageMimeType:()=>true,estimateStudioTraceBase64ByteLength:x=>x.length});
  vm.runInContext(ts.transpileModule(index.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,server);
  const E='\u001b',B='\u0007',line=E+']8;;https://example.org/aaaaaaaaaa.js'+B+'file.js'+E+']8;;'+B+': warning: check this source line\n';
  const tool={id:'t1',type:'tool',toolCallId:'c1',toolName:'bash',label:'Lint',args:JSON.stringify({command:'lint'}),output:line.repeat(500),images:[],status:'complete',isError:false,startedAt:1,updatedAt:2};
  const saved=server.createStudioTraceSnapshot({runId:'r1',requestId:null,requestKind:null,status:'complete',startedAt:1,updatedAt:2,prompt:null,entries:[tool]}).traceState.entries[0].output;
  const count=text=>text.split('warning: check this source line').length-1,notice=/… \d+ chars omitted from saved Working view …/;
  assert(notice.test(saved)&&saved.includes(E+']8;;https://exa\n'),'the fixture really cuts a hyperlink at the omission');
  const {c}=fixture();Object.assign(c,{parseFiniteNumber:Number,parseNonEmptyString:x=>typeof x==='string'&&x.trim()?x:null,normalizeTraceEntryStatus:x=>x,normalizeTraceImage:x=>x,describeTraceImageForText:()=>''});
  vm.runInContext(section('const TRACE_TERMINAL_CODE_RE','function normalizeTraceState('),c);vm.runInContext(section('function buildVisibleWorkingText(','function getWorkingDocumentLabel('),c);
  const shown=c.normalizeTraceEntry(saved.length?JSON.parse(JSON.stringify({...tool,output:saved})):null,0).output;
  assert.equal(count(shown),count(saved),'every retained diagnostic');assert(notice.test(shown),'and the omission notice');assert(!/[\u001b\u0007]/.test(shown),'without terminal codes');
  c.traceState={status:'complete',entries:[{...tool,output:shown}]};c.getTraceEntriesForFilter=()=>c.traceState.entries;
  const copied=c.buildVisibleWorkingText('all');assert.equal(count(copied),count(saved));assert(notice.test(copied),'Copy visible and Load keep them too');
});

// Oliver, 29 Oct (option C): a steer is a step of its own where it arrived; a step's line is its number, its kind, what a
// tool acted on and its time; Thinking's bold lines read as headings; a section's header is its name, then its size.
const steer=(changes={})=>({id:'s1',type:'steer',text:'hi',status:'complete',startedAt:3000,updatedAt:3000,...changes});
test('new layout: a steer is a numbered step where it arrived, open when short, its time on the right; Thinking and Tools leave it out',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);
  c.traceState={status:'complete',runId:'r7',startedAt:500,prompt:'that is pretty cool!',entries:[assistant({id:'a1',thinking:'**Formulating a response**\n\nShort.',text:'Right?'}),steer(),assistant({id:'a2',text:'Hey Oliver!'})]};
  let html=c.buildTracePanelHtml();assert(html.includes('>3 steps<'));
  assert.match(html,stepRe('a1',1,false));assert.match(html,stepRe('s1',2,true),'open when short, though not the latest');assert.match(html,stepRe('a2',3,true));
  assert(html.includes("<span class='trace-card-title'>Steer</span><span class='trace-step-preview'>hi</span><span class='trace-step-meta'><span class='trace-card-meta'>3000</span></span></summary><div class='trace-step-body'><div class='trace-prompt-text'>hi</div></div>"));
  assert(html.includes("<span class='trace-card-title'>Prompt</span><span class='trace-step-preview'>that is pretty cool!</span><span class='trace-step-meta'><span class='trace-card-meta'>500</span></span>"),'the prompt has its run\'s start time');
  c.traceState.entries[1]=steer({text:'Long steer\n'+'more\n'.repeat(20)});html=c.buildTracePanelHtml();assert.match(html,stepRe('s1',2,false),'a long steer is one line, like a long prompt');
  assert(html.includes("<span class='trace-step-preview'>Long steer</span>"));
  c.traceClosedDetails.add('step:s1');c.traceState.entries[1]=steer();assert.match(c.buildTracePanelHtml(),stepRe('s1',2,false),'the person\'s choice wins');c.traceClosedDetails.clear();
  c.traceStepsFolded=true;assert.match(c.buildTracePanelHtml(),stepRe('s1',2,false),'after Collapse all it arrives folded');c.traceStepsFolded=false;
  for(const filter of ['tools','thinking']){c.traceFilter=filter;html=c.buildTracePanelHtml();assert(!html.includes('step:s1'),filter);}
  c.traceFilter='all';c.traceState.entries[1]=steer({text:'  \n '});html=c.buildTracePanelHtml();assert(!html.includes('step:s1'),'nothing to show');assert.match(html,stepRe('a2',2,true),'and numbers close up');
  c.studioUiRefreshUi=null;c.traceState.entries[1]=steer({text:'hi <b>'});html=c.buildTracePanelHtml();
  assert(html.includes("<article class='trace-card trace-card-steer'><div class='trace-card-header'><span class='trace-kind-badge'>Steer</span><span class='trace-card-meta'>3000</span></div>"),'the classic layout shows it as a card');
  assert(html.includes('hi &lt;b&gt;')&&!html.includes('hi <b>'),'escaped');
});
test('Copy visible and Load include a steer where it arrived; a steer survives the client\'s normalising',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};c.describeTraceImageForText=()=>'';
  vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);
  vm.runInContext(section('function buildVisibleWorkingText(','function getWorkingDocumentLabel('),c);
  c.traceState={status:'complete',runId:'r8',prompt:'that is pretty cool!',entries:[assistant({text:'Right?'}),steer(),assistant({id:'a2',text:'Hey Oliver!'})]};
  assert.equal(c.buildVisibleWorkingText('all'),'Prompt:\nthat is pretty cool!\n\n---\n\nAssistant\n\n[Response]\nRight?\n\n---\n\nSteer:\nhi\n\n---\n\nAssistant\n\n[Response]\nHey Oliver!');
  assert(!c.buildVisibleWorkingText('tools').includes('Steer')&&!c.buildVisibleWorkingText('thinking').includes('Steer'));
  const n={parseFiniteNumber:Number,parseNonEmptyString:x=>typeof x==='string'&&x.trim()?x:null,normalizeTraceEntryStatus:x=>x,normalizeTraceImage:x=>x};vm.createContext(n);
  vm.runInContext(section('const TRACE_TERMINAL_CODE_RE','function normalizeTraceState('),n);
  assert.deepEqual(JSON.parse(JSON.stringify(n.normalizeTraceEntry({type:'steer',id:'s1',text:'hi',startedAt:5,updatedAt:6,status:'streaming',extra:'x'},0))),{id:'s1',type:'steer',startedAt:5,updatedAt:6,text:'hi',status:'complete'});
  assert.equal(n.normalizeTraceEntry({type:'steer',text:7},3).text,'');assert.equal(n.normalizeTraceEntry({type:'steer'},3).id,'trace-steer-3');
});
test('the server keeps the run\'s first user message as its prompt and makes a later one a steer step, cut once on arrival and saved with the run',()=>{
  assert.match(index,/\} else if \(cut\) \{\n\t\t\t\t\tconst now = Date\.now\(\);\n\t\t\t\t\tupsertStudioTraceEntry\(\{ id: randomUUID\(\), type: "steer", startedAt: now, updatedAt: now, text: cut\.text, textTruncated: cut\.truncated, status: "complete" \}\);\n\t\t\t\t\}/);
  assert.match(index,/type StudioTraceEntry = StudioTraceAssistantEntry \| StudioTraceToolEntry \| StudioTraceSteerEntry;/);
  const start=index.indexOf('function truncateStudioTraceSnapshotText('),end=index.indexOf('\nfunction summarizeStudioTraceSnapshot(',start);
  const server={};vm.createContext(server);
  for(const name of ['STUDIO_TRACE_SNAPSHOT_MAX_ENTRIES','STUDIO_TRACE_SNAPSHOT_MAX_FIELD_CHARS','STUDIO_TRACE_SNAPSHOT_MAX_IMAGES','STUDIO_TRACE_SNAPSHOT_MAX_IMAGE_BASE64_CHARS'])
    vm.runInContext(index.match(new RegExp('^const '+name+' = [\\d_]+;','m'))[0].replace('const ','var '),server);
  Object.assign(server,{normalizeStudioTraceImageMimeType:x=>x,isStudioTraceSafeImageMimeType:()=>true,estimateStudioTraceBase64ByteLength:x=>x.length});
  vm.runInContext(ts.transpileModule(index.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,server);
  const state=entries=>({runId:'r1',requestId:null,requestKind:null,status:'complete',startedAt:1,updatedAt:2,prompt:'p',entries});
  const cut=server.truncateStudioTraceSnapshotText('x'.repeat(server.STUDIO_TRACE_SNAPSHOT_MAX_FIELD_CHARS+10));assert(cut.truncated);
  let saved=server.createStudioTraceSnapshot(state([{id:'s1',type:'steer',startedAt:1,updatedAt:1,text:'hi',textTruncated:false,status:'complete'}]));
  assert.deepEqual(JSON.parse(JSON.stringify(saved.traceState.entries)),[{id:'s1',type:'steer',startedAt:1,updatedAt:1,text:'hi',textTruncated:false,status:'complete'}]);assert.equal(saved.truncated,false);
  saved=server.createStudioTraceSnapshot(state([{id:'s1',type:'steer',startedAt:1,updatedAt:1,text:cut.text,textTruncated:true,status:'complete'}]));
  assert.equal(saved.traceState.entries[0].text,cut.text,'not cut a second time');assert.equal(saved.truncated,true,'and the saved copy says it was cut');
});
test('a tool step\'s line adds what it acted on: a file\'s name for read, write and edit, otherwise its label unless that repeats the tool',()=>{
  const {c}=fixture();
  for(const [toolName,label,detail] of [['read','Reading SKILL.md','SKILL.md'],['write','Writing butterfly.html','butterfly.html'],['edit','Editing index.ts','index.ts'],['read','Reading file',''],
    ['bash','Inspecting git changes','Inspecting git changes'],['codemode','Execute JavaScript','Execute JavaScript'],['studio_repl_status','Running studio_repl_status',''],['grep','grep',''],['find',null,''],['read','Reading <x>','<x>']])
    assert.equal(c.getTraceToolStepDetail({toolName,label}),detail,toolName+' '+label);
  c.studioUiRefreshUi={};c.traceState={status:'complete',runId:'r9',prompt:null,entries:[tool({id:'t1',toolName:'read',label:'Reading <x>'})]};
  assert(c.buildTracePanelHtml().includes("<span class='trace-card-title'>read</span><span class='trace-step-detail'>&lt;x&gt;</span>"),'escaped');
});
test('new layout: a Thinking line that is all bold reads as a heading; bold inside a line, other sections and the classic layout keep their text',()=>{
  const {c}=fixture();
  const text='**Formulating a response**\n\nI want **this** kept.\n**Two** and **three**\n**<b>**\n** spaced **\n****\n**a**\r\nend';
  assert(c.renderTraceOutput(text,'k',{label:'Thinking',prose:true,headings:true}).includes('<strong>Formulating a response</strong>\n\nI want **this** kept.\n**Two** and **three**\n<strong>&lt;b&gt;</strong>\n** spaced **\n****\n<strong>a</strong>\nend'));
  assert(!c.renderTraceOutput(text,'k',{label:'Response',prose:true}).includes('<strong>'));
  c.studioUiRefreshUi={};c.traceState={status:'complete',runId:'r10',prompt:null,entries:[assistant({thinking:'**Plan**\nx',text:'**Done**'})]};
  const html=c.buildTracePanelHtml();assert(html.includes('<strong>Plan</strong>')&&html.includes('**Done**')&&!html.includes('<strong>Done</strong>'),'Thinking only');
});
test('new layout: a section\'s header is its name, then its size in plain weight; the classic layout keeps one line of text',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};
  const metrics=c.formatTraceTextMetrics('a\nb');
  assert(c.renderTraceSection('Output','a\nb','k1','',{isError:true}).includes(`<summary><span class='trace-section-name'>Output</span> <span class='trace-section-metrics'>Error · ${metrics}</span></summary>`));
  assert(c.renderTraceSection('Output','','k2','',{imageCount:1}).includes("<summary><span class='trace-section-name'>Output</span> <span class='trace-section-metrics'>1 image</span></summary>"));
  c.studioUiRefreshUi=null;assert(c.renderTraceSection('Output','a\nb','k3','',{isError:true}).includes(`<summary>Output · Error · ${metrics}</summary>`));
});
test('a steer Pi delivers before the first reply, after an image-only first message, is a steer step, not the prompt; live, saved and copied (Sol, c103)',()=>{
  // The actual capture branch from the user message_end handler, with the actual snapshot and Copy/Load code.
  const start=index.indexOf('\t\t\tif (studioRunLifecycle.snapshot().run && studioTraceState.runId) {\n\t\t\t\tconst first = !studioTraceUserMessageSeen;'),end=index.indexOf('\n\t\t\tconst inputIndex = studioPromptInputs',start);
  assert(start>=0&&end>start,'capture branch');
  const lo=index.indexOf('function truncateStudioTraceSnapshotText('),hi=index.indexOf('\nfunction summarizeStudioTraceSnapshot(',lo);
  const server={entries:[],broadcasts:0};vm.createContext(server);
  for(const name of ['STUDIO_TRACE_SNAPSHOT_MAX_ENTRIES','STUDIO_TRACE_SNAPSHOT_MAX_FIELD_CHARS','STUDIO_TRACE_SNAPSHOT_MAX_IMAGES','STUDIO_TRACE_SNAPSHOT_MAX_IMAGE_BASE64_CHARS'])
    vm.runInContext(index.match(new RegExp('^const '+name+' = [\\d_]+;','m'))[0].replace('const ','var '),server);
  Object.assign(server,{normalizeStudioTraceImageMimeType:x=>x,isStudioTraceSafeImageMimeType:()=>true,estimateStudioTraceBase64ByteLength:x=>x.length});
  vm.runInContext(ts.transpileModule(index.slice(lo,hi),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,server);
  const body=ts.transpileModule('function deliver(userPrompt) {\n'+index.slice(start,end)+'\n}',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
  vm.runInContext(`var studioTraceUserMessageSeen=false,ids=0,studioRunLifecycle={snapshot:()=>({run:{id:'r1'}})},randomUUID=()=>'steer-'+ ++ids;
    var studioTraceState={runId:'r1',requestId:null,requestKind:null,status:'running',startedAt:1,updatedAt:1,prompt:null,entries:[]};
    var broadcastStudioTraceStatus=()=>{broadcasts++;},upsertStudioTraceEntry=e=>{studioTraceState.entries.push(e);};
    function newRun(){studioTraceState={runId:'r2',requestId:null,requestKind:null,status:'running',startedAt:2,updatedAt:2,prompt:null,entries:[]};studioTraceUserMessageSeen=false;}
    ${body}`,server);
  // Pi's own order: the image-only prompt, then the queued steer, before any assistant message.
  server.deliver(null);server.deliver('Please describe the screenshot briefly.');
  const live=JSON.parse(JSON.stringify(server.studioTraceState));
  assert.equal(live.prompt,null,'the prompt is not replaced with the steer');
  assert.deepEqual(live.entries.map(e=>[e.type,e.text]),[['steer','Please describe the screenshot briefly.']]);
  server.studioTraceState.entries.push({id:'a1',type:'assistant',thinking:'',text:'A screenshot of a chart.',status:'complete',stopReason:'stop',startedAt:3,updatedAt:3});
  const saved=JSON.parse(JSON.stringify(server.createStudioTraceSnapshot(server.studioTraceState).traceState));
  assert.equal(saved.prompt,null);assert.deepEqual(saved.entries.map(e=>e.type),['steer','assistant']);
  const {c}=fixture();c.studioUiRefreshUi={};c.describeTraceImageForText=()=>'';
  vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);vm.runInContext(section('function buildVisibleWorkingText(','function getWorkingDocumentLabel('),c);
  c.traceState=saved;
  assert.equal(c.buildVisibleWorkingText('all'),'Steer:\nPlease describe the screenshot briefly.\n\n---\n\nAssistant\n\n[Response]\nA screenshot of a chart.');
  // Controls: a text prompt then a steer; and a new run starts over.
  vm.runInContext('newRun()',server);server.deliver('that is pretty cool!');server.deliver('hi');
  const control=JSON.parse(JSON.stringify(server.studioTraceState));assert.equal(control.prompt,'that is pretty cool!');assert.deepEqual(control.entries.map(e=>[e.type,e.text]),[['steer','hi']]);
  vm.runInContext('newRun()',server);server.deliver('and another thing');assert.equal(server.studioTraceState.prompt,'and another thing');assert.equal(server.studioTraceState.entries.length,0);
  // Every place that starts a run's Working over also starts the first-message count over.
  assert.equal(index.match(/activeStudioTraceAssistantEntryId = null;\n\t\tstudioTraceUserMessageSeen = false;/g).length,2,'resetStudioTraceForRun and clearStudioTrace');
});

// Oliver, 29 Oct: what Pi wrote along the way, and the steers, can be read without the thinking or the tools; and an open
// Assistant step whose sections are all folded keeps its first line.
test('new layout: Messages shows the prompt, what Pi wrote along the way and the steers, by their whole-run numbers, without thinking or tools',()=>{
  const {c}=fixture();c.studioUiRefreshUi={};c.describeTraceImageForText=()=>'';
  vm.runInContext(section('function normalizeTraceFilter(','function formatTraceImageSize('),c);
  vm.runInContext(section('function buildVisibleWorkingText(','function getWorkingDocumentLabel('),c);
  vm.runInContext(section('function getWorkingDocumentLabel(','async function writeTextToClipboard('),c);
  assert.equal(c.normalizeTraceFilter('messages'),'messages');assert.equal(c.getWorkingDocumentLabel('messages'),'working (messages)');
  c.traceState={status:'complete',runId:'r9',startedAt:500,prompt:'can you check the status',entries:[assistant({id:'a1',thinking:'Considering',text:''}),tool({id:'t1'}),
    assistant({id:'a2',thinking:'**Evaluating**',text:'It finished at 4:30.'}),steer({text:'any other runs?'}),assistant({id:'a3',text:'I\'ll check.'}),tool({id:'t2'})]};
  c.traceFilter='messages';let html=c.buildTracePanelHtml();
  assert(html.includes("data-trace-filter='messages' aria-pressed='true'>Messages</button>")&&html.includes('>Messages only<'),'its button is on and the header says so');
  assert(html.indexOf("data-trace-filter='all'")<html.indexOf("data-trace-filter='messages'")&&html.indexOf("data-trace-filter='messages'")<html.indexOf("data-trace-filter='thinking'"),'after All');
  assert(html.includes('>3 steps<'));assert.match(html,stepRe('a2',3,false));assert.match(html,stepRe('s1',4,true));assert.match(html,stepRe('a3',5,true));
  assert(!html.includes('step:a1')&&!html.includes('step:t1')&&!html.includes('step:t2'),'no thinking-only step or tool');
  assert(!html.includes("data-trace-details-key='a2:thinking'")&&html.includes("data-trace-details-key='a2:response'"),'a step with both shows its Response only');
  assert(html.includes("<span class='trace-card-title'>Assistant</span><span class='trace-step-preview'>It finished at 4:30.</span>"));
  assert(html.includes("<span class='trace-card-title'>Prompt</span>"),'the prompt comes first, as under every filter');
  assert.equal(c.buildVisibleWorkingText('messages'),"Prompt:\ncan you check the status\n\n---\n\nAssistant:\nIt finished at 4:30.\n\n---\n\nSteer:\nany other runs?\n\n---\n\nAssistant:\nI'll check.",'Copy visible and Load');
  c.traceFilter='thinking';html=c.buildTracePanelHtml();assert.match(html,stepRe('a1',1,false));assert(html.includes("data-trace-details-key='a2:thinking'")&&!html.includes("data-trace-details-key='a2:response'"),'Thinking is as it was');
  c.traceFilter='messages';c.traceState.entries=[assistant({id:'a1',thinking:'Considering',text:''}),tool({id:'t1'}),steer({text:'  '})];
  html=c.buildTracePanelHtml();assert(html.includes('No messages in this working view yet.'),'nothing written yet');
  c.studioUiRefreshUi=null;c.traceState.entries=[assistant({id:'a2',thinking:'Hmm',text:'Reply'})];html=c.buildTracePanelHtml();
  assert(html.includes("data-trace-filter='messages'")&&html.includes("<article class='trace-card trace-card-assistant'>")&&!html.includes('a2:thinking'),'the classic layout has it too');
});
test('new layout CSS: an Assistant step\'s line always has its first line, whatever is folded; an open prompt or steer hides its own',()=>{
  assert(css.includes('body.studio-workspace-layout details.trace-step[open]:not(.trace-card-assistant) > summary > .trace-step-preview { display: none; }'));
  assert(!/trace-step-preview[^{]*\{[^}]*display: (?:none|block)/.test(css.replace('body.studio-workspace-layout details.trace-step[open]:not(.trace-card-assistant) > summary > .trace-step-preview { display: none; }','')),'no other rule shows or hides it');
});
