// Browser-only, plain-text recovery UI. Stored text is never rendered as HTML.
export function createStudioBufferRecoveryPanel(options) {
	const { document } = options;
	const element = (tag, text, parent) => { const el = document.createElement(tag); if (text) el.textContent = text; parent?.appendChild(el); return el; };
	const dialog = element("dialog"); dialog.className = "studio-buffer-recovery-dialog";
	dialog.dataset.bufferRecovery = "true"; dialog.setAttribute("aria-labelledby", "bufferRecoveryTitle");
	element("h2", "Recover unsaved text", dialog).id = "bufferRecoveryTitle";
	element("p", "Find an earlier copy if unsaved edits are missing. Looking here won’t change your editor.", dialog);
	element("p", "These copies are temporary. Save files normally; recovery is not a backup.", dialog);
	const message = element("p", "", dialog); message.setAttribute("role", "status"); message.dataset.recoveryMessage = "true";
	const choicesLabel = element("label", "Stored copy ", dialog);
	const choices = element("select", "", choicesLabel); choices.dataset.recoveryCopies = "true";
	const detail = element("p", "", dialog);
	const bufferLabel = element("label", "Text to preview/export ", dialog);
	const buffers = element("select", "", bufferLabel); buffers.dataset.recoveryBuffers = "true";
	const preview = element("textarea", "", dialog); preview.readOnly = true; preview.setAttribute("aria-label", "Recovery text preview"); preview.spellcheck = false;
	const previewNote = element("p", "Preview limited to 20,000 characters; downloads include the full text.", dialog);
	previewNote.className = "studio-buffer-recovery-note";
	const actions = element("div", "", dialog); actions.className = "studio-buffer-recovery-actions";
	let decisions = null, records = [], generation = 0, busy = false, removed = false, resolveConfirmation = null;
	const confirmation = element("section", "", dialog); confirmation.hidden = true; confirmation.dataset.recoveryConfirmation = "true";
	const confirmationTitle = element("h3", "", confirmation);
	const confirmationText = element("p", "", confirmation);
	const cancelConfirm = element("button", "Cancel — keep current text", confirmation); cancelConfirm.type = "button"; cancelConfirm.dataset.recoveryConfirm = "cancel";
	const acceptConfirm = element("button", "Continue", confirmation); acceptConfirm.type = "button"; acceptConfirm.dataset.recoveryConfirm = "accept";
	function finishConfirmation(value) { confirmation.hidden = true; const resolve = resolveConfirmation; resolveConfirmation = null; resolve?.(value); }
	cancelConfirm.addEventListener("click", () => finishConfirmation(false)); acceptConfirm.addEventListener("click", () => finishConfirmation(true));
	function confirm(text) { confirmationText.textContent = text; confirmation.hidden = false; cancelConfirm.focus(); return new Promise(resolve => { resolveConfirmation = resolve; }); }
	const buttons = [];
	function button(label, action, id) {
		const btn = element("button", label, actions); btn.type = "button"; btn.dataset.recoveryAction = id; buttons.push(btn);
		btn.addEventListener("click", async () => {
			if (busy) return;
			const operation = generation;
			try { await action(); } catch (error) { if (dialog.open && operation === generation) message.textContent = error.message || "Recovery action failed. Current text was kept."; }
		}); return btn;
	}
	const selected = () => records[Number(choices.value)] || null;
	const selectedText = () => selected()?.state?.buffers[Number(buffers.value)]?.text ?? null;
	function controls() {
		for (const btn of buttons) btn.disabled = busy;
		use.disabled = busy || !selected()?.canUse;
		copy.disabled = downloadText.disabled = busy || selectedText() === null;
		retry.disabled = busy || !options.canRetry();
		choices.disabled = buffers.disabled = busy;
	}
	function showText() { preview.value = (selectedText() ?? selected()?.raw ?? "").slice(0, 20000); controls(); }
	function showChoice() {
		const record = selected(); buffers.replaceChildren();
		for (const [i, b] of (record?.state?.buffers || []).entries()) {
			const option = element("option", (b.sourceState.path || b.sourceState.label || b.role) + " — " + b.text.length + " characters", buffers);
			option.value = String(i); option.selected = b.id === record.state.selectedBufferId;
		}
		bufferLabel.hidden = !record?.state;
		const date = record?.state ? new Date(record.state.savedAt) : null;
		const recorded = record?.state?.savedAt > 0 && Number.isFinite(date?.getTime()) ? "Recorded: " + date.toLocaleString() : "Time not recorded";
		detail.textContent = record ? record.message + (record.state ? " · " + recorded : " · Raw data; download the archive to keep it.") : "No stored copies were found.";
		showText();
	}
	async function recheck() {
		busy = true; controls(); message.textContent = "Reading recovery copies…";
		const operation = generation, owner = decisions;
		const result = await owner.inspect();
		if (!dialog.open || operation !== generation) return;
		busy = false;
		if (!result.ok) { message.textContent = result.message; controls(); return; }
		records = result.records; choices.replaceChildren();
		for (const [i, record] of records.entries()) { const option = element("option", record.label, choices); option.value = String(i); }
		message.textContent = result.errors.join(" ") || "Your editor is unchanged.";
		showChoice();
	}
	async function choose(current) {
		if (!options.canChange()) { message.textContent = "Studio is busy. You can still copy or download text."; return; }
		const consent = options.captureConsent(), operation = generation, record = selected();
		busy = true; controls();
		confirmationTitle.textContent = current ? "Keep current text?" : "Use this copy?";
		const previewOnly = record?.state?.buffers[Number(buffers.value)]?.id !== record?.state?.selectedBufferId;
		const selectionNote = previewOnly ? "This restores the stored editor, not the text chosen for preview/export. " : "";
		const confirmed = await confirm(current
			? "Restart recovery with your current editor text? Older copies are kept. No file is saved and nothing is submitted."
			: "Replace your editor with this stored copy? " + selectionNote + "Copy or download current edits first. Older copies are kept; no file is saved and nothing is submitted.");
		const isCurrent = () => dialog.open && operation === generation && options.consentIsCurrent(consent) && options.canChange();
		if (!confirmed || !isCurrent()) {
			if (dialog.open && operation === generation) { busy = false; message.textContent = confirmed ? "Editor or connection changed. Kept current text; try again." : "Kept the current editor and recovery copies."; controls(); }
			return;
		}
		const result = current ? options.keepCurrent(decisions, isCurrent) : await decisions.use(record, isCurrent);
		if (!dialog.open || operation !== generation) return;
		busy = false;
		if (!result.ok || !isCurrent()) { message.textContent = result.message || "Editor changed. Navigation cancelled; copies were retained."; controls(); return; }
		options.navigate(result, consent);
	}
	button("Recheck copies", recheck, "inspect");
	const retry = button("Retry recovery", async () => {
		if (!options.canChange()) { message.textContent = "Studio is busy. Wait before retrying recovery."; return; }
		const operation = generation, consent = options.captureConsent(); busy = true; controls();
		const result = await options.retry(() => dialog.open && operation === generation && options.consentIsCurrent(consent));
		if (!dialog.open || operation !== generation) return;
		busy = false; message.textContent = result.ok ? "Current text has a temporary recovery copy on the server. Your file has not been saved." : result.message; controls();
	}, "retry");
	button("Download recovery archive", () => options.download(decisions.archive(options.currentText()), "studio-recovery-archive.json", "application/json"), "archive");
	button("Download current text", () => options.download(options.currentText(), "studio-current-editor.txt", "text/plain"), "current-text");
	const copy = button("Copy selected text", async () => { const operation = generation; const ok = await options.copy(selectedText()); if (dialog.open && operation === generation) message.textContent = ok ? "Selected text copied." : "Clipboard unavailable. Download the text instead."; }, "copy-text");
	const downloadText = button("Download selected text", () => options.download(selectedText(), "studio-recovered-text.txt", "text/plain"), "selected-text");
	const use = button("Use selected copy…", () => choose(false), "use");
	button("Keep current text…", () => choose(true), "keep-current");
	const close = element("button", "Close — keep editing", dialog); close.type = "button"; close.dataset.recoveryAction = "close";
	close.addEventListener("click", () => dialog.close());
	const about = element("details", "", dialog); about.className = "studio-buffer-recovery-note";
	element("summary", "About these copies", about);
	element("p", "Copies live in browser storage and the running Studio process; they may disappear when either closes. Recorded times come from the stored data, not an independent check of which copy is newest.", about);
	element("p", "Downloads may contain private text and file paths. Rechecking replaces this list; download an archive first if you want to keep it.", about);
	element("p", "Copies from another source or an unsupported format can be exported, but not restored here. Using a copy restarts recovery separately and leaves the originals untouched.", about);
	choices.addEventListener("change", showChoice); buffers.addEventListener("change", showText);
	dialog.addEventListener("keydown", event => event.stopPropagation());
	dialog.addEventListener("close", () => {
		// Native close events are queued. A close/reopen in one task must not dispose
		// the new inspection or resolve its confirmation using the old event.
		if (dialog.open) return;
		generation++; finishConfirmation(false); decisions?.dispose(); decisions = null; records = []; busy = false; options.onClose?.();
	});
	document.body.appendChild(dialog);
	return Object.freeze({
		async open() {
			if (removed || dialog.open) return;
			generation++; finishConfirmation(false); decisions?.dispose(); decisions = options.createDecisions(); records = []; choices.replaceChildren(); buffers.replaceChildren(); preview.value = "";
			dialog.showModal(); await recheck();
		},
		isOpen: () => dialog.open,
		dispose() { removed = true; generation++; decisions?.dispose(); if (dialog.open) dialog.close(); dialog.remove(); },
	});
}
