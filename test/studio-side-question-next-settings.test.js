import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../client/studio-client.js', import.meta.url), 'utf8');
function declaration(name) {
  const start = source.indexOf('      function ' + name + '(') >= 0 ? source.indexOf('      function ' + name + '(') : source.indexOf('      async function ' + name + '(');
  assert(start >= 0, 'missing ' + name); const open = source.indexOf(') {', start) + 2; let depth = 0, quote = null;
  for (let i = open; i < source.length; i++) {
    const ch = source[i]; if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '/' && source[i + 1] === '/') { i = source.indexOf('\n', i); continue; }
    if (ch === '/' && source[i + 1] === '*') { i = source.indexOf('*/', i) + 1; continue; }
    if (ch === '{') depth++; if (ch === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unclosed ' + name);
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }
class Control {
  constructor(field, value, { next = true, tool, checked = false } = {}) { this.field = field; this.value = value; this.next = next; this.tool = tool; this.checked = checked; }
  getAttribute(key) { return key === 'data-side-question-field' ? this.field : key === 'data-side-question-tool' ? this.tool : null; }
  hasAttribute(key) { return key === 'data-side-question-next' && this.next; }
}
function harness() {
  const sent = [], statuses = [], stored = []; const ask = { disabled: false };
  const c = vm.createContext({ sideQuestionUi: { focusMode: 'editor', gatherScope: 'none', customPath: '/old', includeConversation: true, gitContext: true, webSearch: true, toolIds: ['a'.repeat(24)], thinking: 'low', draft: 'Follow-up' },
    sideQuestionState: { threadId: 'thread-A', status: 'idle', modelLabel: 'Captured model', thinking: 'low', messages: [{ role: 'assistant', status: 'complete', text: 'Old answer' }], activity: [], context: { focusLabel: 'FROZEN text', gatherScope: 'repo', contextRoot: '/FROZEN', tools: [{ name: 'FROZEN tool' }] } },
    sideQuestionNextSettings: null, sideQuestionNextOptionsOpen: false, sideQuestionPreferredThinking: 'low', rightView: 'side-questions',
    sideQuestionAvailablePiTools: [{ id: 'a'.repeat(24), name: 'read', source: 'Ext', gateway: false }, { id: 'b'.repeat(24), name: 'gateway', source: 'Ext', gateway: true }],
    sideQuestionThinkingLevels: ['off', 'low', 'high'], SIDE_QUESTION_THINKING_LEVELS: ['off', 'low', 'high', 'max'],
    sideQuestionWebSearchAvailable: true, sideQuestionContextGrantPending: false,
    SIDE_QUESTION_GATHER_STORAGE_KEY: 'gather', SIDE_QUESTION_THINKING_STORAGE_KEY: 'thinking', SIDE_QUESTION_TOOLS_STORAGE_KEY: 'tools',
    Element: Control, HTMLInputElement: Control, HTMLSelectElement: Control, HTMLTextAreaElement: Control,
    critiqueViewEl: { querySelector: () => ask }, window: { localStorage: { setItem: (...args) => stored.push(args) } },
    sourceState: {}, getEffectiveSavePath: () => '/editor/current.md', getCurrentResourceDirValue: () => '/editor',
    sideQuestionHelpers: { getDefaultStudioSideQuestionGatherScope: () => 'folder' },
    requestStudioConfirmation: async () => true, isSideQuestionConnectionReady: () => true,
    renderSideQuestionView() {}, updateResultActionButtons() {}, updateReferenceBadge() {}, syncAskAsideButton() {},
    setStatus: (...args) => statuses.push(args), sendMessage: message => { sent.push(plain(message)); return true; },
    makeRequestId: () => 'request', normalizeSideQuestionState: () => ({ messages: [], context: {}, activity: [] }),
    buildSideQuestionContextPayload: () => { throw new Error('active follow-up must not gather future context'); },
    escapeHtml: value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll("'", '&#39;'),
    getLatestCompletedSideQuestionAnswer: () => null, formatReferenceTime: value => value,
    bufferSwitchingEnabled: false, studioUiRefreshUi: null,
  });
  for (const name of ['cloneSideQuestionSettings', 'getSideQuestionNextSettings', 'getSideQuestionControlSettings', 'sideQuestionSettingsAreCurrent', 'getSideQuestionGatherScope', 'persistSideQuestionToolSelection', 'getSideQuestionThinkingOptions', 'renderSideQuestionPiToolPicker', 'sideQuestionSelectOptions', 'renderSideQuestionOptions', 'sideQuestionsSimplified', 'sideQuestionModelText', 'sideQuestionFolderText', 'renderSideQuestionThread', 'startNewSideQuestionThread', 'handleSideQuestionInput', 'handleSideQuestionChange', 'submitSideQuestion', 'clampSideQuestionThinkingLevel', 'applySideQuestionThinkingLevels', 'applySideQuestionToolCatalog']) vm.runInContext(declaration(name), c);
  return { c, sent, statuses, stored, ask };
}
test('next settings are independent copies and preserve legacy New defaults without capturing editor bytes', () => {
  const h = harness(), before = plain(h.c.sideQuestionUi); const next = h.c.getSideQuestionNextSettings();
  assert.equal(next.focusMode, 'auto'); assert.equal(next.customPath, ''); assert.equal(next.webSearch, false); assert.equal(next.includeConversation, false);
  next.toolIds.push('b'.repeat(24)); assert.deepEqual(plain(h.c.sideQuestionUi), before); assert.equal(h.sent.length, 0);
  assert.doesNotMatch(declaration('cloneSideQuestionSettings'), /sourceTextEl|focusText|sourcePath|resourceDir|grant|checkpoint|sendMessage/);
});
test('active transcript has separately named future controls; its displayed scope and captured tools stay frozen', () => {
  const h = harness(); h.c.getSideQuestionNextSettings().gatherScope = 'custom'; h.c.sideQuestionNextSettings.customPath = '/NEXT/<script>';
  const html = h.c.renderSideQuestionThread(); assert.match(html, /Scope: FROZEN text.*FROZEN.*FROZEN tool/);
  assert.match(html, /<summary>Next thread settings<\/summary>/); assert.match(html, /data-side-question-next[^>]*data-side-question-field='focusMode'/);
  assert.match(html, /data-side-question-next[^>]*data-side-question-tool=/); assert.match(html, /\/NEXT\/&lt;script>/);
  assert.match(html, /only after.*New thread/i); assert.doesNotMatch(html, /<script>/);
});
test('future controls mutate neither captured context nor current question/settings and request no provider or access', async () => {
  const h = harness(), ui = plain(h.c.sideQuestionUi), state = plain(h.c.sideQuestionState);
  for (const [field, value, checked] of [['focusMode', 'response'], ['gatherScope', 'custom'], ['thinking', 'high'], ['includeConversation', '', true], ['webSearch', '', true]]) {
    await h.c.handleSideQuestionChange({ target: new Control(field, value, { checked }) });
  }
  h.c.handleSideQuestionInput({ target: new Control('customPath', '/NEXT') });
  assert.deepEqual(plain(h.c.sideQuestionUi), ui); assert.deepEqual(plain(h.c.sideQuestionState), state); assert.equal(h.sent.length, 0);
  assert.equal(h.c.sideQuestionNextSettings.customPath, '/NEXT'); assert.equal(h.c.sideQuestionNextSettings.thinking, 'high'); assert.equal(h.ask.disabled, false);
});
test('follow-up sends only existing thread identity, ignoring invalid future custom path and pending tools', async () => {
  const h = harness(); h.c.getSideQuestionNextSettings().gatherScope = 'custom'; h.c.sideQuestionNextSettings.customPath = '';
  h.c.sideQuestionNextSettings.toolIds = ['b'.repeat(24)]; await h.c.submitSideQuestion();
  assert.deepEqual(h.sent, [{ type: 'side_question_ask_request', requestId: 'request', question: 'Follow-up', threadId: 'thread-A' }]);
  assert.equal(h.c.sideQuestionNextSettings.customPath, ''); assert.equal(h.c.sideQuestionState.context.contextRoot, '/FROZEN');
});
test('cancelled New preserves current thread, follow-up and all staged settings; confirmed New alone applies them', async () => {
  const h = harness(); const next = h.c.getSideQuestionNextSettings(); Object.assign(next, { gatherScope: 'custom', customPath: '/NEXT', includeConversation: true, thinking: 'high', preferredThinking: 'high' });
  const state = plain(h.c.sideQuestionState), ui = plain(h.c.sideQuestionUi), staged = plain(next);
  h.c.requestStudioConfirmation = async () => false; assert.equal(await h.c.startNewSideQuestionThread(), false);
  assert.deepEqual(plain(h.c.sideQuestionState), state); assert.deepEqual(plain(h.c.sideQuestionUi), ui); assert.deepEqual(plain(next), staged); assert.equal(h.sent.length, 0);
  h.c.requestStudioConfirmation = async () => true; assert.equal(await h.c.startNewSideQuestionThread(), true);
  assert.deepEqual(h.sent, [{ type: 'side_question_clear_request', threadId: 'thread-A' }]); assert.equal(h.c.sideQuestionState, null);
  assert.equal(h.c.sideQuestionUi.customPath, '/NEXT'); assert.equal(h.c.sideQuestionUi.thinking, 'high'); assert.equal(h.c.sideQuestionUi.draft, ''); assert.equal(h.c.sideQuestionNextSettings, null);
});
test('stale New confirmation cannot clear a different or changed thread, running answer, new draft or altered staged settings', async () => {
  for (const change of [c => { c.sideQuestionState = { ...c.sideQuestionState, threadId: 'thread-B' }; }, c => { c.sideQuestionState = { ...c.sideQuestionState }; }, c => { c.sideQuestionState.status = 'running'; }, c => { c.sideQuestionUi.draft = 'New unseen question'; }, c => { c.sideQuestionNextSettings.customPath = '/OTHER'; }]) {
    const h = harness(); let finish; h.c.requestStudioConfirmation = () => new Promise(resolve => { finish = resolve; });
    const pending = h.c.startNewSideQuestionThread(); change(h.c); const state = plain(h.c.sideQuestionState), ui = plain(h.c.sideQuestionUi), staged = plain(h.c.sideQuestionNextSettings);
    finish(true); assert.equal(await pending, false); assert.equal(h.sent.length, 0); assert.deepEqual(plain(h.c.sideQuestionState), state); assert.deepEqual(plain(h.c.sideQuestionUi), ui); assert.deepEqual(plain(h.c.sideQuestionNextSettings), staged);
  }
});
test('disconnected, running and refused clear never apply next settings or clear current work', async () => {
  for (const kind of ['disconnected', 'running', 'send-refused']) {
    const h = harness(); h.c.getSideQuestionNextSettings().customPath = '/NEXT'; const before = plain(h.c.sideQuestionUi);
    if (kind === 'disconnected') h.c.isSideQuestionConnectionReady = () => false;
    if (kind === 'running') h.c.sideQuestionState.status = 'running';
    if (kind === 'send-refused') h.c.sendMessage = () => false;
    assert.equal(await h.c.startNewSideQuestionThread(), false); assert.deepEqual(plain(h.c.sideQuestionUi), before); assert.equal(h.c.sideQuestionState.threadId, 'thread-A'); assert.equal(h.c.sideQuestionNextSettings.customPath, '/NEXT');
  }
});
test('stale setup controls cannot change settings while an active thread owns the composer', async () => {
  const h = harness(), before = plain(h.c.sideQuestionUi);
  await h.c.handleSideQuestionChange({ target: new Control('gatherScope', 'custom', { next: false }) });
  h.c.handleSideQuestionInput({ target: new Control('customPath', '/BAD', { next: false }) });
  assert.deepEqual(plain(h.c.sideQuestionUi), before); assert.equal(h.c.sideQuestionNextSettings, null);
});
test('gateway consent remains required and stale confirmation cannot mutate another thread or overwrite newer selections', async () => {
  const h = harness(); h.c.getSideQuestionNextSettings(); let finish; h.c.requestStudioConfirmation = () => new Promise(resolve => { finish = resolve; });
  const pending = h.c.handleSideQuestionChange({ target: new Control(null, '', { tool: 'b'.repeat(24), checked: true }) });
  h.c.sideQuestionNextSettings.toolIds = []; finish(true); await pending; assert.deepEqual(plain(h.c.sideQuestionNextSettings.toolIds), ['b'.repeat(24)]);
  const other = harness(); other.c.getSideQuestionNextSettings(); other.c.requestStudioConfirmation = () => new Promise(resolve => { finish = resolve; });
  const stale = other.c.handleSideQuestionChange({ target: new Control(null, '', { tool: 'b'.repeat(24), checked: true }) }); other.c.sideQuestionState = { ...other.c.sideQuestionState, threadId: 'thread-B' }; finish(true); await stale;
  assert.deepEqual(plain(other.c.sideQuestionNextSettings.toolIds), ['a'.repeat(24)]); assert.equal(other.sent.length, 0);
});
test('gateway cancellation and the existing twelve-tool bound stay in force for future settings', async () => {
  const h = harness(); h.c.requestStudioConfirmation = async () => false;
  await h.c.handleSideQuestionChange({ target: new Control(null, '', { tool: 'b'.repeat(24), checked: true }) });
  assert.deepEqual(plain(h.c.sideQuestionNextSettings.toolIds), ['a'.repeat(24)]); assert.equal(h.sent.length, 0);
  const full = harness(); full.c.getSideQuestionNextSettings().toolIds = Array.from({ length: 12 }, (_, n) => String(n).padStart(24, '0'));
  const before = plain(full.c.sideQuestionNextSettings.toolIds);
  await full.c.handleSideQuestionChange({ target: new Control(null, '', { tool: 'a'.repeat(24), checked: true }) });
  assert.deepEqual(plain(full.c.sideQuestionNextSettings.toolIds), before); assert.match(full.statuses.at(-1)[0], /at most 12/);
});
test('future preferences stay staged through cancellation/refusal and persist only after accepted New', async () => {
  for (const outcome of ['cancel', 'refuse', 'accept']) {
    const h = harness(), c = h.c; c.sideQuestionPreferredThinking = 'max';
    await c.handleSideQuestionChange({ target: new Control('thinking', 'high') });
    await c.handleSideQuestionChange({ target: new Control('gatherScope', 'repo') });
    await c.handleSideQuestionChange({ target: new Control(null, '', { tool: 'b'.repeat(24), checked: true }) });
    assert.deepEqual(h.stored, [], 'staging must not change committed startup preferences');
    if (outcome === 'cancel') c.requestStudioConfirmation = async () => false;
    if (outcome === 'refuse') c.sendMessage = () => false;
    assert.equal(await c.startNewSideQuestionThread(), outcome === 'accept');
    if (outcome === 'accept') {
      assert.deepEqual(h.stored, [['tools', JSON.stringify(['a'.repeat(24), 'b'.repeat(24)])], ['gather', 'repo'], ['thinking', 'high']]);
    } else { assert.deepEqual(h.stored, []); assert.equal(c.sideQuestionPreferredThinking, 'max'); assert.equal(c.sideQuestionState.threadId, 'thread-A'); }
  }
});
test('setup preferences retain their existing immediate persistence before any thread', async () => {
  const h = harness(), c = h.c; c.sideQuestionState = null;
  const control = (field, value) => new Control(field, value, { next: false });
  await c.handleSideQuestionChange({ target: control('thinking', 'high') }); await c.handleSideQuestionChange({ target: control('gatherScope', 'repo') });
  assert.deepEqual(h.stored, [['thinking', 'high'], ['gather', 'repo']]); assert.equal(c.sideQuestionPreferredThinking, 'high');
});
test('catalog filters future selections in memory without persisting them before New', async () => {
  const h = harness(); h.c.getSideQuestionNextSettings().toolIds = ['b'.repeat(24)];
  h.c.applySideQuestionToolCatalog([{ id: 'b'.repeat(24), name: 'gateway', gateway: true }]);
  assert.deepEqual(plain(h.c.sideQuestionUi.toolIds), []); assert.deepEqual(plain(h.c.sideQuestionNextSettings.toolIds), ['b'.repeat(24)]);
  assert.deepEqual(h.stored.at(-1), ['tools', JSON.stringify([])]);
  assert.equal(await h.c.startNewSideQuestionThread(), true); assert.deepEqual(h.stored.at(-3), ['tools', JSON.stringify(['b'.repeat(24)])]);
});
test('focused custom-path blur during actual Side rendering cannot re-enter innerHTML replacement', async () => {
  const h = harness(), c = h.c; const next = c.getSideQuestionNextSettings(); next.gatherScope = 'custom';
  const blurred = new Control('customPath', '/NEXT/typed'); let depth = 0, maximumDepth = 0, writes = 0; const pending = [];
  Object.assign(c, { finishPreviewRender() {}, sideQuestionPreviewRenderNonce: 0, renderSideQuestionMarkdownFields: async () => {} });
  c.window.requestAnimationFrame = fn => fn();
  c.critiqueViewEl = { scrollTop: 0, scrollHeight: 100, clientHeight: 100, querySelector: () => null };
  Object.defineProperty(c.critiqueViewEl, 'innerHTML', { set(_html) {
    depth++; maximumDepth = Math.max(maximumDepth, depth); writes++;
    // The outer setter removes the focused input, synchronously emitting its
    // committed change. A second setter here is the native NotFoundError race.
    if (depth === 1 && writes === 1) pending.push(c.handleSideQuestionChange({ target: blurred }));
    depth--;
  } });
  vm.runInContext(declaration('renderSideQuestionView'), c);
  await c.handleSideQuestionChange({ target: new Control('thinking', 'high') }); await Promise.all(pending);
  assert.equal(maximumDepth, 1); assert.equal(writes, 1); assert.equal(next.customPath, '/NEXT/typed'); assert.equal(next.thinking, 'high');
  assert.equal(c.sideQuestionState.context.contextRoot, '/FROZEN'); assert.equal(h.sent.length, 0);
});
test('New keeps the remembered thinking preference across a model clamp unless the future choice was explicitly edited', async () => {
  for (const edited of [false, true]) {
    const h = harness(), c = h.c; c.sideQuestionPreferredThinking = 'max'; c.sideQuestionUi.thinking = 'high';
    c.sideQuestionThinkingLevels = ['off', 'low', 'high'];
    const next = c.getSideQuestionNextSettings();
    assert.equal(next.preferredThinking, 'max'); assert.equal(next.thinking, 'high');
    if (edited) await c.handleSideQuestionChange({ target: new Control('thinking', 'high') });
    assert.equal(c.sideQuestionPreferredThinking, 'max', 'editing future settings must not alter the current preference before New');
    assert.equal(await c.startNewSideQuestionThread(), true);
    c.applySideQuestionThinkingLevels(['off', 'low', 'high', 'max']);
    assert.equal(c.sideQuestionPreferredThinking, edited ? 'high' : 'max');
    assert.equal(c.sideQuestionUi.thinking, edited ? 'high' : 'max');
    assert.deepEqual(h.sent, [{ type: 'side_question_clear_request', threadId: 'thread-A' }]);
  }
});
test('catalog/thinking updates filter staged configuration, never the frozen thread scope or tools', () => {
  const h = harness(), captured = plain(h.c.sideQuestionState); const next = h.c.getSideQuestionNextSettings(); next.toolIds = ['b'.repeat(24)]; next.thinking = next.preferredThinking = 'high';
  h.c.applySideQuestionToolCatalog([{ id: 'a'.repeat(24), name: 'read' }]); h.c.applySideQuestionThinkingLevels(['off', 'low']);
  assert.deepEqual(plain(next.toolIds), []); assert.equal(next.thinking, 'low'); assert.deepEqual(plain(h.c.sideQuestionState), captured);
  h.c.applySideQuestionThinkingLevels(['off', 'low', 'high']); assert.equal(next.thinking, 'high');
});
