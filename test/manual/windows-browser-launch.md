# Windows: opening Studio, files and folders (#5)

On Windows, Studio opens its URL with `rundll32.exe url.dll,FileProtocolHandler <url>`, passing the URL as one argument with no shell. `cmd /c start` cut the URL at its first `&`, so the browser lost the workspace IDs and Studio refused the page as "not registered in dual editor mode".

Studio opens PDFs, exports and folders with `explorer.exe "<path>"`, the path resolved and quoted. `cmd /c start` broke on `&`, `%NAME%` and `^!`, and `url.dll` loses non-ASCII names (checked on Windows 11, 19 Oct 2026).

## Native check

This opens one tab in the default browser on a loopback port, and changes no settings. Close the tab afterwards.

```powershell
$env:PI_STUDIO_TEST_NATIVE_BROWSER = '1'
try { node --test test/studio-browser-launcher-native-windows.test.js } finally { Remove-Item Env:PI_STUDIO_TEST_NATIVE_BROWSER }
```

`url.dll` reports no errors of its own, so a successful launch doesn't show the URL arrived; only the browser's request does. A timeout can mean a policy blocks `rundll32`, no default browser is set, or the desktop isn't interactive.

## In Pi

1. Run `/studio`. The Prompt and Document workspace opens, with no registration error.
2. Close the tab and run `/studio` again. Unsent Prompt text is still there.
3. Open a Document window (New editor tab, Move or Copy). It opens in the right mode.
4. In single editor mode, open a file whose path has spaces, `&`, `%` or non-ASCII characters. The right file and name arrive.
5. From a folder named like `a&b`, `%PATH%`, `a,b` or `Māori`, open a PDF in the system viewer, export a PDF or HTML file with Open, and use Files → Show in folder. Each file opens in its default app, and the folder in Explorer at that folder, not Documents.

If the browser doesn't open, `/studio --no-browser` prints the URL to paste in yourself. Keep the token private.
