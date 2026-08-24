function parseStudioLocalPreviewPage(resourcePath) {
	const raw = String(resourcePath || "");
	const parts = [];
	const queryIndex = raw.indexOf("?");
	if (queryIndex >= 0) {
		const queryEnd = raw.indexOf("#", queryIndex);
		parts.push(raw.slice(queryIndex + 1, queryEnd >= 0 ? queryEnd : raw.length));
	}
	const hashIndex = raw.indexOf("#");
	if (hashIndex >= 0) parts.push(raw.slice(hashIndex + 1));
	for (const part of parts) {
		try {
			const params = new URLSearchParams(part);
			const rawPage = params.get("page") || params.get("p");
			if (rawPage) {
				const page = Number.parseInt(rawPage, 10);
				if (Number.isFinite(page) && page > 0) return page;
			}
		} catch {
			const match = part.match(/(?:^|[&;])page=(\d+)/i) || part.match(/^page=(\d+)$/i);
			if (match && match[1]) {
				const page = Number.parseInt(match[1], 10);
				if (Number.isFinite(page) && page > 0) return page;
			}
		}
	}
	return null;
}

function parseStudioPdfLaunchTarget(pathInput) {
	const raw = String(pathInput || "").trim();
	if (!raw || /\0/.test(raw) || /^\/\//.test(raw)) return null;
	if (/^[a-z][a-z0-9+.-]*:/i.test(raw) && !/^[a-z]:[\\/]/i.test(raw)) return null;

	const match = raw.match(/^(.*?\.pdf)(?:(?:\?[^#]*)?(?:#.*)?)?$/i);
	if (!match || !match[1]) return null;
	return {
		path: match[1],
		page: parseStudioLocalPreviewPage(raw),
	};
}

export {
	parseStudioLocalPreviewPage,
	parseStudioPdfLaunchTarget,
};
