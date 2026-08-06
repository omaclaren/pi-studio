import test from "node:test";
import assert from "node:assert/strict";

import {
	appendStudioQuartoLog,
	buildStudioQuartoPreviewArgs,
	isStudioQuartoDocumentPath,
	normalizeStudioQuartoLoopbackUrl,
	parseStudioQuartoInspect,
	parseStudioQuartoPreviewUrl,
	stripStudioQuartoAnsi,
} from "../shared/studio-quarto-preview.js";

test("Quarto preview eligibility accepts supported file-backed Markdown paths", () => {
	assert.equal(isStudioQuartoDocumentPath("/tmp/chapter.qmd"), true);
	assert.equal(isStudioQuartoDocumentPath("C:\\course\\CHAPTER.QMD"), true);
	assert.equal(isStudioQuartoDocumentPath("/tmp/lecture.md"), true);
	assert.equal(isStudioQuartoDocumentPath("/tmp/notes.markdown"), true);
	assert.equal(isStudioQuartoDocumentPath("/tmp/component.mdx"), false);
	assert.equal(isStudioQuartoDocumentPath("/tmp/chapter.txt"), false);
	assert.equal(isStudioQuartoDocumentPath(""), false);
	assert.equal(isStudioQuartoDocumentPath(null), false);
});

test("Quarto preview args bind to loopback and disable execution", () => {
	assert.deepEqual(buildStudioQuartoPreviewArgs("/tmp/chapter.qmd"), [
		"preview",
		"/tmp/chapter.qmd",
		"--no-browser",
		"--host",
		"127.0.0.1",
		"--port",
		"0",
		"--no-execute",
	]);
	assert.deepEqual(buildStudioQuartoPreviewArgs("/tmp/lecture.md"), [
		"preview",
		"/tmp/lecture.md",
		"--no-browser",
		"--host",
		"127.0.0.1",
		"--port",
		"0",
		"--no-execute",
	]);
	assert.throws(() => buildStudioQuartoPreviewArgs("/tmp/component.mdx"), /\.markdown/);
});

test("Quarto preview URL parsing strips ANSI and permits only loopback", () => {
	const output = "\u001b[32mBrowse at \u001b[4m\u001b[32mhttp://localhost:4381/chapter.html\u001b[39m\u001b[24m\n";
	assert.equal(stripStudioQuartoAnsi(output).includes("\u001b"), false);
	assert.equal(parseStudioQuartoPreviewUrl(output), "http://127.0.0.1:4381/chapter.html");
	assert.equal(normalizeStudioQuartoLoopbackUrl("http://127.0.0.1:9000/"), "http://127.0.0.1:9000/");
	assert.equal(normalizeStudioQuartoLoopbackUrl("https://example.com/preview"), null);
	assert.equal(parseStudioQuartoPreviewUrl("Browse at https://example.com/preview"), null);
});

test("Quarto inspect parser identifies project metadata and current output", () => {
	const sourcePath = "/work/course-book/intro.qmd";
	const inspect = JSON.stringify({
		quarto: { version: "1.4.549" },
		formats: { html: { pandoc: { "output-file": "intro.html" } } },
		project: {
			dir: "/work/course-book",
			config: {
				project: { type: "book" },
				book: { title: "Engineering ML" },
			},
		},
	});
	assert.deepEqual(parseStudioQuartoInspect(inspect, sourcePath), {
		sourcePath,
		version: "1.4.549",
		projectRoot: "/work/course-book",
		projectType: "book",
		projectLabel: "Engineering ML",
		outputFile: "intro.html",
		isProject: true,
	});
});

test("Quarto inspect parser supports standalone Markdown documents", () => {
	const sourcePath = "/work/notes.md";
	const inspect = JSON.stringify({
		quarto: { version: "1.5.0" },
		formats: { html: { pandoc: { "output-file": "notes.html" } } },
	});
	assert.deepEqual(parseStudioQuartoInspect(inspect, sourcePath), {
		sourcePath,
		version: "1.5.0",
		projectRoot: "/work",
		projectType: "document",
		projectLabel: "notes.md",
		outputFile: "notes.html",
		isProject: false,
	});
	assert.throws(() => parseStudioQuartoInspect("not json", sourcePath), /valid JSON/);
});

test("Quarto logs are cleaned and bounded", () => {
	const log = appendStudioQuartoLog("first\n", `\u001b[31m${"x".repeat(3000)}\u001b[0m`, 1000);
	assert.match(log, /^\[earlier Quarto output omitted\]/);
	assert.equal(log.includes("\u001b"), false);
	assert.ok(log.length < 1100);
});
