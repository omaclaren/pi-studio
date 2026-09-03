export const STUDIO_LOOPBACK_BIND_HOST = "127.0.0.1";
export const STUDIO_ALL_INTERFACES_BIND_HOST = "0.0.0.0";
export const STUDIO_ADVERTISED_HOST = STUDIO_LOOPBACK_BIND_HOST;

/**
 * Resolve Studio's server-lifetime network binding. Listening on every IPv4
 * interface is deliberately opt-in; generated browser URLs remain loopback URLs
 * so same-port container publishing does not require URL editing.
 *
 * @param {boolean} [listenAll]
 * @returns {{ bindHost: string, advertisedHost: string, listenAll: boolean }}
 */
export function resolveStudioNetworkBinding(listenAll = false) {
	const enabled = listenAll === true;
	return {
		bindHost: enabled ? STUDIO_ALL_INTERFACES_BIND_HOST : STUDIO_LOOPBACK_BIND_HOST,
		advertisedHost: STUDIO_ADVERTISED_HOST,
		listenAll: enabled,
	};
}

/**
 * Parse only an HTTP origin-form request target. The inbound Host header is not
 * needed for Studio routing and must not become the base URL authority.
 *
 * @param {string | undefined} requestTarget
 * @returns {URL | null}
 */
export function parseStudioRequestTarget(requestTarget) {
	const value = typeof requestTarget === "string" ? requestTarget : "/";
	if (!value.startsWith("/") || value.startsWith("//")) return null;
	try {
		const expectedOrigin = `http://${STUDIO_ADVERTISED_HOST}`;
		const parsed = new URL(value, expectedOrigin);
		return parsed.origin === expectedOrigin ? parsed : null;
	} catch {
		return null;
	}
}

/**
 * Preserve the existing permissive Origin behavior for the localhost server.
 * In wildcard mode, an omitted Origin remains compatible with embedded and
 * non-browser clients; a supplied browser Origin must be HTTP(S) and match the
 * request's Host authority so a cross-origin page cannot drive the WebSocket.
 *
 * @param {string | undefined} originHeader
 * @param {string | undefined} requestHost
 * @param {boolean} [requireSameHost]
 * @returns {boolean}
 */
export function isStudioWebSocketOriginAllowed(originHeader, requestHost, requireSameHost = false) {
	if (!originHeader || !requireSameHost) return true;
	let originUrl;
	try {
		originUrl = new URL(originHeader);
	} catch {
		return false;
	}
	if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:") return false;
	if (
		originUrl.username
		|| originUrl.password
		|| originUrl.pathname !== "/"
		|| originUrl.search
		|| originUrl.hash
	) return false;
	if (typeof requestHost !== "string" || requestHost.length === 0) return false;

	try {
		const requestOrigin = new URL(`http://${requestHost}`);
		if (
			requestOrigin.username
			|| requestOrigin.password
			|| requestOrigin.pathname !== "/"
			|| requestOrigin.search
			|| requestOrigin.hash
		) return false;
		return originUrl.host.toLowerCase() === requestOrigin.host.toLowerCase();
	} catch {
		return false;
	}
}

/**
 * @param {number} port
 * @param {string} [studioUrl]
 * @returns {string}
 */
export function buildStudioListenAllWarning(port, studioUrl) {
	const normalizedPort = Number.isInteger(port) && port > 0 && port <= 65535
		? port
		: "<port>";
	const urlLine = typeof studioUrl === "string" && studioUrl.length > 0
		? `\nStudio URL: ${studioUrl}`
		: "";
	return "Security warning: pi Studio is listening on all IPv4 interfaces at "
		+ `${STUDIO_ALL_INTERFACES_BIND_HOST}:${normalizedPort}. `
		+ "Anyone who obtains the tokenized Studio URL can control Studio for this Pi process, including submitting prompts, reading or writing files through Studio, and expanding local-resource access. "
		+ "Treat the URL like a password. Expose this port only through a trusted local mapping or private network, and prefer SSH tunnelling on untrusted networks. "
		+ "Use /studio --stop before restarting without --listen-all to return to localhost-only mode."
		+ urlLine;
}
