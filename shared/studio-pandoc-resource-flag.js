export function createStudioPandocHtmlResourceFlagResolver(probeHelp) {
  if (typeof probeHelp !== "function") {
    throw new TypeError("A Pandoc capability probe function is required.");
  }

  const cache = new Map();

  async function getResourceFlag(pandocCommand) {
    const command = String(pandocCommand || "pandoc");
    let cached = cache.get(command);
    if (!cached) {
      cached = Promise.resolve()
        .then(() => probeHelp(command))
        .then((helpText) => String(helpText || "").includes("--embed-resources")
          ? "--embed-resources"
          : "--self-contained");
      cache.set(command, cached);
      void cached.catch(() => {
        if (cache.get(command) === cached) cache.delete(command);
      });
    }
    return cached;
  }

  return async function resolveStudioPandocHtmlResourceFlag(pandocCommand) {
    try {
      return await getResourceFlag(pandocCommand);
    } catch {
      // Old and current Pandoc versions accept --self-contained. The actual
      // render can now succeed or report the executable's useful error.
      return "--self-contained";
    }
  };
}
