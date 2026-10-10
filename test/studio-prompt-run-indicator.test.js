import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const helper=readFileSync(new URL("../client/studio-editor-draft-helpers.js",import.meta.url),"utf8");
const client=readFileSync(new URL("../client/studio-client.js",import.meta.url),"utf8");
const server=readFileSync(new URL("../index.ts",import.meta.url),"utf8");
function tracker(){const c=vm.createContext({});vm.runInContext(helper,c);return c.PiStudioEditorDraftHelpers.createPromptRunIndicatorTracker({now:()=>1000});}

test("fresh and unproven recovery have distinct states; a matching SDK receipt establishes a baseline",()=>{
 const t=tracker();t.initialize("p",true);t.initialize("old",false);
 assert.equal(t.state("p","draft").phase,"not-run");assert.equal(t.state("old","draft").phase,"unknown");
 t.remember("r","p","prepared");assert.equal(t.state("p","prepared").phase,"not-run");
 assert.equal(t.submitted("wrong",100),false);assert.equal(t.state("p","prepared").phase,"not-run");
 assert.equal(t.submitted("r",100),true);assert.equal(t.state("p","prepared").phase,"sent");
 assert.equal(t.state("p","changed").phase,"edited");assert.equal(t.state("p","prepared").phase,"sent");
 assert.equal(t.submitted("r",200),false);
});
test("rejection/disconnect never establish or erase an acknowledged baseline",()=>{
 const t=tracker();t.initialize("p",true);t.remember("r","p","a");t.discard("r");assert.equal(t.submitted("r",100),false);assert.equal(t.state("p","a").phase,"not-run");
 t.remember("yes","p","a");t.submitted("yes",100);t.remember("no","p","b");t.discard("no");t.clearPending();
 assert.equal(t.state("p","a").phase,"sent");assert.equal(t.state("p","b").phase,"edited");
});
test("lost delivery and unproven outside-origin receipts become unknown without marking Sent",()=>{
 const t=tracker();t.initialize("p",true);t.remember("lost","p","a");t.clearPending();assert.equal(t.state("p","a").phase,"unknown");
 t.remember("yes","p","a");t.submitted("yes",100);t.remember("outside","p","b");assert.equal(t.uncertain("outside"),true);assert.equal(t.state("p","b").phase,"unknown");
 assert.equal(t.submitted("outside",200),false);assert.equal(t.uncertain("foreign"),false);
});
test("late acknowledgements cannot replace newer submissions; hidden buffers retain their own identity",()=>{
 const t=tracker();t.initialize("p",true);t.initialize("other",false);t.remember("old","p","a");t.remember("new","p","b");t.submitted("new",200);
 assert.equal(t.submitted("old",100),false);assert.equal(t.state("p","b").sentAt,200);assert.equal(t.state("other","b").phase,"unknown");
 const lost=tracker();lost.initialize("p",true);lost.remember("old","p","a");lost.remember("new","p","b");lost.submitted("new",200);lost.clearPending();
 assert.equal(lost.state("p","b").phase,"sent","an uncertain older request cannot erase a newer proven baseline");
});
test("recovery stores no prompt text or pending authority and reports unavailable comparisons honestly",()=>{
 const t=tracker();t.initialize("p",true);t.remember("r","p","private draft text");
 const pending=t.snapshot();assert(!JSON.stringify(pending).includes("private draft text"));assert.equal(pending.records[0].phase,"unknown");
 t.submitted("r",100);const snapshot=t.snapshot();assert(!JSON.stringify(snapshot).includes("private draft text"));
 const next=tracker();assert.equal(next.restore(snapshot,"p"),true);assert.equal(next.state("p","private draft text").phase,"unknown");assert.equal(next.state("p","x").sentAt,100);
 assert.equal(next.submitted("r",200),false);
 const fresh=tracker();fresh.initialize("fresh",true);assert.equal(next.restore(fresh.snapshot(),"fresh"),true);assert.equal(next.state("fresh","x").phase,"unknown","a recovered Not run hint cannot prove no registration occurred before storage failed");
 for(const value of [null,{version:2,records:[]},{version:1,records:[{bufferId:"p",phase:"not-run",sentAt:100,sequence:1}]},{version:1,records:[{bufferId:"p",phase:"sent",text:"fake",sentAt:100,sequence:1}]}])assert.equal(tracker().restore(value,"p"),false);
});
test("oversized comparisons remain unknown after real receipts, with bounded pending memory",()=>{
 const t=tracker();t.initialize("p",true);t.remember("large","p","x".repeat(900001));assert.equal(t.submitted("large",100),true);assert.equal(t.state("p","x").phase,"unknown");
 for(let i=0;i<9;i++)t.remember("q"+i,"p","x");assert.equal(t.submitted("q0",200),false);assert.equal(t.submitted("q8",300),true);
 assert.equal(t.remember("", "p","x"),false);
});

function ui(){
 const t=tracker(),storage=new Map(),element={hidden:true,textContent:"",title:""};let selected={id:"p",role:"prompt"};
 const c=vm.createContext({promptRunIndicatorTracker:t,promptRunIndicatorReady:false,promptRunIndicatorFresh:true,bufferSwitchingEnabled:true,
  studioTabStateId:"workspace",studioUiRefreshUi:{promptRunIndicator:element},sourceTextEl:{value:"raw"},
  getStudioSelectedBuffer:()=>selected,bufferRecoveryClient:{snapshot:()=>({buffers:[{id:"p",role:"prompt"},{id:"d",role:"document"}]})},
  prepareEditorTextForRunRequest:text=>c.mode==="strip"?text.replace("annotation",""):text,mode:"send",
  window:{sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}}});
 const start=client.indexOf("      function persistPromptRunIndicator()"),end=client.indexOf("      function setupStudioBufferSwitcher()",start);assert(start>=0&&end>start);
 vm.runInContext(client.slice(start,end),c);
 return {c,t,storage,element,select:s=>{selected=s;}};
}
test("production indicator uses prepared text, hides in Document and stays independent of saving/backing",()=>{
 const f=ui();f.c.initializePromptRunIndicator();assert.equal(f.element.textContent,"Not run");
 f.c.sourceTextEl.value="raw annotation";f.c.rememberPromptRun("r","raw annotation");f.select({id:"d",role:"document"});f.t.submitted("r",100000);f.c.syncPromptRunIndicator();assert.equal(f.element.hidden,true);
 f.select({id:"p",role:"prompt",sourceState:{path:"/one.md"}});f.c.syncPromptRunIndicator();assert.match(f.element.textContent,/^Sent /);
 f.c.mode="strip";f.c.syncPromptRunIndicator();assert.match(f.element.textContent,/^Edited since /);
 f.c.mode="send";f.c.syncPromptRunIndicator();assert.match(f.element.textContent,/^Sent /);
 f.select({id:"p",role:"prompt",sourceState:{path:"/saved-as.md"}});f.c.syncPromptRunIndicator();assert.match(f.element.textContent,/^Sent /);
 f.c.persistPromptRunIndicator();assert(![...f.storage.values()][0].includes("raw annotation"));
});
test("production recovery shows nothing rather than falsely claiming a recovered Prompt was never run",()=>{
 // Oliver, 10 Oct: an unknown history says nothing useful, so the indicator is hidden.
 const f=ui();f.c.promptRunIndicatorFresh=false;f.c.initializePromptRunIndicator();assert.equal(f.element.hidden,true);assert.equal(f.element.textContent,"");
});
function registeredSdkFixture(){
 const events=[],handlers={};const c=vm.createContext({pi:{on:(name,fn)=>handlers[name]=fn},activeRequest:{id:"r",kind:"direct",promptTriggerText:"prompt"},studioPromptInputProvenanceLost:false,studioPromptInputs:[],queuedStudioDirectRequests:[],studioRunLifecycle:{snapshot(){return {run:null};},input(){}},normalizePromptText:t=>typeof t==="string"?t.trim():null,pendingTurnPrompt:null,pendingStudioPromptMetadata:null,
  extractAssistantText:()=>null,extractAssistantThinking:()=>null,extractUserText:m=>m.text,emitDebugEvent(){},activateQueuedStudioDirectRequestForPrompt:()=>null,stageStudioPromptMetadata(){},getPromptDescriptorForActiveRequest:()=>({}),broadcast:m=>events.push(m)});
 const a=server.indexOf('pi.on("message_end"'),b=server.indexOf("\n\t\t// Assistant is handing off",a);assert(a>=0&&b>a);
 const code=server.slice(a,b).replace('event.message as { stopReason?: string; role?: string }','event.message').replace('(event.message as { timestamp?: unknown }).timestamp','event.message.timestamp')+'\n});';
 const inputStart=server.indexOf('pi.on("input"'),inputEnd=server.indexOf('pi.on("session_before_compact"',inputStart);assert(inputStart>=0&&inputEnd>inputStart);
 vm.runInContext(server.slice(inputStart,inputEnd),c);
 vm.runInContext(code,c);return {events,handlers,c};
}
test("registered steering and batched inputs credit their own request, not the still-active response request",async()=>{
 const {events,handlers,c}=registeredSdkFixture(),t=tracker();t.initialize("p",true);t.remember("base","p","original");t.submitted("base",100);
 c.activeRequest={id:"base",kind:"direct",promptTriggerText:"original"};c.queuedStudioDirectRequests=[{requestId:"q1",promptTriggerText:"one"},{requestId:"q2",promptTriggerText:"two"}];
 for(const [id,text] of [["q1","one"],["q2","two"]]){t.remember(id,"p",text);await handlers.input({source:"extension",text});}
 for(const [i,text] of ["one","two"].entries()){
  await handlers.message_end({message:{role:"user",text,timestamp:200+i}});const packet=events.at(-1);
  assert.equal(packet.requestId,"q"+(i+1));assert.equal(packet.studioOwned,true);assert.equal(t.submitted(packet.requestId,packet.sentAt),true);assert.equal(t.state("p",text).phase,"sent");
 }
 assert.equal(c.activeRequest.id,"base","informational receipts do not change response/consent ownership");
});
for(const limit of ["count","characters","oversized"]){
 test("lost input provenance at the "+limit+" bound cannot lend ownership to a later same-text input",async()=>{
  const {events,handlers,c}=registeredSdkFixture();c.activeRequest={id:"q",kind:"direct",promptTriggerText:"same"};
  if(limit!=="oversized")await handlers.input({source:"rpc",text:"same"});
  if(limit==="count")for(let i=0;i<15;i++)await handlers.input({source:"rpc",text:"outside-"+i});
  if(limit==="characters")for(let i=0;i<3;i++)await handlers.input({source:"rpc",text:"x".repeat(900000)});
  if(limit==="oversized")await handlers.input({source:"rpc",text:"x".repeat(900001)});
  await handlers.input({source:"extension",text:"same"});await handlers.message_end({message:{role:"user",text:"same",timestamp:300}});
  assert.equal(events.at(-1).studioOwned,false,"an unobserved or evicted input cannot borrow later Studio proof");
  assert(c.studioPromptInputs.length<=16);assert(c.studioPromptInputs.reduce((n,item)=>n+item.text.length,0)<=2700000);
 });
}
test("failed indicator storage writes cannot recover an old Not run hint after a real receipt",()=>{
 const before=ui();before.c.initializePromptRunIndicator();const key="piStudio.promptRun.v1:workspace",old=before.storage.get(key);
 before.c.window.sessionStorage.setItem=()=>{throw Error("fixture storage write failed");};
 before.c.rememberPromptRun("r","raw");before.t.submitted("r",100);before.c.persistPromptRunIndicator();before.c.syncPromptRunIndicator();assert.match(before.element.textContent,/^Sent /);assert.equal(before.storage.get(key),old);
 const after=ui();after.storage.set(key,old);after.c.promptRunIndicatorFresh=false;after.c.initializePromptRunIndicator();assert.equal(after.element.hidden,true);assert.equal(after.element.textContent,"");
});
test("server emits informational receipt only on registered SDK user messages, including exact queued identity",async()=>{
 const {events,handlers,c}=registeredSdkFixture();await handlers.input({source:"extension",text:"prompt"});await handlers.message_end({message:{role:"user",text:"prompt",timestamp:100}});
 assert.equal(events.length,1);assert.equal(events[0].type,"prompt_submitted");assert.equal(events[0].requestId,"r");assert.equal(events[0].sentAt,100);assert.equal(events[0].studioOwned,true);
 await handlers.input({source:"rpc",text:"prompt"});await handlers.message_end({message:{role:"user",text:"prompt",timestamp:150}});assert.equal(events[1].studioOwned,false);
 c.activeRequest={id:"outside",kind:"critique"};await handlers.message_end({message:{role:"user",text:"other",timestamp:200}});assert.equal(events.length,2);
 c.activeRequest=null;c.queuedStudioDirectRequests=[{requestId:"queued",promptTriggerText:"steer"}];
 await handlers.input({source:"extension",text:"steer"});
 c.activateQueuedStudioDirectRequestForPrompt=()=>{c.activeRequest={id:"queued",kind:"direct",promptTriggerText:"steer"};return {requestId:"queued",promptSteeringCount:1};};c.getQueuedStudioSteeringCount=()=>0;
 await handlers.message_end({message:{role:"user",text:"steer",timestamp:300}});assert.equal(events[2].requestId,"queued");assert.equal(events[2].studioOwned,true);
 c.activeRequest=null;c.queuedStudioDirectRequests=[{requestId:"next",promptTriggerText:"same"}];
 await handlers.input({source:"rpc",text:"same"});await handlers.input({source:"extension",text:"same"});
 c.activateQueuedStudioDirectRequestForPrompt=()=>{c.activeRequest={id:"next",kind:"direct",promptTriggerText:"same"};return null;};
 await handlers.message_end({message:{role:"user",text:"same",timestamp:400}});
 assert.equal(events[3].studioOwned,false,"an earlier outside input cannot borrow the later Studio input's source");
 const runStart=server.indexOf('if (msg.type === "send_run_request")'),runEnd=server.indexOf('if (msg.type === "completion_suggestion_cancel_request")',runStart);
 assert(!server.slice(runStart,runEnd).includes('type: "prompt_submitted"'),"transport acknowledgement/model rejection cannot produce the receipt");
});

test("a settled Stop or failure labels only the Run that sent this text; edits and new Runs replace it",()=>{
 const t=tracker();t.initialize("p",true);t.remember("r1","p","a");t.submitted("r1",100);
 assert.equal(t.settled("other","stopped",200),false);assert.equal(t.state("p","a").phase,"sent");
 assert.equal(t.settled("r1","completed",200),false,"a normal finish keeps Sent");
 assert.equal(t.settled("r1","stopped",200),true);assert.deepEqual({...t.state("p","a")},{phase:"stopped",sentAt:100,settledAt:200});
 assert.equal(t.state("p","b").phase,"edited","an edit after Stop reads as Edited since");
 t.remember("r2","p","b");t.submitted("r2",300);assert.equal(t.state("p","b").phase,"sent","a new Run clears the old outcome");
 assert.equal(t.settled("r1","failed",400),false,"a late outcome for an older Run is ignored");
 assert.equal(t.settled("r2","failed",500),true);assert.equal(t.state("p","b").phase,"failed");
 const snapshot=t.snapshot();assert.equal(snapshot.records[0].phase,"unknown","outcomes are not restored as proof after reload");
});
test("settlement, not Stop delivery or a toolUse pause, sends the outcome and Working status",()=>{
 const settled=server.slice(server.indexOf('pi.on("agent_settled"'),server.indexOf('pi.on("session_shutdown"'));
 assert.match(settled,/const stopping = settlingRun\?\.stopping === true;/);
 assert.match(settled,/const ended = lastStop === "stop" \|\| lastStop === "length";/);
 assert.match(settled,/stopping \|\| lastStop === "aborted" \? "stopped"\s*: activeRequest \|\| lastStop === "error" \|\| \(owned && !ended\) \? "failed" : "completed"/);
 assert.match(settled,/requestIds: outcomeRequestIds/);
 assert.match(settled,/setStudioTraceRunStatus\(outcome === "stopped" \? "stopped" : outcome === "failed" \? "error" : "complete"\)/);
 assert.match(settled,/broadcast\(\{ type: "run_settled", runId: settlingRun\.id, requestId: outcomeRequestId, requestIds: outcomeRequestIds, outcome/);
 assert.match(client,/message\.type === "run_settled"[\s\S]{0,260}promptRunIndicatorTracker\?\.settled\(Array\.isArray\(message\.requestIds\) \? message\.requestIds : message\.requestId, message\.outcome, message\.settledAt\)/);
 assert.match(client,/state\.phase === "stopped" \? "Stopped " \+ ended/);
});

test("steering receipts accepted during a Run still get its Stopped or Failed outcome; a later Run is unaffected",()=>{
 const t=tracker();t.initialize("p",true);t.remember("base","p","a");t.submitted("base",100);
 t.remember("steer","p","a2");t.submitted("steer",150);
 assert.equal(t.settled(["base","steer"],"stopped",200),true);assert.equal(t.state("p","a2").phase,"stopped");
 t.remember("next","p","b");t.submitted("next",300);assert.equal(t.settled(["base","steer"],"failed",400),false,"an older Run's late outcome is ignored");
 assert.equal(t.state("p","b").phase,"sent");
});
test("a message end no longer marks a tracked Run finished; only settlement does",()=>{
 assert.match(server,/if \(!studioRunLifecycle\.snapshot\(\)\.run\) setStudioTraceRunStatus\("complete"\);/);
 assert.match(server,/if \(role === "assistant" && studioRunLifecycle\.snapshot\(\)\.run\) studioRunLastStopReason = stopReason \|\| null;/);
 assert.match(server,/if \(studioRunLifecycle\.snapshot\(\)\.run\) studioRunInputRequestIds\.add\(receiptRequestId\);/);
 assert.match(client,/settled\(Array\.isArray\(message\.requestIds\) \? message\.requestIds : message\.requestId/);
});
