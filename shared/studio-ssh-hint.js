export function isStudioSshSession(env = process.env) {
	return Boolean(
		String(env.SSH_CONNECTION ?? env.SSH_CLIENT ?? env.SSH_TTY ?? "").trim(),
	);
}

export function buildStudioSshTunnelHint(port, studioUrl, env = process.env) {
	if (!isStudioSshSession(env)) return null;
	const normalizedPort = Number(port);
	const remotePort = Number.isInteger(normalizedPort) && normalizedPort > 0 ? normalizedPort : port;
	const url = String(studioUrl || "").trim();
	return [
		"SSH detected. Studio was not opened in the remote browser.",
		"To open it locally, run this on your local machine:",
		`  ssh -L ${remotePort}:127.0.0.1:${remotePort} <remote-host>`,
		"Then open this Studio URL in your local browser:",
		`  ${url}`,
	].join("\n");
}
