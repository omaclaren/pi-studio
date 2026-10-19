# Shared REPL session record protocol v1

This protocol lets independent `pi-repl` and `pi-studio` installations exchange a clean code/output record while using the same tmux REPL session. Neither package imports or requires the other. If the protocol is unavailable or invalid, each package keeps its existing standalone behavior and the raw tmux pane/history remains usable.

## Discovery and identity

Compatible clients inspect two tmux session options:

- `@pi_repl_record_id`: 32 lowercase hexadecimal characters
- `@pi_repl_record_version`: `1`

A client creating metadata uses tmux `set-option -o`, so concurrent first writers cannot replace an ID already chosen by another client. The option contains an opaque ID, never a filesystem path.

The record is bound to:

- the tmux session name
- `#{session_id}`
- `#{session_created}`

A client refuses a record whose stored identity does not match the live tmux session. Runtime metadata continues to use `@pi_repl_runtime`.

## Storage and permissions

The opaque ID maps to:

```text
<os temporary directory>/pi-repl-session-records-<uid>/<record-id>.json
```

The root is a real, current-user-owned mode-`0700` directory. Record files are single-link regular, current-user-owned mode-`0600` files. Symlinked roots, records, lock paths, and hard-linked records are refused. Writes use a same-directory exclusive temporary file, file fsync, atomic rename, and best-effort directory fsync.

The record is a bounded JSON snapshot:

```json
{
  "protocol": "pi-repl-session-record",
  "version": 1,
  "recordId": "…",
  "session": {
    "sessionName": "pi-repl-python",
    "tmuxSessionId": "$1",
    "tmuxSessionCreatedAt": 1700000000,
    "runtime": "ipython"
  },
  "revision": 4,
  "createdAt": 1700000000000,
  "updatedAt": 1700000005000,
  "clearedAt": null,
  "droppedEntries": 0,
  "entries": []
}
```

Each entry has a stable `id`, optional `requestId`, timestamps, session/runtime identity, `origin` (`pi-repl` or `pi-studio`), a presentation `label`, `mode` (`raw`, `literate`, or `agent`), prose, code, cleaned output, status, and skipped/truncation metadata.

## Concurrency and bounds

Record updates take a short cross-process directory lock, read the latest snapshot, upsert by stable entry ID, and replace the snapshot atomically. A stale lock can be recovered. The implementation retains at most 300 entries, bounds individual prose/code/output fields, and caps the serialized record at 16 MiB by dropping the oldest entries first.

Attribution-sensitive sends also take a separate cross-client send lease. A compatible client holds it from the pre-send pane capture through the completion/output capture. The lease has an owner token, heartbeat, bounded wait, and stale recovery. If a caller times out or aborts after submission, the live client continues heartbeating the lease until the runtime completion signal appears or that exact tmux session lifetime ends; a caller timeout does not imply that submitted code stopped. This prevents `pi-repl` and `pi-studio` from concurrently claiming each other's output; it cannot prevent a person typing directly into an attached tmux pane.

## Clean record versus raw history

The clean record includes submissions whose semantic boundaries are known to a compatible client, plus explicit literate notes. Code typed directly into tmux is retained only in the raw pane/history mirror unless future runtime-specific instrumentation can establish reliable boundaries. Clients must not present raw `pipe-pane` output as reliably parsed code/output.

Canonical Markdown exports identify origin, mode, status, runtime, and timestamp and include this direct-input limitation.

## Optional raw-history display and alignment anchors

Compatible clients may add protocol-independent submission displays to the raw pane while retaining the same clean record. Display version 1 derives a non-secret 12-hex-character anchor as the first 12 characters of SHA-256 over `pi-repl-submission-display-v1`, a NUL byte, and the stable clean-record entry ID. The entry ID itself is not written to the pane. The short hash is labelled `id:` in both the input and completion markers; it is a correlation aid, not an execution signal. The hash derivation and record protocol remain unchanged.

Echo defaults and preview limits are client preferences, not protocol requirements. `pi-repl` defaults to **Summary**, which shows a short submission in full, truncating after 20 source lines or 2,000 source characters. **Off** writes no optional display or alignment anchors. Explicit opt-in **Full** raises the bounds to 40 lines or 4,000 characters. Both Summary and Full persist their source preview in raw terminal history; Off does not remove code from the clean record. Other clients, including older installations, may use different echo defaults or preview limits without affecting interoperability. Display text normalizes newlines and tabs, removes trailing display whitespace, and escapes terminal, line-separator, and bidirectional control characters.

```text
<runtime loader command>

── pi-repl · input · 2 lines · id: a1b2c3d4e5f6 ──
x = 1
x + 1
── output ──
2
── done · id: a1b2c3d4e5f6 ──

<runtime prompt>
```

The compact submitted and completion anchors remain in raw tmux history for human readability and deterministic future alignment. A plain unanchored `── output ──` divider separates the source preview from runtime output without repeating the ID or other metadata. `pi-repl` inserts one display-only blank line before the begin anchor and after the completion anchor in Summary and Full modes, with no internal padding. The trailing gap is removed from clean output along with the exact final anchor; additional user whitespace is preserved. Native prompt spacing is not changed. Input previews are plain code without an added vertical bar. Cleanup matches the known preview before its output divider, including retained line wraps, so marker-looking lines inside source are not mistaken for real boundaries. Existing histories with different spacing, bar-prefixed source, unlabelled compact IDs or earlier three-marker displays remain readable. Clients remove the exact request-specific header, source preview, divider, and footer from captured tool output and clean-record output. These markers are presentation metadata, not clean-record authority: missing, malformed, duplicated, or user-produced marker-like text must never cause inferred raw activity to be promoted silently into protocol-v1 entries.

## Runtime control files (outside protocol v1)

Runtime-specific source wrappers and completion files are client implementation details, not shared-record state or authority. Compatible clients use compact request-unique names under a current-user-owned mode-`0700` `/tmp/pi-rc-<user-key>` root on POSIX systems, with mode-`0600` source files created exclusively. This avoids both verbose per-session paths and fixed global filenames that can collide across clients, processes, tmux servers, or runtimes.

`pi-repl` prefixes submission control filenames with the display anchor: `<12-hex-anchor>-<16-hex-random-token>.<extension>`. Related source, guard and driver files share the anchor but retain independently allocated random tokens; each completion file uses its source file's full stem with `.done`. The prefix is present even in Off mode, without adding optional display markers. Transient paste-buffer files and callers that do not supply an anchor retain the older `<16-hex-random-token>.<extension>` form. Cleanup and stale-file pruning recognize both forms. The anchor derivation, record IDs and protocol version do not change; the prefix is only a human correlation aid, not a uniqueness guarantee or completion signal. Other clients need not adopt these names to remain compatible.

A client removes the source and completion files after output capture. If a send times out or is aborted after submission, the same watcher that retains any shared lease also retains those files until the wrapper signals completion or the exact session lifetime disappears. Orphans left by a process crash are pruned after 24 hours on a later send. These files remain protocol-independent: their names and presence never turn raw pane activity into a clean-record entry.

gnuplot's implementation additionally uses its guard's `.done` path as a private acknowledgment that the nested source returned. The pipe producer writes the source's actual completion file only after acknowledgment or native pipe closure on error/interruption. Neither a display marker, a comment written to the pipe, nor SIGINT alone establishes completion. This does not change the shared record or its lease protocol; source, guard and producer files are all retained until settlement.

New gnuplot sessions also have independent launch-ownership metadata: the inherited `PI_REPL_GNUPLOT_OWNER` environment marker and matching tmux `@pi_repl_gnuplot_owner` option (32 lowercase hexadecimal characters). These are allocated only for a newly created session, not derived from a record ID, copied to another session, or retrofitted into a running interpreter. They support explicit-stop attribution of detached helpers together with UID/birth identities and pane protections. They are not record identity, send-lease authority or completion signals, and do not change protocol version 1. Clients without that attribution must report detached-helper cleanup as unverified rather than infer ownership from a process name or PID.

C++ (`cpp`) likewise leaves record/display/lease version 1 unchanged. A private `.cpp` source, length-framed `.req` and ordinary C++ `.hxx` driver share the display anchor but have independent allocation tokens. The single terminal include loads an in-session Cling helper and a unique scalar initializer for this request; no completion command is queued into terminal stdin. The helper validates the private directory and request/source descriptor identities and publishes a `pi-repl-cpp-v1 <source-stem> <result>\n` reply only after native evaluation and helper-local destruction. Only a bounded, complete, single-link, owned mode-0600 reply in the original mode-0700 directory settles the send. Empty, malformed or mismatched replies remain pending. This is a native-return signal, not proof of successful library calls or rollback of earlier groups. Captured entries retain native diagnostics; tool details expose the evaluator result separately. The private controls are not a security sandbox against arbitrary code executing with the same user's privileges.

## Compatibility

A client that sees an unsupported version leaves it untouched. Existing tmux sessions gain v1 metadata lazily when inspected or used. Studio may import legacy browser-local entries as `pi-studio` entries using their stable IDs, making retries idempotent.
