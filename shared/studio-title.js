// Tab titles for Studio's pages, in ASCII. Muxy 2.3.0's built-in browser can crash on a tab
// title with some non-ASCII characters: "Reading file content… · pi Studio · …" did, at the
// ellipsis. Which characters can do it isn't known, so a title keeps only printable ASCII.
// Page content keeps its characters. client/studio-client.js has a copy of this function for
// the live title; test/studio-title.test.js checks that the two agree.

/** @param {unknown} value */
export function toStudioAsciiTitle(value) {
  return String(value ?? "")
    .replace(/…/g, "...")
    .replace(/[·•–—−]/g, "-")
    .replace(/●/g, "*")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/π/g, "pi")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[^\x20-\x7e]+/g, "?")
    .trim();
}
