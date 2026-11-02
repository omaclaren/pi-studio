import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Candidate 115: the REPL pane's More menu stays inside the pane when the controls wrap and More
// starts a row (it hung off the pane's left edge). The page's own placement code runs here, with
// boxes worked out as the browser lays the menu out: right-aligned under More unless placed, and
// no narrower than the stylesheet's minimum (180px in the new layout) unless that's set lower.
const clientSource = readFileSync(new URL("../client/studio-client.js", import.meta.url), "utf8");
const slice = (from, to) => {
	const start = clientSource.indexOf(from);
	const end = clientSource.indexOf(to, start);
	assert.ok(start >= 0 && end > start, from);
	return clientSource.slice(start, end);
};

function layout({ pane, more, menuWidth }) {
	const context = { console };
	vm.runInNewContext([
		"class HTMLElement {} class HTMLDetailsElement extends HTMLElement {}",
		`const paneBox = ${JSON.stringify({ left: pane[0], right: pane[1] })}; const moreBox = ${JSON.stringify({ left: more[0], right: more[1] })}; const natural = ${menuWidth};`,
		"const pane = { getBoundingClientRect: () => paneBox };",
		"const menu = Object.assign(new HTMLElement(), { style: { left: '', right: '', minWidth: '', maxWidth: '' }, getBoundingClientRect() {",
		"  const min = this.style.minWidth ? parseFloat(this.style.minWidth) : 180;",
		"  const width = Math.max(min, this.style.maxWidth ? Math.min(natural, parseFloat(this.style.maxWidth)) : natural);",
		"  const left = this.style.left !== '' ? moreBox.left + parseFloat(this.style.left) : moreBox.right - width;",
		"  return { left, right: left + width, width }; } });",
		"const details = Object.assign(new HTMLDetailsElement(), { open: true, classList: { contains: (name) => name === 'repl-more-controls' },",
		"  querySelector: (selector) => selector === '.repl-more-menu' ? menu : null, closest: () => pane, getBoundingClientRect: () => moreBox });",
		slice("      function placeReplMoreMenu(details)", "      function handleReplPaneFocusIn"),
		"handleReplMoreToggle({ target: details });",
		"globalThis.box = menu.getBoundingClientRect(); globalThis.style = { ...menu.style };",
	].join("\n"), context);
	return { box: context.box, style: context.style };
}

test("More opens right-aligned where that fits, as before", () => {
	const { box, style } = layout({ pane: [725, 1431], more: [1339, 1395], menuWidth: 189 });
	assert.deepEqual([box.left, box.right], [1206, 1395]);
	assert.deepEqual([style.left, style.right, style.minWidth, style.maxWidth], ["", "", "", ""]);
});

test("More at the start of a wrapped row opens inside the pane, not off its left edge", () => {
	const { box } = layout({ pane: [9, 631], more: [21, 76], menuWidth: 189 });
	assert.deepEqual([box.left, box.right], [17, 206]);
});

test("in a pane narrower than the menu, the menu narrows to fit", () => {
	const { box } = layout({ pane: [9, 189], more: [21, 76], menuWidth: 240 });
	assert.ok(box.left >= 17 && box.right <= 181, JSON.stringify(box));
	assert.equal(box.width, 164);
});

test("the pane places the menu when More opens", () => {
	assert.match(clientSource, /critiqueViewEl\.addEventListener\("toggle", handleReplMoreToggle, true\);/);
});
