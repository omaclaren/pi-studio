import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../client/studio-client.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
function section(a, b) { const start = source.indexOf(a), end = source.indexOf(b, start); assert(start >= 0 && end > start, 'missing ' + a); return source.slice(start, end); }
function harness(item = { id: 'r1', prompt: '  Original\n\tπ <code>  ', promptMode: 'run' }) {
  const writes = [], statuses = [];
  const c = vm.createContext({ item, uiBusy: false, getSelectedHistoryItem: () => c.item,
    writeTextToClipboard: async text => { writes.push(text); return true; }, setStatus: (...args) => statuses.push(args) });
  vm.runInContext(section('      function getHistoryPromptCopyTitle(', '      function getHistoryPromptButtonLabel('), c);
  return { c, writes, statuses };
}
test('recorded run prompt is copied byte-for-byte, without editor, Save, Run or grants', async () => {
  const h = harness(); assert.equal(await h.c.copySelectedHistoryPromptToClipboard(), true);
  assert.deepEqual(h.writes, ['  Original\n\tπ <code>  ']); assert.deepEqual(h.statuses.at(-1), ['Copied original run prompt.', 'success']);
  assert.doesNotMatch(section('      function getHistoryPromptCopyTitle(', '      function getHistoryPromptButtonLabel('), /sendMessage|sourceTextEl|checkpoint|grant|setRightView|setEditorView|documentHostingController/);
});
test('run, effective and unknown recorded provenance are named without guessing', async () => {
  for (const mode of ['run', 'effective', undefined]) {
    const h = harness({ prompt: 'stored', promptMode: mode, promptSteeringCount: 2 });
    const title = h.c.getHistoryPromptCopyTitle(h.c.item);
    assert.match(title, new RegExp(mode === 'run' ? 'original run prompt' : mode === 'effective' ? 'effective prompt' : 'stored prompt'));
    assert.match(title, /Does not load or run/); await h.c.copySelectedHistoryPromptToClipboard();
    assert.match(h.statuses.at(-1)[0], new RegExp(mode === 'run' ? 'original run' : mode === 'effective' ? 'effective' : 'response prompt'));
  }
});
test('missing, empty and non-string prompt are explicitly unavailable, never inferred from response or editor', async () => {
  for (const item of [null, { markdown: 'answer' }, { prompt: ' \n\t ' }, { prompt: 42 }]) {
    const h = harness(item); assert.equal(await h.c.copySelectedHistoryPromptToClipboard(), false); assert.equal(h.writes.length, 0);
    assert.match(h.c.getHistoryPromptCopyTitle(item), /No prompt was recorded|Select a response/);
    assert.deepEqual(h.statuses.at(-1), ['Prompt unavailable for the selected response.', 'warning']);
  }
});
test('clipboard refusal and exception are reported, never claimed as delivery', async () => {
  for (const result of [false, new Error('refused')]) {
    const h = harness(); h.c.writeTextToClipboard = async () => { if (result instanceof Error) throw result; return result; };
    assert.equal(await h.c.copySelectedHistoryPromptToClipboard(), false); assert.equal(h.statuses.at(-1)[1], 'warning');
    assert.doesNotMatch(h.statuses.at(-1)[0], /^Copied/);
  }
});
test('pending clipboard uses the captured response text and provenance, not later selection', async () => {
  const h = harness(); let finish; h.c.writeTextToClipboard = text => { h.writes.push(text); return new Promise(resolve => { finish = resolve; }); };
  const pending = h.c.copySelectedHistoryPromptToClipboard(); h.c.item.promptMode = 'effective'; h.c.item = { prompt: 'NEW', promptMode: 'effective' };
  finish(true); assert.equal(await pending, true); assert.deepEqual(h.writes, ['  Original\n\tπ <code>  ']); assert.match(h.statuses.at(-1)[0], /original run/);
});
test('busy matches disabled presentation, but read-only copy does not borrow writable-role authority', async () => {
  const h = harness(); h.c.uiBusy = true; assert.equal(await h.c.copySelectedHistoryPromptToClipboard(), false); assert.equal(h.writes.length, 0);
  const controls = section('      function updateHistoryControls(', '      function applySelectedHistoryItem(');
  assert.match(controls, /copyResponsePromptBtn\.disabled = uiBusy \|\| !hasPrompt/);
  assert.match(controls, /Copy response prompt \(unavailable\)/);
  assert.match(controls, /copyResponsePromptBtn\.title = getHistoryPromptCopyTitle\(selectedItem\)/);
  assert.match(index, /id="copyResponsePromptBtn"[^>]*disabled/);
  assert.match(source, /copyResponsePromptBtn\.addEventListener\("click",[\s\S]*?copySelectedHistoryPromptToClipboard\(\)/);
});
