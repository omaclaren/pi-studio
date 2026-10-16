# Windows browser launch check (issue #5)

The Windows opener now spawns `rundll32.exe` with `url.dll,FileProtocolHandler`
and the complete URL as separate arguments, with `shell: false`. macOS still
uses `open`, Linux uses `xdg-open`, and Muxy/cmux selection and fallback remain
the same. No shell quoting or whole-URL re-encoding is applied.

Studio already builds query strings with `URLSearchParams`. In dual editor
mode, `/studio` registers the workspace before constructing a URL with the
token first, then `studioTabState` and `hostedWorkspace`. Losing everything
after the first `&` keeps authentication valid but removes the workspace IDs;
the server correctly refuses that request with HTTP 409 and the reported
"editing URL is not registered" message. The fix preserves those IDs rather
than relaxing workspace registration or authentication.

## Automated coverage

```powershell
npm ci
node --test test/studio-browser-launcher.test.js test/studio-browser-launcher-integration.test.js test/studio-document-entrypoints.test.js test/studio-network-binding-integration.test.js
npm run typecheck
```

The subprocess tests run on any platform. They execute the production URL
builders and browser launcher, substitute a Node child for the Windows URL
handler, and check the actual HTTP request received by a loopback server.
They cover full dual-editor workspaces, standalone Document windows, and
single-editor URLs with encoded file paths, labels, and a synthetic token
containing special characters. The production Pi RPC/HTTP test separately
checks that an intact `/studio` URL returns 200, truncation after the token
reproduces the reported 409, and the workspace remains available afterwards.

These tests detect returning to a command-shell launcher and URL damage at
the subprocess boundary. On non-Windows systems they do **not** execute
`rundll32`, Windows protocol associations, or the default browser.

## Opt-in native Windows check

Run in an interactive Windows 11 desktop with a configured default browser.
This opens **two test tabs** on an ephemeral loopback port; it does not change
browser settings or protocol registrations. Close the tabs afterwards.

```powershell
$env:PI_STUDIO_TEST_NATIVE_BROWSER = '1'
try {
    node --test test/studio-browser-launcher-integration.test.js
} finally {
    Remove-Item Env:PI_STUDIO_TEST_NATIVE_BROWSER
}
```

The native test uses the real `rundll32.exe` and waits up to 30 seconds per tab
for the browser's request, checking every query field, authentication token,
workspace identity, and full/Document mode. A successful spawn alone is not
treated as a successful round trip. A timeout can also mean Windows policies
block `rundll32`, the default HTTP association is missing, or the desktop is
not interactive. There is no `cmd` fallback that would reintroduce truncation.

## Reporter environment smoke check

With this branch installed in the same managed Pi installation, from
PowerShell 7.6 on Windows 11:

1. Run `/studio`. Confirm the browser opens the Prompt/Document workspace
   without the registration error. Check that the URL still includes `token`,
   `studioTabState`, and `hostedWorkspace` (do not post the live token).
2. Type some unsent Prompt text, close the tab, and run `/studio` again.
   Confirm the retained text is present and any recovery prompt behaves normally.
3. Open a file using Studio's Document controls, then use **New editor tab**,
   **Move**, or **Copy**. Confirm the Document window opens in its correct mode.
4. Switch to single editor mode and try opening a path with spaces, `&`, `%`,
   or non-ASCII characters. Confirm the intended file and label arrive intact.
5. If opening fails, run `/studio --no-browser` and paste the **entire** printed
   URL into the browser. Report whether manual opening works, plus the Pi and
   default-browser versions. Keep tokens and file contents private.

The previous launcher defect explains the observed URL loss and reproduces
the dual-editor error without a Pi-installation change. Whether Pi's managed
installation changed how this surfaced still needs confirmation on that setup.

## Windows API references

- [Microsoft: `cmd` special characters and quoting](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/cmd)
- [Microsoft: launching URLs through `url.dll,FileProtocolHandler`](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/march/making-static-links-keyboard-capable-launching-urls-from-an-app)
- [Node: `spawn`, shell selection and Windows argument handling](https://nodejs.org/api/child_process.html#child_processspawncommand-args-options)

Microsoft documents this `rundll32` technique but notes that `url.dll` does not
return a URL-opening error code. Studio can detect process launch failures;
the native round-trip check is needed to establish actual browser delivery.
