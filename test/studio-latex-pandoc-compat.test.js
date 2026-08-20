import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  doesStudioLatexStyleOverrideDocumentStartup,
  prepareStudioLatexForPandoc,
} from "../shared/studio-latex-pandoc-compat.js";

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "pi-studio-latex-compat-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("local packages that override document startup are omitted for Pandoc", () => withTempDir((dir) => {
  const stylePath = join(dir, "legacy-exam.sty");
  writeFileSync(stylePath, String.raw`
% A legacy package wrapper.
\let\originaldocument\document
\renewcommand{\document}{\originaldocument\examfrontmatter}
`);
  const source = String.raw`\documentclass{article}
\usepackage[option]{amsmath,legacy-exam}
\input{questions.tex}
\begin{document}
Question body.
\end{document}
`;

  const prepared = prepareStudioLatexForPandoc(source, dir);
  assert.match(prepared.source, /\\usepackage\[option\]\{amsmath\}/);
  assert.doesNotMatch(prepared.source, /\{amsmath,legacy-exam\}/);
  assert.match(prepared.source, /\\input\{questions\.tex\}/, "includes must remain available to Pandoc");
  assert.deepEqual(prepared.omittedPackages, [{ name: "legacy-exam", path: stylePath }]);
}));

test("a declaration containing only an incompatible package becomes harmless", () => withTempDir((dir) => {
  writeFileSync(join(dir, "legacy.sty"), String.raw`\def\document{replacement}`);
  const prepared = prepareStudioLatexForPandoc(String.raw`\usepackage{legacy}
\begin{document}Body\end{document}`, dir);

  assert.match(prepared.source, /^\\relax\{\}/);
  assert.doesNotMatch(prepared.source, /\\usepackage\{legacy\}/);
  assert.equal(prepared.omittedPackages[0]?.name, "legacy");
}));

test("comments and modern begin-document hooks do not trigger compatibility mode", () => withTempDir((dir) => {
  writeFileSync(join(dir, "modern.sty"), String.raw`
% \renewcommand{\document}{commented out}
\AtBeginDocument{\maketitle}
`);
  const source = String.raw`\usepackage{modern}
\begin{document}Body\end{document}`;
  const prepared = prepareStudioLatexForPandoc(source, dir);

  assert.equal(prepared.source, source);
  assert.deepEqual(prepared.omittedPackages, []);
}));

test("commented and body-level package text is not treated as an active preamble import", () => withTempDir((dir) => {
  writeFileSync(join(dir, "legacy.sty"), String.raw`\renewcommand{\document}{replacement}`);
  const source = String.raw`% \usepackage{legacy}
\documentclass{article}
\begin{document}
Literal example: \usepackage{legacy}
\end{document}`;
  assert.deepEqual(prepareStudioLatexForPandoc(source, dir), {
    source,
    omittedPackages: [],
  });
}));

test("non-local packages are never removed", () => withTempDir((dir) => {
  const source = String.raw`\usepackage{graphicx}
\begin{document}Body\end{document}`;
  assert.deepEqual(prepareStudioLatexForPandoc(source, dir), {
    source,
    omittedPackages: [],
  });
}));

test("document startup override detection covers legacy definition forms", () => {
  assert.equal(doesStudioLatexStyleOverrideDocumentStartup(String.raw`\renewcommand{\document}{x}`), true);
  assert.equal(doesStudioLatexStyleOverrideDocumentStartup(String.raw`\def\document{x}`), true);
  assert.equal(doesStudioLatexStyleOverrideDocumentStartup(String.raw`\let\document\replacement`), true);
  assert.equal(doesStudioLatexStyleOverrideDocumentStartup(String.raw`\renewenvironment{document}{x}{y}`), true);
  assert.equal(doesStudioLatexStyleOverrideDocumentStartup(String.raw`\AtBeginDocument{x}`), false);
});

test("Studio applies compatibility mode to HTML preview and PDF export", () => {
  const source = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ prepareStudioLatexForPandoc \} from "\.\/shared\/studio-latex-pandoc-compat\.js";/);
  assert.equal((source.match(/prepareStudioLatexForPandoc\(markdown, pandocWorkingDir\)/g) || []).length, 3);
  assert.match(source, /studio-latex-compatibility-warning/);
  assert.match(source, /warning: latexPandocCompatibilityWarning/);
  assert.match(source, /combineStudioWarnings\(latexPandocCompatibilityWarning, mermaidPrepared\.warning\)/);
  assert.match(source, /compile the source directly with LaTeX for authoritative output/);
});
