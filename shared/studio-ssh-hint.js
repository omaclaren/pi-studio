export function isStudioSshSession(env = process.env) {
	return Boolean(
		String(env.SSH_CONNECTION ?? env.SSH_CLIENT ?? env.SSH_TTY ?? "").trim(),
	);
}

export function buildStudioForwardingHint(port, studioUrl, options = {}) {
	const normalizedPort = Number(port);
	const remotePort = Number.isInteger(normalizedPort) && normalizedPort > 0 ? normalizedPort : port;
	const url = String(studioUrl || "").trim();
	const prefix = String(options.prefix || "").trim();
	const lines = [];
	if (prefix) lines.push(prefix);
	lines.push(
		"To open Studio locally through SSH, run this on your local machine:",
		`  ssh -L ${remotePort}:127.0.0.1:${remotePort} <remote-host>`,
		"Then open this Studio URL in your local browser:",
		`  ${url}`,
	);
	return lines.join("\n");
}

export function buildStudioSshTunnelHint(port, studioUrl, env = process.env) {
	if (!isStudioSshSession(env)) return null;
	return buildStudioForwardingHint(port, studioUrl, {
		prefix: "SSH detected. Studio was not opened in the remote browser.",
	});
}
