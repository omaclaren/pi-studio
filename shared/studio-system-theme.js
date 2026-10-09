// Pi's "system" theme takes its colours from the terminal. When the terminal
// reports none, Pi falls back to ANSI palette numbers that only the terminal
// can draw, so Studio cannot know the real colours (trial48 finding 2).
export function systemThemeLacksTrueColor(theme) {
  if (!theme || theme.name !== "system") return false;
  const read = fn => { try { return String(fn() ?? ""); } catch { return ""; } };
  const sample = read(() => theme.getFgAnsi("text")) + read(() => theme.getBgAnsi("userMessageBg"));
  return !/\x1b\[(?:38|48);2;/.test(sample);
}
