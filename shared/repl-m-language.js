// MATLAB and Octave share the base-workspace protocol, not a process/session.
import { boundedCursorColumnCommand } from "./repl-cursor-column.js";

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

/**
 * What runs once a submission's code has finished: the footer, then the done
 * file. In Off the footer still ends a line that output left open, and adds
 * nothing else. Ctrl-C during Octave's footer interrupts this cleanup action
 * and skips whatever follows, so for Octave the done file is written by
 * unwind_protect. MATLAB finishes the action, and has no unwind_protect.
 */
export function buildMLanguageFinish(runtime, doneFile, display) {
	const footer = [
		...(runtime === "octave" ? ["fflush(1);"] : []),
		"try",
		`  [pi_repl_status,pi_repl_column]=system(${mStringLiteral(boundedCursorColumnCommand(process.execPath))});`,
		"catch",
		"  pi_repl_status=-1; pi_repl_column='';",
		"end",
		"if pi_repl_status~=0 || ~strcmp(strtrim(pi_repl_column),'0'); fprintf(1,'\\n'); end",
		...display.suffixLines.map((line) => `fprintf(1,'%s\\n',${mStringLiteral(line)});`),
	];
	const done = `fclose(fopen(${mStringLiteral(doneFile)},'w'));`;
	return (runtime === "octave"
		? ["unwind_protect", ...footer, "unwind_protect_cleanup", done, "end_unwind_protect"]
		: [...footer, done]).join("\n");
}

export function buildMLanguageDriverSource(runtime, sourceFile, doneFile, display) {
	const finish = buildMLanguageFinish(runtime, doneFile, display);
	// Parameters give eval its own slots in MATLAB's static anonymous-function
	// workspace. No helper variables/ans, cwd or path changes enter the base
	// workspace. onCleanup runs on normal completion, return and interruption;
	// even base-workspace clear all cannot remove this function-local guard.
	const cleanup = `onCleanup(@() feval(@(pi_repl_status,pi_repl_column) eval(${mStringLiteral(finish)}),-1,''))`;
	return `feval(@(pi_repl_error,pi_repl_guard) eval(fileread(${mStringLiteral(sourceFile)})),[],${cleanup});\n`;
}
