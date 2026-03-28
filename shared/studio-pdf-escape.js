export function escapeStudioPdfLatexTextFragment(text) {
  let out = "";
  const source = String(text || "");

  for (const ch of source) {
    if (ch === "\\") {
      out += "\\textbackslash{}";
    } else if (ch === "{") {
      out += "\\{";
    } else if (ch === "}") {
      out += "\\}";
    } else if (ch === "%") {
      out += "\\%";
    } else if (ch === "#") {
      out += "\\#";
    } else if (ch === "$") {
      out += "\\$";
    } else if (ch === "&") {
      out += "\\&";
    } else if (ch === "_") {
      out += "\\_";
    } else if (ch === "~") {
      out += "\\textasciitilde{}";
    } else if (ch === "`") {
      out += "\\textasciigrave{}";
    } else if (ch === "^") {
      out += "\\textasciicircum{}";
    } else {
      out += ch;
    }
  }

  return out;
}
