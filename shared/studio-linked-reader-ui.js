import { createStudioLinkedReader } from "./studio-linked-reader.js";

// A reading surface, not an editor or a second owner of the underlying buffers.
// Application callbacks keep resource grants and guarded editing in one place.
export function createStudioLinkedReaderUi(options) {
	const { document, window, host, root, footer, select, header, metadata } = options;
	const history = createStudioLinkedReader();
	let disposed = false, owner = null, ownerPage = null, renderSequence = 0;
	const make = (tag, name, text) => {
		const element = document.createElement(tag); element.className = name;
		if (text) element.textContent = text;
		return element;
	};
	const toolbar = make("div", "studio-reader-toolbar");
	toolbar.hidden = true; toolbar.setAttribute("aria-label", "Linked file navigation");
	const surface = make("div", "studio-reader-surface"); surface.hidden = true;
	const content = make("div", "panel-scroll rendered-markdown studio-reader-content");
	content.id = "studioLinkedReaderContent"; content.setAttribute("tabindex", "0");
	surface.append(content); host.insertBefore(toolbar, metadata || root); host.append(surface);
	const button = (label, fn, group = toolbar) => {
		const element = make("button", "studio-reader-action", label); element.type = "button";
		element.addEventListener("click", () => { void fn(); }); group.append(element); return element;
	};
	const backButton = button("Back", back), forwardButton = button("Forward", forward);
	const snapshotLabel = make("span", "studio-reader-snapshot", ""); toolbar.append(snapshotLabel);
	const refreshButton = button("Refresh", refresh);
	refreshButton.title = "Read this file again.";
	const actions = make("div", "studio-reader-actions"); toolbar.append(actions);
	const editButton = button("Checking editor…", () => openForEdit(), actions);
	// Matches the Files row (Oliver, 10 Oct): a file open nowhere yet can go to either buffer.
	const promptButton = button("Open in Prompt", () => openForEdit("prompt"), actions);
	const returnButton = button("Return", () => close({ restore: true }), actions);
	const temporaryOption = make("option", "", "");
	temporaryOption.value = ""; temporaryOption.disabled = true; temporaryOption.dataset.linkedReaderOption = "1";
	const previousRootInert = Boolean(root.inert), previousFooterInert = Boolean(footer?.inert), previousMetadataInert = Boolean(metadata?.inert);
	const warn = error => options.report?.(error?.message || String(error || "Could not read this file."));
	const active = () => history.snapshot().active;
	const current = page => !disposed && history.isCurrent(page);
	const context = () => {
		const page = history.snapshot().current;
		return page ? { sourcePath: page.path, resourceDir: page.resourceDir, isCurrent: () => current(page) } : null;
	};
	function layout() {
		if (disposed || !active()) return;
		const pane = host.getBoundingClientRect(), heading = (header || root).getBoundingClientRect();
		toolbar.style.top = Math.max(0, (header ? heading.bottom : heading.top) - pane.top - (host.clientTop || 0)) + "px";
		const bar = toolbar.getBoundingClientRect();
		surface.style.top = Math.max(0, bar.bottom - pane.top - (host.clientTop || 0)) + "px";
	}
	function displayLabel(page, state) {
		const parts = path => String(path || "").replace(/\\/g, "/").split("/").filter(Boolean);
		const pathParts = parts(page.path), name = pathParts.at(-1) || page.label;
		const matches = state.entries.filter(entry => parts(entry.path).at(-1) === name);
		const originMatches = parts(state.origin?.path).at(-1) === name;
		if (matches.length < 2 && !originMatches) return name;
		const others = [...new Set([...matches.map(entry => entry.path), ...(originMatches ? [state.origin.path] : [])])].filter(path => path !== page.path);
		for (let count = 2; count <= pathParts.length; count++) {
			const label = pathParts.slice(-count).join("/");
			if (!others.some(path => parts(path).slice(-count).join("/") === label)) return label;
		}
		return page.path;
	}
	function sync() {
		if (disposed) return;
		const state = history.snapshot(), reading = state.active, page = state.current;
		host.dataset.linkedReaderActive = reading ? "1" : "0";
		toolbar.hidden = !state.entries.length;
		surface.hidden = !reading;
		root.inert = reading || previousRootInert;
		if (footer) footer.inert = reading || previousFooterInert;
		if (metadata) metadata.inert = reading || previousMetadataInert;
		if (reading) {
			root.setAttribute("aria-hidden", "true"); footer?.setAttribute("aria-hidden", "true"); metadata?.setAttribute("aria-hidden", "true");
			if (temporaryOption.parentElement !== select) select.append(temporaryOption);
			temporaryOption.textContent = displayLabel(page, state); select.value = "";
			select.title = page.path + " · Read-only snapshot.";
			const date = new Date(page.readAt);
			snapshotLabel.textContent = "Read-only · saved file as of " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
			snapshotLabel.title = "Saved file read at " + date.toLocaleString() + ". Refresh to read it again.";
		} else {
			root.removeAttribute("aria-hidden"); footer?.removeAttribute("aria-hidden"); metadata?.removeAttribute("aria-hidden"); temporaryOption.remove();
			toolbar.style.top = "";
		}
		const rootLabel = options.originLabel(state.origin) || "current view";
		const rootTitle = options.originTitle?.(state.origin) || rootLabel;
		backButton.textContent = "← " + (state.back ? displayLabel(state.back, state) : rootLabel);
		backButton.title = state.back?.path || rootTitle;
		backButton.hidden = !reading; backButton.disabled = !reading;
		forwardButton.textContent = (state.forward ? displayLabel(state.forward, state) : "Forward") + " →";
		forwardButton.title = state.forward?.path || "";
		forwardButton.hidden = !state.forward; forwardButton.disabled = !state.forward;
		refreshButton.hidden = !reading; refreshButton.disabled = !reading || Boolean(state.pending);
		editButton.hidden = !reading;
		editButton.textContent = ownerPage === page?.id && owner ? owner.label : "Checking editor…";
		editButton.disabled = !reading || Boolean(state.pending) || ownerPage !== page?.id || !owner || owner.disabled === true || options.editingBusy?.() === true;
		promptButton.hidden = !reading || ownerPage !== page?.id || owner?.kind !== "new" || options.canOpenInPrompt?.() !== true;
		promptButton.disabled = editButton.disabled;
		returnButton.textContent = reading ? "Return to " + rootLabel : "Close";
		returnButton.title = reading ? "Leave this reading history for " + rootTitle + "." : "Forget this reading history.";
		snapshotLabel.hidden = !reading; layout();
	}
	const changed = () => { sync(); options.changed?.(); };
	function rememberPosition() {
		if (active() && !content.inert) history.rememberPosition({ top: content.scrollTop, left: content.scrollLeft });
	}
	content.addEventListener("scroll", rememberPosition);
	function signature(value) {
		return value ? JSON.stringify([value.kind, value.label || "", value.workspaceId || "", value.bufferId || "", value.disabled === true]) : "";
	}
	async function checkOwner(page) {
		try {
			const result = await options.findOwner(page);
			if (!current(page)) return;
			owner = result; ownerPage = page.id; sync();
		} catch (error) {
			if (!current(page)) return;
			owner = { kind: "unavailable", label: "Editor unavailable", disabled: true }; ownerPage = page.id;
			sync(); warn(error);
		}
	}
	async function renderPage() {
		const page = history.snapshot().current;
		if (!page || disposed) return;
		const sequence = ++renderSequence;
		owner = null; ownerPage = null;
		content.inert = true; content.replaceChildren(); content.scrollTop = 0; content.scrollLeft = 0;
		const loading = make("div", "preview-loading", "Reading " + page.label + "…"); content.append(loading);
		changed();
		const stillCurrent = () => sequence === renderSequence && current(page);
		const ownerCheck = checkOwner(page);
		try {
			await options.render(content, page, stillCurrent);
			if (!stillCurrent()) return;
			content.inert = false;
			const saved = history.snapshot().current.position;
			content.scrollTop = saved.top; content.scrollLeft = saved.left;
			if (page.fragment && saved.top === 0) {
				let fragment = page.fragment; try { fragment = decodeURIComponent(fragment); } catch {}
				const heading = Array.from(content.querySelectorAll?.("[id]") || []).find(el => el.id === fragment);
				// Do not scroll the page/editor or move focus while reading.
				if (heading) content.scrollTop = Math.max(0, heading.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop);
			}
		} catch (error) { if (stillCurrent()) { content.inert = false; warn(error); } }
		await ownerCheck;
		if (stillCurrent()) sync();
	}
	async function read(href, suppliedContext, settings = {}) {
		if (disposed || !options.contextIsCurrent(suppliedContext)) return false;
		rememberPosition();
		const origin = options.captureOrigin(suppliedContext);
		const ticket = history.begin(origin, settings);
		if (!ticket) return false;
		const isCurrent = () => !disposed && history.snapshot().pending === ticket && options.contextIsCurrent(suppliedContext);
		const requestContext = { ...(suppliedContext || {}), isCurrent };
		changed();
		try {
			const payload = await options.read(href, requestContext);
			if (!isCurrent()) { history.cancel(ticket); return false; }
			const fragment = String(href || "").split("#").slice(1).join("#");
			const result = history.commit(ticket, { ...payload, fragment });
			if (!result.ok) { warn(result.message); return false; }
			await renderPage(); return true;
		} catch (error) {
			const owned = history.snapshot().pending === ticket;
			history.cancel(ticket);
			if (owned && !error?.studioCancelled && options.contextIsCurrent(suppliedContext) && !disposed) warn(error);
			return false;
		} finally { changed(); }
	}
	async function refresh() {
		const page = history.snapshot().current;
		if (!page) return false;
		// page.path is literal; read() takes a link, so keep "#", "?" and "%" in the name.
		return read(String(page.path).replace(/[%#?]/g, ch => encodeURIComponent(ch)), context(), { refresh: true });
	}
	async function back() {
		rememberPosition();
		const result = history.back();
		if (!result.ok) return false;
		if (result.left) { renderSequence++; changed(); await options.returnToOrigin(result.origin); sync(); }
		else await renderPage();
		return true;
	}
	async function forward() {
		rememberPosition();
		if (!history.forward().ok) return false;
		await renderPage(); return true;
	}
	async function close(settings = {}) {
		rememberPosition();
		const wasActive = active(), origin = history.close(); renderSequence++;
		owner = null; ownerPage = null; content.replaceChildren(); changed();
		if (wasActive) {
			if (settings.restore && origin) await options.returnToOrigin(origin);
			else if (settings.manual === true) options.manualLeave();
		}
		sync();
	}
	async function openForEdit(role = "document") {
		const page = history.snapshot().current, displayed = owner;
		if (!page || !displayed || displayed.disabled || history.snapshot().pending || options.editingBusy?.()) return false;
		try {
			const checked = await options.findOwner(page);
			if (!current(page)) return false;
			if (signature(checked) !== signature(displayed)) {
				owner = checked; ownerPage = page.id; sync();
				warn("The editing destination changed. Check the action and choose it again."); return false;
			}
			const opened = await options.openForEdit(page, checked, () => current(page), role);
			if (opened && current(page)) await close({ restore: false, manual: true });
			return Boolean(opened);
		} catch (error) { if (current(page)) warn(error); return false; }
	}
	const observer = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(layout) : null;
	observer?.observe(host); observer?.observe(toolbar); if (header) observer?.observe(header);
	window.addEventListener("resize", layout);
	function revealFragment(fragment) {
		if (!active() || content.inert) return false;
		let id = fragment; try { id = decodeURIComponent(id); } catch {}
		const target = Array.from(content.querySelectorAll?.("[id]") || []).find(el => el.id === id);
		if (!target) return false;
		content.scrollTop = Math.max(0, target.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop);
		rememberPosition(); return true;
	}
	function dispose() {
		if (disposed) return;
		void close({ restore: false }); disposed = true; observer?.disconnect();
		window.removeEventListener("resize", layout); toolbar.remove(); surface.remove(); temporaryOption.remove();
	}
	return Object.freeze({ read, refresh, back, forward, close, openForEdit, sync, context, revealFragment, dispose,
		snapshot: () => history.snapshot(), isCurrent: current, contentElement: content });
}
