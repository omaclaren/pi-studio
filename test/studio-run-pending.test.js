import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";
import { dedicatedTestBrowser } from "./dedicated-test-browser.js";

// Oliver, 14 Oct (Astra's report): between clicking Run and Stop, Run flashed hollow, and the long
// inline status "Studio: running editor text…" let Queue steering push the tools to a second row
// that vanished once the run started. Now the inline status says "Starting…" and Run keeps its look.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const extract = name => {
  const start = source.indexOf("      function " + name + "(");
  assert(start >= 0, name);
  const match = /\n      (?:async )?function /.exec(source.slice(start + 1));
  return source.slice(start, start + 1 + match.index);
};

test("a Run waiting for Pi says Starting… beside Run; critique and other busy work keep their wording", () => {
  const c = vm.createContext({ studioRuntimeActivity: null, wsState: "Submitting", uiBusy: true, pendingKind: "direct", studioStopRequestedRunId: null,
    getStudioBusyStatus: kind => "Studio: " + kind + "…", Date });
  vm.runInContext(extract("getStudioRuntimeStatusText"), c);
  const text = (values) => { Object.assign(c, values); return c.getStudioRuntimeStatusText(); };
  assert.equal(text({ pendingKind: "direct" }), "Starting…");
  for (const kind of ["critique", "save_as", "save_over", "refresh_from_disk", "send_to_editor", "get_from_editor"]) assert.equal(text({ pendingKind: kind }), "Studio: " + kind + "…", kind);
  assert.equal(text({ pendingKind: null }), "Studio: null…", "busy without a request, such as a mode switch, keeps its wording");
  assert.equal(text({ uiBusy: false, pendingKind: null }), "");
  assert.equal(text({ uiBusy: true, pendingKind: "direct", wsState: "Connecting" }), "Reconnecting…");
  c.wsState = "Ready";
  assert.match(text({ studioRuntimeActivity: { run: { origin: "studio", startedAt: Date.now() } } }), /^0:0\d$/, "once Pi starts, the run's own status");
});

test("Run keeps its look only while its own request is pending, and Stop still needs the real run", () => {
  assert.match(source, /sendRunBtn\.classList\.toggle\("request-pending", !directIsStop && !documentView && uiBusy && pendingKind === "direct" && !studioRuntimeActivity\?\.run\n\s+&& wsState !== "Disconnected" && wsState !== "Connecting"\);/);
  assert.match(source, /if \(run && sendRunBtn\) sendRunBtn\.classList\.toggle\("request-pending", false\);/);
  assert.match(css, /#sendRunBtn\.request-pending:disabled:not\(\.repl-secondary-action\) \{\n\s+background: var\(--accent\);\n\s+border-color: var\(--accent\);\n\s+color: var\(--accent-contrast\);\n\s+font-weight: 600;\n\s+opacity: 0\.7;\n\s+cursor: progress;\n\s+\}/);
  assert(css.indexOf("#sendRunBtn.request-pending:disabled") > css.indexOf("#sendRunBtn:not(:disabled):not(.request-stop-active)"), "after the primary rule");
  assert(!/#sendRunBtn\.request-pending:disabled \{/.test(css), "Run stays plain where it's deliberately plain (single editor, REPL view)");
});

// Astra's fixture: the real Run click listener, request_started handler, button sync, runtime
// presentation and CSS, with transport and other state as seams. No server or model.
test("click → request started → running: no extra toolbar row comes and goes; Run never flashes hollow", { timeout: 120_000 }, async () => {
  const testBrowser = dedicatedTestBrowser(), executablePath = testBrowser.path;
  assert(executablePath, testBrowser.message);
  const names = ["getAbortablePendingKind", "syncRunAndCritiqueButtons", "getStudioRuntimeStatusText", "syncStudioRuntimePresentation", "applyStudioRuntimeActivity",
    "getStudioActionLabel", "formatQueuedSteeringSuffix", "getStudioBusyStatus", "syncPromptRunIndicator", "beginUiAction", "setBusy"];
  const clickStart = source.indexOf('      sendRunBtn.addEventListener("click", (event) => {'), clickEnd = source.indexOf("\n      if (queueSteerBtn)", clickStart);
  const startedStart = source.indexOf('        if (message.type === "request_started") {'), startedEnd = source.indexOf('        if (message.type === "request_queued")', startedStart);
  assert(clickStart > 0 && clickEnd > clickStart && startedStart > 0 && startedEnd > startedStart);
  const fixture = `
const sendRunBtn=document.getElementById('sendRunBtn'), queueSteerBtn=document.getElementById('queueSteerBtn'), sourceTextEl=document.getElementById('sourceText');
const sendReplBtn=null,replSendModeSelect=null,critiqueBtn=null,quizBtn=null;
const isEditorOnlyMode=false,isWatchedFilePreview=false,bufferSwitchingEnabled=true,documentHostingEnabled=false;
const selected={id:'prompt',role:'prompt'}, bufferRecoveryClient={snapshot:()=>({activePromptId:'prompt'})};
const getStudioSelectedBuffer=()=>selected, getActiveReplSessionForCurrentRuntime=()=>null, getStudioShortcutDescription=()=>'';
const syncReplEchoModeSelect=()=>{},syncShowMeButton=()=>{},syncAskAsideButton=()=>{},syncStudioUiRefreshReviewTrigger=()=>{};
const syncFooterSpinnerState=()=>{},renderStatus=()=>{},clearTitleAttention=()=>{},makeRequestId=()=>'fixture-request',armTitleAttentionForRequest=()=>{},beginTrackedStudioActivity=()=>{};
const setWsState=value=>{wsState=value;},setStatus=()=>{},requireStudioPromptForSend=()=>true,prepareEditorTextForRunRequest=text=>text;
const submittedEditorDrafts={remember:()=>{}},getEditorDraftSourceKey=()=>'',rememberPromptRun=()=>{},reserveLinkedPiEditorDraftSnapshot=()=>null;
const messages=[],sendMessage=message=>{messages.push(message);return true;},requestCancelForPendingRequest=()=>{throw Error('unexpected cancellation')};
let studioRuntimeActivity={run:null,compaction:null},studioRunChainActive=false,studioStopRequestedRunId=null,studioRuntimeClock=null;
let uiBusy=false,wsState='Ready',rightView='preview',pendingRequestId=null,pendingKind=null,stickyStudioKind=null;
let agentBusyFromServer=false,compactInProgress=false,studioBusyEpoch=0,studioFilePick=null,paneFocusTarget=null;
let queuedSteeringCount=0,terminalActivityPhase='idle',terminalActivityLabel='',terminalActivityToolName='',lastSpecificToolLabel='';
let annotationsEnabled=true,linkedPiEditorDraftSnapshot=null,promptRunIndicatorReady=true;
const promptRunIndicatorTracker={state:()=>({phase:'not-run'})};
const studioUiRefreshUi={runStatus:document.querySelector('.studio-run-status'),promptRunIndicator:document.querySelector('.studio-prompt-run-indicator'),headerRunStatus:document.createElement('span'),headerStop:document.createElement('button')};
function syncActionButtons(){syncPromptRunIndicator();syncRunAndCritiqueButtons();syncStudioRuntimePresentation();}
function receiveStarted(message){${source.slice(startedStart, startedEnd)}}
function reset(){if(studioRuntimeClock)clearInterval(studioRuntimeClock);studioRuntimeClock=null;studioRuntimeActivity={run:null,compaction:null};studioRunChainActive=false;uiBusy=false;wsState='Ready';pendingRequestId=null;pendingKind=null;terminalActivityPhase='idle';syncActionButtons();}
function running(){applyStudioRuntimeActivity({runtimeActivity:{run:{id:'fixture-run',origin:'studio',kind:'direct',requestId:'fixture-request',startedAt:Date.now(),cancellable:true}}});syncActionButtons();}
${names.map(extract).join("\n")}
${source.slice(clickStart, clickEnd)}
reset();
`;
  const html = `<!doctype html><html><head><meta charset='utf-8'><style>:root{--bg:#faf4ed;--panel:#fffaf3;--panel-2:#f2e9e1;--text:#575279;--muted:#797593;--panel-border:#dfdad9;--control-border:#cecacd;--accent:#56949f;--accent-contrast:#fff;--error:#b4637a;--error-contrast:#fff;} #fixture{margin:24px;width:700px;} #sourceText{display:block;width:100%;height:180px;resize:none;} </style></head><body class='studio-ui-refresh studio-workspace-layout' data-buffer-switching='1'><div id='fixture'><div class='source-meta'><div class='studio-refresh-toolbar'><div class='studio-refresh-toolbar-main'><div class='studio-refresh-toolbar-actions'><div class='studio-refresh-action-line'><button id='sendRunBtn' type='button'>Run editor text</button><span class='studio-prompt-run-indicator' hidden></span><span class='studio-run-status' hidden></span><button id='queueSteerBtn' type='button' hidden disabled>Queue steering</button><span class='studio-refresh-tools'><button id='reviewNotesBtn'>Comments</button><button id='scratchpadBtn'>Scratchpad</button><span class='studio-refresh-menu-anchor studio-refresh-review-anchor'><button class='studio-refresh-tool-tab studio-refresh-review-btn studio-refresh-chip'>Review</button></span><span class='studio-refresh-menu-anchor studio-refresh-view-anchor'><button class='studio-refresh-chip'>View</button></span></span></div><div class='studio-refresh-action-line studio-refresh-utility-action-line'></div><div class='studio-refresh-action-line repl-action-line' hidden></div></div><div class='studio-refresh-toolbar-state'></div></div></div></div><textarea id='sourceText'>Fixture only. No model request is sent.</textarea></div></body></html>`;
  let browser;
  const errors = [], network = [];
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const page = await browser.newPage();
    page.on("pageerror", e => errors.push(e.message));
    await page.setRequestInterception(true); page.on("request", r => { network.push(r.url()); void r.abort(); });
    await page.setViewport({ width: 1200, height: 450, deviceScaleFactor: 1 });
    await page.setContent(html); await page.addStyleTag({ content: css }); await page.addScriptTag({ content: fixture });
    // Sampled after the 120 ms colour transition settles.
    const sample = async () => { await new Promise(r => setTimeout(r, 200)); return page.evaluate(() => {
      const box = s => document.querySelector(s).getBoundingClientRect(), style = getComputedStyle(sendRunBtn);
      return { editorY: box("#sourceText").y, button: { text: sendRunBtn.textContent, disabled: sendRunBtn.disabled, background: style.backgroundColor, weight: style.fontWeight, opacity: style.opacity, height: box("#sendRunBtn").height },
        status: document.querySelector(".studio-run-status").textContent, statusWidth: box(".studio-run-status").width, steerX: box("#queueSteerBtn").x };
    }); };
    // Includes Astra's widths that wrapped and then unwrapped in 0.10.0 (480, 490, 710–780).
    for (const width of [480, 490, 600, 700, 710, 740, 780, 1000]) {
      await page.evaluate(width => { document.getElementById("fixture").style.width = width + "px"; reset(); }, width);
      const idle = await sample();
      await page.click("#sendRunBtn"); const clicked = await sample();
      await page.evaluate(() => receiveStarted({ type: "request_started", kind: "direct", requestId: "fixture-request" })); const started = await sample();
      await page.evaluate(() => running()); const run = await sample();
      assert(Math.max(clicked.editorY, started.editorY) <= Math.max(idle.editorY, run.editorY), "no row that comes and goes at " + width + "px");
      assert.equal(run.editorY, started.editorY, "nothing moves when Pi starts, at " + width + "px");
      for (const pending of [clicked, started]) {
        assert.deepEqual([pending.button.text, pending.button.disabled, pending.button.background, pending.button.weight, pending.button.opacity, pending.button.height],
          ["Run Prompt", true, idle.button.background, idle.button.weight, "0.7", 28], "pending keeps Run's look at " + width + "px");
        assert.equal(pending.status, "Starting…");
      }
      assert.deepEqual([run.button.text, run.button.disabled, run.status], ["Stop", false, "0:00"]);
      // Oliver, 22 Oct: the status keeps room for "Starting…" and "Stopping…", so Queue steering doesn't move
      // when the clock starts, ticks or is stopped, and no more, so the tools fit on the row in more windows.
      assert.equal(run.statusWidth, started.statusWidth, "the clock keeps Starting…'s width at " + width + "px");
      const showing = text => page.evaluate(text => {
        const status = document.querySelector(".studio-run-status"); status.textContent = text;
        const range = document.createRange(); range.selectNodeContents(status);
        return { width: status.getBoundingClientRect().width, text: range.getBoundingClientRect().width, steerX: queueSteerBtn.getBoundingClientRect().x };
      }, text);
      for (const text of ["10:00", "99:59", "Stopping…"]) {
        const shown = await showing(text);
        assert.deepEqual([shown.width, shown.steerX], [run.statusWidth, run.steerX], "nothing moves at " + text + ", at " + width + "px");
      }
      const widest = Math.max((await showing("Starting…")).text, (await showing("Stopping…")).text);
      assert(Math.abs(run.statusWidth - widest) < 1, "the room is no wider than Starting… or Stopping… at " + width + "px: " + run.statusWidth + " vs " + widest);
    }
    assert.deepEqual(errors, []); assert.deepEqual(network, []);
  } finally { await browser?.close(); }
});
