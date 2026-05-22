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
- [Local HTML report](html/local-report.html)
- [Sample PDF with page fragment](pdfs/sample-report.pdf#page=1)
- [Local image file link](images/sample-plot.png)

## Embedded local image

This Markdown image should render in preview:

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
3. Click **Clear editor**; the editor draft should clear while the response pane/history stay untouched.
4. Refresh again; the cleared editor should stay cleared.

## Same-page target

You reached the same-page target.
