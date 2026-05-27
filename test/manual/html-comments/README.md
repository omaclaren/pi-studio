# Studio HTML preview comment mode test

Use a raw HTML editor document for this test, not Markdown containing a fenced HTML block.

1. Open `test/manual/html-comments/html-comment-mode-test.html` in Studio.
2. Confirm the editor language is **HTML**.
3. Open **Editor (Preview)** or switch the left editor to preview.
4. In the HTML preview toolbar, click **Comment mode**.
5. Select text inside the preview, or click the table/card/gradient element. Comment mode should stay on after each comment until you click **Comment mode** again.
6. Confirm the **Comments** rail opens with a new comment anchored as `HTML selection` or `HTML <...>`.
7. Add comment text, then click **Jump** on the comment; the preview anchor should scroll/highlight.
8. Click **Page** in the HTML preview toolbar and confirm a page-level comment is added.
