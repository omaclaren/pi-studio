import { parser, GFM } from "@lezer/markdown";
import { classHighlighter, highlightTree, tagHighlighter, tags } from "@lezer/highlight";

const markdownParser = parser.configure(GFM);
const markdownHighlighter = [classHighlighter, tagHighlighter([
  { tag: tags.monospace, class: "tok-monospace" },
  { tag: tags.strikethrough, class: "tok-strikethrough" },
])];

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function highlightMarkdown(source, { annotationsEnabled, normalizeLanguage, collectAnnotations, prism }) {
  const tree = markdownParser.parse(source);
  const spans = [];
  const codeBlocks = [];
  highlightTree(tree, markdownHighlighter, (start, end, classes) => spans.push({ start, end, classes, priority: 0 }));

  function codeTokens(tokens, position, mapping, classes = ["token", "code"]) {
    for (const token of Array.isArray(tokens) ? tokens : [tokens]) {
      if (typeof token === "string") {
        const end = position + token.length;
        while (mapping.index < mapping.parts.length) {
          const part = mapping.parts[mapping.index];
          const start = Math.max(position, part.offset);
          const stop = Math.min(end, part.offset + part.length);
          if (stop > start) spans.push({ start: part.from + start - part.offset, end: part.from + stop - part.offset,
            classes: [...new Set(classes)].join(" "), priority: 1 });
          if (part.offset + part.length > end) break;
          mapping.index += 1;
        }
        position = end;
      } else {
        const aliases = typeof token.alias === "string" ? [token.alias] : token.alias || [];
        position = codeTokens(token.content, position, mapping, [...classes, token.type, ...aliases]);
      }
    }
    return position;
  }

  tree.iterate({ enter(node) {
    if (node.name === "InlineCode") {
      codeBlocks.push({ start: node.from, end: node.to, inline: true });
      return false;
    }
    if (node.name !== "FencedCode" && node.name !== "CodeBlock") return;
    codeBlocks.push({ start: node.from, end: node.to });
    const contents = node.node.getChildren("CodeText");
    const info = node.node.getChild("CodeInfo");
    const name = info ? source.slice(info.from, info.to).trim().split(/\s+/)[0].replace(/^\./, "").toLowerCase() : "";
    const language = normalizeLanguage(name) || name;
    let offset = 0;
    const parts = contents.map((content) => {
      const part = { from: content.from, length: content.to - content.from, offset };
      offset += part.length;
      return part;
    });
    const text = contents.map((content) => source.slice(content.from, content.to)).join("");
    codeTokens(prism.languages[language] ? prism.tokenize(text, prism.languages[language]) : text, 0, { parts, index: 0 });
  } });

  // PI/OpenAI: Mask block code, but retain inline code for the annotation scanner's escape rules.
  let annotationSource = "";
  let codeEnd = 0;
  for (const block of codeBlocks) {
    if (block.inline) continue;
    annotationSource += source.slice(codeEnd, block.start) + source.slice(block.start, block.end).replace(/[^\n]/g, " ");
    codeEnd = block.end;
  }
  annotationSource += source.slice(codeEnd);
  let lineStart = 0;
  let codeIndex = 0;
  for (const line of annotationSource.split("\n")) {
    for (const marker of collectAnnotations(line)) {
      const start = lineStart + marker.start;
      while (codeIndex < codeBlocks.length && codeBlocks[codeIndex].end <= start) codeIndex += 1;
      if (codeIndex < codeBlocks.length && codeBlocks[codeIndex].start <= start) continue;
      spans.push({ start, end: lineStart + marker.end,
        classes: annotationsEnabled === false ? "hl-annotation-muted" : "hl-annotation", priority: 2 });
    }
    lineStart += line.length + 1;
  }

  const events = spans.flatMap((span) => [{ at: span.start, span, open: true }, { at: span.end, span, open: false }]);
  events.sort((a, b) => a.at - b.at);
  const active = new Set();
  let position = 0;
  let html = "";
  let pendingClasses = "";
  let pendingText = "";
  function flush() {
    const text = escapeHtml(pendingText);
    html += pendingClasses ? '<span class="' + pendingClasses + '">' + text + "</span>" : text;
    pendingText = "";
  }
  for (const event of [...events, { at: source.length }]) {
    if (event.at > position) {
      let style;
      for (const span of active) if (!style || span.priority > style.priority) style = span;
      const classes = style ? style.classes : "";
      if (classes !== pendingClasses) { flush(); pendingClasses = classes; }
      pendingText += source.slice(position, event.at);
      position = event.at;
    }
    if (event.span) {
      if (event.open) active.add(event.span);
      else active.delete(event.span);
    }
  }
  flush();
  return html;
}
