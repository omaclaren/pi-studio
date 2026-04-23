const STUDIO_LITERAL_MARKDOWN_LATEX_COMMANDS = new Set([
  "documentclass",
  "usepackage",
  "newtheorem",
  "begin",
  "end",
  "section",
  "subsection",
  "subsubsection",
  "chapter",
  "part",
  "paragraph",
  "subparagraph",
  "title",
  "author",
  "date",
  "maketitle",
  "tableofcontents",
  "includegraphics",
  "caption",
  "label",
  "ref",
  "eqref",
  "autoref",
  "pageref",
  "cite",
  "citet",
  "citep",
  "citealt",
  "citeauthor",
  "nocite",
  "textbf",
  "textit",
  "texttt",
  "emph",
  "underline",
  "footnote",
  "centering",
  "newcommand",
  "renewcommand",
  "providecommand",
  "bibliography",
  "bibliographystyle",
  "printbibliography",
  "addbibresource",
  "bibitem",
  "item",
  "input",
  "include",
  "latex",
  "tex",
]);

const STUDIO_STANDALONE_MARKDOWN_LATEX_DEFINITION_COMMANDS = new Set([
  "newcommand",
  "renewcommand",
  "providecommand",
  "declaremathoperator",
  "def",
  "gdef",
  "edef",
  "xdef",
  "let",
]);

function isEscapedAt(text, index) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && text[i] === "\\"; i -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

function findClosingUnescapedDelimiter(text, startIndex, delimiter) {
  let searchIndex = Math.max(0, startIndex);
  while (searchIndex <= text.length) {
    const matchIndex = text.indexOf(delimiter, searchIndex);
    if (matchIndex < 0) return -1;
    if (!isEscapedAt(text, matchIndex)) return matchIndex;
    searchIndex = matchIndex + delimiter.length;
  }
  return -1;
}

function isStandaloneLatexDefinitionLine(line) {
  const commandMatch = String(line || "").match(/^[ \t]{0,3}\\([A-Za-z@]+)\*?(?=\s|\\|\{|\[|$)/);
  if (!commandMatch) return false;

  const commandName = String(commandMatch[1] || "").toLowerCase();
  return STUDIO_STANDALONE_MARKDOWN_LATEX_DEFINITION_COMMANDS.has(commandName);
}

function readStandaloneLatexDefinitionLine(text, startIndex) {
  if (startIndex > 0 && text[startIndex - 1] !== "\n") return null;

  const lineEndIndex = text.indexOf("\n", startIndex);
  const sliceEnd = lineEndIndex >= 0 ? lineEndIndex : text.length;
  const line = text.slice(startIndex, sliceEnd);
  if (!isStandaloneLatexDefinitionLine(line)) return null;

  return {
    text: lineEndIndex >= 0 ? text.slice(startIndex, lineEndIndex + 1) : line,
    nextIndex: lineEndIndex >= 0 ? lineEndIndex + 1 : text.length,
  };
}

function preserveLiteralLatexCommandsInMarkdownSegment(markdown) {
  const source = String(markdown || "");
  let out = "";
  let index = 0;

  while (index < source.length) {
    const standaloneDefinitionLine = readStandaloneLatexDefinitionLine(source, index);
    if (standaloneDefinitionLine) {
      out += standaloneDefinitionLine.text;
      index = standaloneDefinitionLine.nextIndex;
      continue;
    }
    if (source[index] === "`") {
      let tickCount = 1;
      while (source[index + tickCount] === "`") tickCount += 1;
      const fence = "`".repeat(tickCount);
      const closeIndex = source.indexOf(fence, index + tickCount);
      if (closeIndex >= 0) {
        out += source.slice(index, closeIndex + tickCount);
        index = closeIndex + tickCount;
        continue;
      }
    }

    if (source.startsWith("$$", index) && !isEscapedAt(source, index)) {
      const closeIndex = findClosingUnescapedDelimiter(source, index + 2, "$$");
      if (closeIndex >= 0) {
        out += source.slice(index, closeIndex + 2);
        index = closeIndex + 2;
        continue;
      }
    }

    if (source[index] === "$" && !isEscapedAt(source, index)) {
      const closeIndex = findClosingUnescapedDelimiter(source, index + 1, "$");
      if (closeIndex >= 0) {
        out += source.slice(index, closeIndex + 1);
        index = closeIndex + 1;
        continue;
      }
    }

    if (source.startsWith("\\(", index)) {
      const closeIndex = source.indexOf("\\)", index + 2);
      if (closeIndex >= 0) {
        out += source.slice(index, closeIndex + 2);
        index = closeIndex + 2;
        continue;
      }
    }

    if (source.startsWith("\\[", index)) {
      const closeIndex = source.indexOf("\\]", index + 2);
      if (closeIndex >= 0) {
        out += source.slice(index, closeIndex + 2);
        index = closeIndex + 2;
        continue;
      }
    }

    if (source[index] === "\\" && source[index + 1] === "\\") {
      out += "\\\\";
      index += 2;
      continue;
    }

    if (source[index] === "\\" && /[A-Za-z@]/.test(source[index + 1] || "")) {
      let endIndex = index + 1;
      while (/[A-Za-z@]/.test(source[endIndex] || "")) endIndex += 1;
      if (source[endIndex] === "*") endIndex += 1;
      const commandName = source.slice(index + 1, endIndex).replace(/\*$/, "").toLowerCase();
      if (STUDIO_LITERAL_MARKDOWN_LATEX_COMMANDS.has(commandName)) {
        out += "\\" + source.slice(index, endIndex);
        index = endIndex;
        continue;
      }
    }

    out += source[index];
    index += 1;
  }

  return out;
}

export function preserveLiteralLatexCommandsInMarkdown(markdown) {
  const lines = String(markdown || "").split("\n");
  const out = [];
  let plainBuffer = [];
  let inFence = false;
  let fenceChar;
  let fenceLength = 0;

  const flushPlain = () => {
    if (plainBuffer.length === 0) return;
    out.push(preserveLiteralLatexCommandsInMarkdownSegment(plainBuffer.join("\n")));
    plainBuffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      const markerChar = marker[0];
      const markerLength = marker.length;

      if (!inFence) {
        flushPlain();
        inFence = true;
        fenceChar = markerChar;
        fenceLength = markerLength;
        out.push(line);
        continue;
      }

      if (fenceChar === markerChar && markerLength >= fenceLength) {
        inFence = false;
        fenceChar = undefined;
        fenceLength = 0;
      }

      out.push(line);
      continue;
    }

    if (inFence) {
      out.push(line);
    } else {
      plainBuffer.push(line);
    }
  }

  flushPlain();
  return out.join("\n");
}

export function extractStandaloneLatexDefinitionsFromMarkdown(markdown) {
  const lines = String(markdown || "").split("\n");
  const bodyLines = [];
  const definitions = [];
  let inFence = false;
  let fenceChar;
  let fenceLength = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})/);

    if (fenceMatch) {
      const marker = fenceMatch[1];
      const markerChar = marker[0];
      const markerLength = marker.length;

      if (!inFence) {
        inFence = true;
        fenceChar = markerChar;
        fenceLength = markerLength;
      } else if (fenceChar === markerChar && markerLength >= fenceLength) {
        inFence = false;
        fenceChar = undefined;
        fenceLength = 0;
      }

      bodyLines.push(line);
      continue;
    }

    if (!inFence && isStandaloneLatexDefinitionLine(line)) {
      definitions.push(line);
      continue;
    }

    bodyLines.push(line);
  }

  return {
    body: bodyLines.join("\n"),
    definitions,
    preamble: definitions.join("\n"),
  };
}
