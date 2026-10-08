import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../client/studio-client.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.ts',import.meta.url),'utf8');
function section(name){const start=source.indexOf('      function '+name+'(');if(start<0)return '';const end=source.indexOf('\n      function ',start+10);return source.slice(start,end);}
function harness(overrides={}){
 // widths records the inline padding-right seen at each forced layout.
 const widths=[],calls={sync:0,toggle:0,prevent:0,stop:0},style={padding:'',priority:'',getPropertyValue(k){return k==='padding-right'?this.padding:'';},getPropertyPriority(k){return k==='padding-right'?this.priority:'';},setProperty(k,v,p){assert.equal(k,'padding-right');this.padding=v;this.priority=p||'';},removeProperty(k){assert.equal(k,'padding-right');this.padding='';this.priority='';}};
 const el={style,value:'# Text\nA wrapped line.',selectionStart:12,selectionEnd:16,selectionDirection:'backward',scrollTop:80,scrollLeft:3,disabled:false,readOnly:false};
 Object.defineProperty(el,'offsetWidth',{get(){widths.push(style.padding);el.scrollTop=0;return 500;}});
 const c={sourceTextEl:el,editorHighlightEnabled:true,editorView:'markdown',editorWrapCompositionActive:false,window:{getComputedStyle:()=>({paddingRight:'9px'})},
  syncEditorHighlightScroll:()=>calls.sync++,studioModalBlocksDraftAction:()=>false,
  setEditorHighlightEnabled:v=>{c.editorHighlightEnabled=v;calls.toggle++;},...overrides};
 vm.createContext(c);vm.runInContext(section('repairEditorTextareaWrap')+'\n'+section('handleEditorHighlightShortcut'),c);
 return {c,el,widths,calls,event(extra={}){return {target:el,key:'H',code:'KeyH',ctrlKey:true,shiftKey:true,preventDefault(){calls.prevent++;},stopPropagation(){calls.stop++;},...extra};}};
}
function repair(h,event){assert.equal(typeof h.c.repairEditorTextareaWrap,'function','textarea wrap repair missing');return h.c.repairEditorTextareaWrap(event);}
function shortcut(h,event){assert.equal(typeof h.c.handleEditorHighlightShortcut,'function','highlight shortcut missing');return h.c.handleEditorHighlightShortcut(event);}

test('highlighted raw input forces two layouts without altering text, selection, focus or scroll',()=>{
 const h=harness();const before={text:h.el.value,start:h.el.selectionStart,end:h.el.selectionEnd,direction:h.el.selectionDirection};
 assert.equal(repair(h,{}),true);assert.deepEqual(h.widths,['calc(9px + 1px)','']);assert.equal(h.el.scrollTop,80);assert.equal(h.el.scrollLeft,3);assert.equal(h.calls.sync,1);
 assert.deepEqual({text:h.el.value,start:h.el.selectionStart,end:h.el.selectionEnd,direction:h.el.selectionDirection},before);
});

test('repair restores an existing inline padding and its priority',()=>{
 const h=harness();h.el.style.padding='12px';h.el.style.priority='important';repair(h,{});
 assert.deepEqual(h.widths,['calc(9px + 1px)','12px']);assert.equal(h.el.style.padding,'12px');assert.equal(h.el.style.priority,'important');
});

test('the nudge narrows the text itself: padding, not width, which a growing flex item undoes',()=>{
 const body=section('repairEditorTextareaWrap');
 assert.match(body,/setProperty\("padding-right", "calc\(" \+ computed \+ " \+ 1px\)"/);
 assert.doesNotMatch(body,/setProperty\("width"/);
});

for(const [label,settings,event] of [['plain',{editorHighlightEnabled:false},{}],['Preview',{editorView:'preview'},{}],['composition event',{}, {isComposing:true}],['active composition',{editorWrapCompositionActive:true},{}]])test(label+' does not force textarea layout',()=>{
 const h=harness(settings);assert.equal(repair(h,event),false);assert.deepEqual(h.widths,[]);
});

test('Ctrl+Shift+H toggles the existing preference while keeping editor selection and scroll',()=>{
 const h=harness();assert.equal(shortcut(h,h.event()),true);assert.equal(h.c.editorHighlightEnabled,false);assert.equal(h.calls.toggle,1);
 assert.equal(h.el.selectionStart,12);assert.equal(h.el.selectionEnd,16);assert.equal(h.el.scrollTop,80);assert.equal(h.calls.prevent,1);assert.equal(h.calls.stop,1);
 assert.equal(shortcut(h,h.event()),true);assert.equal(h.c.editorHighlightEnabled,true);assert.equal(h.calls.toggle,2);assert.equal(h.widths.length,2);
});

for(const [label,event,settings] of [['Cmd+Shift+H',{metaKey:true,ctrlKey:false},{}],['Alt',{altKey:true},{}],['composition',{isComposing:true},{}],['different input',{target:{}},{}],['Preview',{}, {editorView:'preview'}],['modal',{}, {studioModalBlocksDraftAction:()=>true}],['prevented',{defaultPrevented:true},{}]])test('shortcut ignores '+label,()=>{
 const h=harness(settings);assert.equal(shortcut(h,h.event(event)),false);assert.equal(h.calls.toggle,0);assert.equal(h.calls.prevent,0);
});

test('held shortcut is consumed without toggling repeatedly',()=>{
 const h=harness();assert.equal(shortcut(h,h.event({repeat:true})),true);assert.equal(h.calls.toggle,0);assert.equal(h.calls.prevent,1);
});

test('read-only and disabled editor shortcut leave the display preference unchanged',()=>{
 for(const field of ['readOnly','disabled']){const h=harness();h.el[field]=true;assert.equal(shortcut(h,h.event()),false);assert.equal(h.calls.toggle,0);}
});

test('native input invokes repair; composition lifecycle defers it until completion; shortcut is documented and local',()=>{
 assert.match(source,/sourceTextEl\.addEventListener\("input",\s*\(?event\)?\s*=>\s*\{\s*repairEditorTextareaWrap\(event\)/);
 assert.match(source,/sourceTextEl\.addEventListener\("compositionstart"/);assert.match(source,/sourceTextEl\.addEventListener\("compositionend"/);
 assert.match(source,/sourceTextEl\.addEventListener\("keydown", handleEditorHighlightShortcut\)/);
 assert.match(html,/<dt>Ctrl\+Shift\+H<\/dt><dd>Toggle editor syntax highlighting/);
 assert.match(html,/id="highlightSelect"[^>]*aria-keyshortcuts="Control\+Shift\+H"/);
});

test('a composition left open (e.g. by WebKit autocorrect) cannot disable the repair: an ordinary input event clears it',()=>{
 const h=harness({editorWrapCompositionActive:true});
 assert.equal(repair(h,{type:'input',isComposing:true}),false,'a real composition input still defers');
 assert.equal(repair(h,{type:'input',isComposing:false}),true,'an ordinary input proves the composition is over');
 assert.equal(h.c.editorWrapCompositionActive,false);
});

test('ordinary keys and blur clear a stale composition flag; typing pauses re-lay out once',()=>{
 assert.match(source,/addEventListener\("keydown", event => \{ if \(!event\.isComposing && event\.keyCode !== 229\) editorWrapCompositionActive = false; \}\)/);
 assert.match(source,/addEventListener\("blur", \(\) => \{ editorWrapCompositionActive = false; \}\)/);
 assert.match(source,/repairEditorTextareaWrap\(event\); scheduleEditorWrapPauseRepair\(\);/);
 assert.match(source,/function scheduleEditorWrapPauseRepair\(\)[\s\S]{0,260}setTimeout\(\(\) => \{ editorWrapPauseTimer = null; repairEditorTextareaWrap\(\); \}, 300\)/);
});
