import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import puppeteer from "puppeteer-core";

// Real DOM/input/focus and production toolbar functions/CSS. The buffer client
// below is a seam; exact packaged server/recovery integration is checked separately.
const source = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../client/studio.css", import.meta.url), "utf8");
const start = source.indexOf("function studioBuffersCanAddSelection("), end = source.indexOf("async function promptStudioBufferDocumentPath()", start);
assert(start > 0 && end > start);
const functions = source.slice(start, end);
const fixture = `
const sourceTextEl = document.querySelector('textarea'), leftPaneEl = document.querySelector('#leftPane');
const sourcePreviewEl = document.querySelector('#sourcePreview'), critiqueViewEl = document.querySelector('#critiqueView');
const importFileBtn = document.querySelector('#importFileBtn'), getEditorBtn = document.querySelector('#getEditorBtn');
const clearWorkspaceBtn = null;
let bufferSwitcherUi = null, bufferBindingInProgress = false, bufferSwitchingEnabled = true;
let studioSelectionAppendSourceActive = false, studioSelectionAppendOwnerGeneration = 0, studioDocumentAppendOwnerGeneration = 0;
let bufferViewRestore = null, uiBusy = false, agentBusyFromServer = false, editorView = 'markdown', generation = 0;
const ws = {readyState: 1}, wsState = 'Ready', pendingBufferDocumentOpen = null, pendingPiEditorLoad = null,
 pendingPiEditorLink = null, pendingPiEditorClear = null, pendingTerminalDocument = null, activeFileImport = null, fileBackedBaselineText = null;
const state = {selectedBufferId:'doc',activePromptId:'prompt',buffers:[
 {id:'prompt',role:'prompt',revision:1,text:'Keep Prompt',sourceState:{path:'/PROMPT.md'},baselineText:'Keep Prompt'},
 {id:'doc',role:'document',revision:1,text:'Notes with [an: exact note] and more.',sourceState:{path:'/NOTES.md'},baselineText:'Notes with [an: exact note] and more.'}]};
const calls = [];
const getStudioSelectedBuffer = () => state.buffers.find(b => b.id === state.selectedBufferId);
const isStudioDocumentBufferView = () => getStudioSelectedBuffer().role === 'document';
const studioBuffersCanSwitch = () => true, studioBuffersCanOpenDocument = () => true, pendingStudioBufferEditorView = () => null;
const basenameForStudioPath = p => p.split('/').at(-1), getPreviewSelectionPaneIdForNode = e => e === sourcePreviewEl ? 'source' : null;
const closeStudioUiRefreshMenus = () => {}, scheduleWorkspacePersistence = () => {};
const buildWorkspacePersistencePayload = () => ({}), bufferRecoveryExtra = () => ({});
const captureRecoveryConsent = () => ({generation, buffer:state.selectedBufferId, text:sourceTextEl.value});
const recoveryConsentIsCurrent = c => c.generation === generation && c.buffer === state.selectedBufferId && c.text === sourceTextEl.value;
const setStatus = (...args) => calls.push(['status',...args]);
const bufferRecoveryClient = {snapshot:()=>state,capture:()=>({ok:true}),
 documentAppendInfo:()=>getStudioSelectedBuffer().text ? {ok:true,addedCharacters:99,availableCharacters:800000} : {ok:false,message:'Document is empty. Nothing to add.'},
 appendSelectionToPrompt: intent => { const text = getStudioSelectedBuffer().text.slice(intent.start,intent.end); calls.push(['selection',text]); state.buffers[0].text += '\\n' + text; state.buffers[0].revision++;return {ok:true}; },
 appendDocumentToPrompt: intent => { const text = getStudioSelectedBuffer().text; calls.push(['document',text]); state.buffers[0].text += '\\n' + text; state.buffers[0].revision++;return {ok:true}; }};
function selectStudioBuffer(id) { state.selectedBufferId=id; generation++; studioSelectionAppendSourceActive=false; sourceTextEl.value=getStudioSelectedBuffer().text; syncStudioBufferSwitcher(); }
async function promptStudioBufferDocumentPath() { calls.push(['open','document',document.activeElement.id]); }
importFileBtn.addEventListener('click', event => { event.stopPropagation(); calls.push(['import',getStudioSelectedBuffer().role,document.activeElement.id]); });
getEditorBtn.addEventListener('click', () => calls.push(['pi',getStudioSelectedBuffer().role,document.activeElement.id]));
sourceTextEl.addEventListener('input', () => { getStudioSelectedBuffer().text=sourceTextEl.value; getStudioSelectedBuffer().revision++; generation++; syncStudioBufferSwitcher(); });
sourceTextEl.value=getStudioSelectedBuffer().text;
`;

test("compact buffer disclosures preserve native selection, keyboard access and source destinations", { timeout: 60_000 }, async t => {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  assert(executablePath && existsSync(executablePath), "Set PUPPETEER_EXECUTABLE_PATH to a dedicated test Chromium executable; no everyday-browser fallback.");
  let browser, page;
  const errors = [];
  try {
    browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const reset = async () => {
      await page?.close(); page = await browser.newPage();
      page.on("pageerror", e => errors.push(e.message));
      await page.setViewport({ width: 1300, height: 900 });
      await page.setContent(`<!doctype html><html><body><header><button id="importFileBtn">Import</button><button id="getEditorBtn">Load Pi</button></header><main><section id="leftPane"><div class="source-wrap"><textarea rows="12"></textarea><div id="sourcePreview" tabindex="0">Preview selection</div></div></section><section id="critiqueView"></section></main></body></html>`);
      await page.addStyleTag({ content: css });
      await page.addScriptTag({ content: fixture + functions + "\nsetupStudioBufferSwitcher();" });
    };
    const selectText = async () => page.evaluate(() => { sourceTextEl.focus(); sourceTextEl.setSelectionRange(11, 27); sourceTextEl.dispatchEvent(new Event("select")); });
    const actions = async () => page.evaluate(() => calls.filter(c => ["selection", "document", "open", "import", "pi"].includes(c[0])));
    await t.test("closed strip has only two buffer tabs and two disclosures; legacy loaders moved, not duplicated", async () => {
      await reset();
      const result = await page.evaluate(() => ({
        visible: [...document.querySelectorAll('#studioBufferSwitcher button')].filter(e => e.getClientRects().length).map(e => e.textContent),
        headerLoaders: document.querySelectorAll('header #importFileBtn, header #getEditorBtn').length,
        copies: document.querySelectorAll('#importFileBtn').length,
        helpInMenu: document.querySelector('#studioAddDocumentInfo').closest('.studio-buffer-menu').hidden,
        extraRow: !!document.querySelector('.studio-buffer-target, .studio-buffer-document-info'),
      }));
      assert.deepEqual(result.visible, ["Prompt · PROMPT.md", "Document · NOTES.md", "Open / load ▾", "Add to Prompt ▾"]);
      assert.equal(result.headerLoaders, 0); assert.equal(result.copies, 1); assert(result.helpInMenu); assert(!result.extraRow);
    });
    await t.test("pointer opens Add without losing the editor range; selection appends once and closes", async () => {
      await reset(); await selectText();
      const before = await page.$eval('textarea', e => ({ text:e.value,start:e.selectionStart,end:e.selectionEnd }));
      await page.click('#studioBufferAddBtn'); assert.equal(await page.$eval('#studioAddSelectionBtn', e => e.disabled), false);
      await page.click('#studioAddSelectionBtn');
      assert.deepEqual(await actions(), [["selection", before.text.slice(before.start,before.end)]]);
      assert.deepEqual(await page.$eval('textarea', e => ({text:e.value,start:e.selectionStart,end:e.selectionEnd})), before);
      assert.equal(await page.$eval('#studioBufferAddBtn', e => e.getAttribute('aria-expanded')), 'false');
    });
    await t.test("keyboard Tab → disclosure → Enter copies the same selection; Escape returns focus without copying", async () => {
      await reset(); await selectText();
      await page.focus('#studioBufferAddBtn'); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'studioAddSelectionBtn');
      await page.keyboard.press('Escape'); assert.equal(await page.evaluate(() => document.activeElement.id), 'studioBufferAddBtn');
      assert.deepEqual(await actions(), []);
      await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
      assert.equal((await actions()).filter(a=>a[0]==='selection').length, 1);
    });
    await t.test("whole document needs no selection; arrow navigation reaches it and Space adds once", async () => {
      await reset(); await selectText(); await page.click('#studioBufferAddBtn');
      await page.keyboard.press('ArrowDown'); assert.equal(await page.evaluate(() => document.activeElement.id), 'studioAddDocumentBtn');
      await page.keyboard.press('Space'); assert.equal((await actions())[0][0], 'document');
      await page.evaluate(() => { sourceTextEl.setSelectionRange(0,0); });
      await page.click('#studioBufferAddBtn'); assert.equal(await page.$eval('#studioAddSelectionBtn', e=>e.disabled), true);
      await page.click('#studioAddDocumentBtn'); assert.equal((await actions()).filter(a=>a[0]==='document').length, 2);
    });
    await t.test("preview or other field cannot lend its selection to Add", async () => {
      await reset(); await selectText(); await page.click('#sourcePreview'); await page.click('#studioBufferAddBtn');
      assert.equal(await page.$eval('#studioAddSelectionBtn', e=>e.disabled), true);
      assert.equal(await page.$eval('#studioAddDocumentBtn', e=>e.disabled), false);
      await page.keyboard.press('Escape'); await page.click('#studioBufferLoadBtn'); await page.keyboard.press('Escape');
      await page.click('#studioBufferAddBtn'); assert.equal(await page.$eval('#studioAddSelectionBtn', e=>e.disabled), true);
      await page.keyboard.press('Escape'); await selectText(); await page.click('#studioBufferAddBtn');
      await page.click('#studioAddSelectionInfo');
      assert.equal(await page.$eval('#studioAddSelectionBtn', e=>e.disabled), true, 'menu help cannot become editor selection permission');
    });
    await t.test("source actions label the selected destination; opening a file still targets Document", async () => {
      await reset();
      for (const [tab, role] of [['#studioPromptBufferBtn','Prompt'], ['#studioDocumentBufferBtn','Document']]) {
        await page.click(tab); await page.click('#studioBufferLoadBtn');
        assert.equal(await page.$eval('#importFileBtn',e=>e.textContent), 'Import file into '+role+'…');
        assert.equal(await page.$eval('#getEditorBtn',e=>e.textContent), 'Load Pi draft into '+role);
        await page.click('#importFileBtn');
        assert.deepEqual((await actions()).at(-1), ['import',role.toLowerCase(),'studioBufferLoadBtn']);
        await page.click('#studioBufferLoadBtn'); await page.click('#getEditorBtn');
        assert.deepEqual((await actions()).at(-1), ['pi',role.toLowerCase(),'studioBufferLoadBtn']);
        await page.click('#studioBufferLoadBtn'); await page.click('#studioOpenDocumentBtn');
        assert.deepEqual((await actions()).at(-1), ['open','document','studioBufferLoadBtn']);
      }
    });
    await t.test("buffer change closes a displayed menu; outside click and Tab-out dismiss without an action", async () => {
      await reset(); await selectText(); await page.click('#studioBufferAddBtn');
      await page.evaluate(() => selectStudioBuffer('prompt'));
      assert.equal(await page.$eval('#studioBufferAddBtnMenu', e=>e.hidden), true);
      await page.click('#studioBufferLoadBtn'); await page.keyboard.press('End'); await page.keyboard.press('Tab');
      assert.equal(await page.$eval('#studioBufferLoadBtnMenu', e=>e.hidden), true);
      await page.click('#studioBufferAddBtn');
      // The textarea centre can lie underneath the popup. Hit an uncovered
      // corner and verify the event really reached the editor, not menu help.
      await page.evaluate(() => document.addEventListener('pointerdown', e => { window.outsideTarget=e.target.tagName; }, {once:true,capture:true}));
      await page.click('textarea', {offset:{x:5,y:5}});
      assert.equal(await page.evaluate(() => window.outsideTarget), 'TEXTAREA');
      assert.equal(await page.$eval('#studioBufferAddBtnMenu', e=>e.hidden), true); assert.deepEqual(await actions(), []);
    });
    await t.test("wrapped disclosures remain inside a narrow pane and viewport", async () => {
      await reset(); await page.setViewport({width:760,height:900});
      for (const id of ['studioBufferLoadBtn','studioBufferAddBtn']) {
        await page.click('#'+id);
        const bounds = await page.evaluate(id => {
          const m=document.getElementById(id+'Menu').getBoundingClientRect(), p=leftPaneEl.getBoundingClientRect();
          return {left:m.left,right:m.right,bottom:m.bottom,paneLeft:p.left,paneRight:p.right,paneBottom:p.bottom,width:innerWidth,height:innerHeight};
        },id);
        assert(bounds.left >= Math.max(0,bounds.paneLeft)); assert(bounds.right <= Math.min(bounds.width,bounds.paneRight));
        assert(bounds.bottom <= Math.min(bounds.height,bounds.paneBottom));
        await page.keyboard.press('Escape');
      }
    });
    await t.test("empty and Prompt states expose explanations only in the opened disclosure", async () => {
      await reset(); await page.evaluate(() => { sourceTextEl.value=''; sourceTextEl.dispatchEvent(new Event('input')); });
      await page.click('#studioBufferAddBtn'); assert.equal(await page.$eval('#studioAddDocumentBtn',e=>e.disabled),true);
      assert.match(await page.$eval('#studioAddDocumentInfo',e=>e.textContent), /empty/);
      await page.click('#studioPromptBufferBtn'); await page.click('#studioBufferAddBtn');
      assert.match(await page.$eval('#studioAddDocumentInfo',e=>e.textContent), /Switch to Document first/);
    });
    assert.deepEqual(errors, []);
  } finally { await browser?.close(); }
});
