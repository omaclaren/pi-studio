// MATLAB and Octave share the base-workspace protocol, not a process/session.
const shellQuote = (value) => `'${value.replace(/'/g, `'"'"'`)}'`;

export function mStringLiteral(value) {
	// Single-quoted ASCII is compact in the loader. Encode everything else as
	// UTF-8 bytes: MATLAB chars are UTF-16, Octave chars are bytes, and their
	// backslash rules differ. Neither runtime can interpolate the submitted text.
	if (/^[\x20-\x7e]*$/.test(value) && !value.includes("\\")) return `'${value.replace(/'/g, "''")}'`;
	return `native2unicode(uint8([${[...Buffer.from(value, "utf8")].join(" ")}]),'UTF-8')`;
}

export function buildMLanguageControlSource(code, display) {
	return [
		...(display.enabled ? display.prefixLines.map((line) => `fprintf(1,'%s\\n',${mStringLiteral(line)});`) : []),
		"try",
		`  evalin('base',${mStringLiteral(code)});`,
		"catch pi_repl_error",
		"  fprintf(2,'Error: %s\\n',pi_repl_error.message);",
		"end",
		"",
	].join("\n");
}

export function buildMLanguageDriverSource(runtime, sourceFile, doneFile, display) {
	const query = [
		'try { process.stdout.write(require("node:child_process").execFileSync("tmux", ["-N", "display-message", "-p", "-t", process.env.TMUX_PANE, "#{cursor_x}"], { encoding: "utf8", timeout: 500, killSignal: "SIGKILL", maxBuffer: 128, stdio: ["ignore", "pipe", "ignore"] }).trim()); } catch { process.exitCode = 1; }',
	].join(" ");
	const finish = [
		...(display.enabled ? [
			...(runtime === "octave" ? ["fflush(1);"] : []),
			"try",
			`  [pi_repl_status,pi_repl_column]=system(${mStringLiteral(`${shellQuote(process.execPath)} -e ${shellQuote(query)} 2>/dev/null`)});`,
			"catch",
			"  pi_repl_status=-1; pi_repl_column='';",
			"end",
			"if pi_repl_status~=0 || ~strcmp(strtrim(pi_repl_column),'0'); fprintf(1,'\\n'); end",
			...display.suffixLines.map((line) => `fprintf(1,'%s\\n',${mStringLiteral(line)});`),
		] : []),
		`fclose(fopen(${mStringLiteral(doneFile)},'w'));`,
	].join("\n");
	// Parameters give eval its own slots in MATLAB's static anonymous-function
	// workspace. No helper variables/ans, cwd or path changes enter the base
	// workspace. onCleanup runs on normal completion, return and interruption;
	// even base-workspace clear all cannot remove this function-local guard.
	const cleanup = `onCleanup(@() feval(@(pi_repl_status,pi_repl_column) eval(${mStringLiteral(finish)}),-1,''))`;
	return `feval(@(pi_repl_error,pi_repl_guard) eval(fileread(${mStringLiteral(sourceFile)})),[],${cleanup});\n`;
}
