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

Compatible clients may add protocol-independent submission displays to the raw pane while retaining the same clean record. Display version 1 derives a non-secret 12-hex-character anchor as the first 12 characters of SHA-256 over `pi-repl-submission-display-v1`, a NUL byte, and the stable clean-record entry ID. The entry ID itself is not written to the pane.

**Off** is the default and writes no optional display or alignment anchors. Opt-in **Summary** shows a short submission in full, truncating after 6 source lines or 600 source characters. **Full** raises those bounds to 40 lines or 4,000 characters and warns that source becomes part of persistent raw terminal history. Display text normalizes newlines and tabs, removes trailing display whitespace, and escapes terminal, line-separator, and bidirectional control characters.

```text
── pi-repl · a1b2c3d4e5f6 · 2 lines ──
│ x = 1
│ x + 1
── output ──
2
── done · a1b2c3d4e5f6 ──
```

The compact submitted and completion anchors remain in raw tmux history for human readability and deterministic future alignment. A plain unanchored `── output ──` divider separates the source preview from runtime output without repeating the ID or other metadata. Clients remove the exact request-specific header, source preview, divider, and footer from captured tool output and clean-record output. These markers are presentation metadata, not clean-record authority: missing, malformed, duplicated, or user-produced marker-like text must never cause inferred raw activity to be promoted silently into protocol-v1 entries.

## Runtime control files (outside protocol v1)

Runtime-specific source wrappers and completion files are client implementation details, not shared-record state or authority. Compatible clients use compact request-unique names under a current-user-owned mode-`0700` `/tmp/pi-rc-<user-key>` root on POSIX systems, with mode-`0600` source files created exclusively. This avoids both verbose per-session paths and fixed global filenames that can collide across clients, processes, tmux servers, or runtimes.

A client removes the source and completion files after output capture. If a send times out or is aborted after submission, the same watcher that retains any shared lease also retains those files until the wrapper signals completion or the exact session lifetime disappears. Orphans left by a process crash are pruned after 24 hours on a later send. These files remain protocol-independent: their names and presence never turn raw pane activity into a clean-record entry.

## Compatibility

A client that sees an unsupported version leaves it untouched. Existing tmux sessions gain v1 metadata lazily when inspected or used. Studio may import legacy browser-local entries as `pi-studio` entries using their stable IDs, making retries idempotent.
