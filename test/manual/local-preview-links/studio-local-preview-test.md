# Studio local preview/link test document

Use this file to test local preview resources, link actions, editor restore, and PDF/HTML handling.

Recommended launch:

```bash
/studio test/manual/local-preview-links/studio-local-preview-test.md
```

Or open Studio and set the working dir to this folder:

```text
test/manual/local-preview-links
```

## Local document links

Plain-click should open text/code/document links in a new editor-only Studio tab. Right-click should show Studio's local-link menu.

- [Linked Markdown note](docs/linked-note.md)
- [Linked LaTeX note](docs/linked-note.tex)
- [Sample CSV data](docs/sample-data.csv) — should open as plain text in the editor, with no conversion prompt; Preview mode/editor-only preview should render a scrollable table; PDF/HTML export should export the table, not a raw code block.
- [Sample TSV data](docs/sample-data.tsv) — should open as plain text in the editor, with no conversion prompt; Preview mode/editor-only preview should render a scrollable table; PDF/HTML export should export the table, not a raw code block.
- [Sample DOCX document](docs/sample-word.docx) — plain-click or **New tab** from Files should first ask for conversion confirmation, then convert it to editable Markdown when Pandoc is available.
- [Local HTML report](html/local-report.html)
- [Sample PDF with page fragment](pdfs/sample-report.pdf#page=1) — right-click should also offer opening it in a new Studio tab.
- [Local image file link](images/sample-plot.png) — plain-click should open the zoomable image focus viewer; right-click should also offer opening it in a new Studio tab.

## Embedded local image

This Markdown image should render in preview. Click it to open the zoomable image focus viewer, then check **Fit**, **100%**, **+**, **−**, **Reset**, fullscreen, Escape-to-close, Option/Alt+= / Option/Alt+- / Option/Alt+0, and modified-wheel/pinch zoom.

![Generated local PNG](images/sample-plot.png)

## Embedded Studio PDF block

This block should render the local PDF inline in the preview:

```studio-pdf
path: pdfs/sample-report.pdf
title: Sample local PDF block
page: 1
height: 420
```

## Link behaviour checks

- [Same-page link to target below](#same-page-target) should scroll in the preview, not open a new editor.
- [External link](https://example.com/) should keep normal browser behaviour.

## HTML preview check

Open [the local HTML report](html/local-report.html) in a new editor tab, switch that editor to preview, and confirm:

- the local image renders;
- local Markdown/LaTeX/PDF links work;
- right-click shows the Studio link menu;
- same-page HTML links still scroll.

## Refresh/clear editor check

1. Type a distinctive line in the editor.
2. Refresh the browser tab; the line should be restored.
3. Click **Reset editor**; the editor draft should reset while the response pane/history stay untouched.
4. Refresh again; the cleared editor should stay cleared.

## Same-page target

You reached the same-page target.
