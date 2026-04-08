export function stripStudioMarkdownHtmlCommentsInSegment(markdown) {
  const source = String(markdown ?? "");
  let out = "";
  let index = 0;
  let codeSpanFenceLength = 0;
  let inHtmlComment = false;

  while (index < source.length) {
    if (inHtmlComment) {
      if (source.startsWith("-->", index)) {
        inHtmlComment = false;
        index += 3;
        continue;
      }
      const ch = source[index];
      if (ch === "\n" || ch === "\r") out += ch;
      index += 1;
      continue;
    }

    if (codeSpanFenceLength > 0) {
      const fence = "`".repeat(codeSpanFenceLength);
      if (source.startsWith(fence, index)) {
        out += fence;
        index += codeSpanFenceLength;
        codeSpanFenceLength = 0;
        continue;
      }
      const ch = source[index];
      out += ch;
      index += 1;
      if (ch === "\n" || ch === "\r") {
        codeSpanFenceLength = 0;
      }
      continue;
    }

    const backtickMatch = source.slice(index).match(/^`+/);
    if (backtickMatch) {
      const fence = backtickMatch[0];
      codeSpanFenceLength = fence.length;
      out += fence;
      index += fence.length;
      continue;
    }

    if (source.startsWith("<!--", index)) {
      inHtmlComment = true;
      index += 4;
      continue;
    }

    out += source[index];
    index += 1;
  }

  return out;
}

export function stripStudioMarkdownHtmlComments(markdown) {
  const lines = String(markdown ?? "").split("\n");
  const out = [];
  let plainBuffer = [];
  let inFence = false;
  let fenceChar;
  let fenceLength = 0;

  const flushPlain = () => {
    if (plainBuffer.length === 0) return;
    out.push(stripStudioMarkdownHtmlCommentsInSegment(plainBuffer.join("\n")));
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
