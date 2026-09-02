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

Attribution-sensitive sends also take a separate cross-client send lease. A compatible client holds it from the pre-send pane capture through the completion/output capture. The lease has an owner token, heartbeat, bounded wait, and stale recovery. If a caller times out or aborts after submission, the live client continues heartbeating the lease until the runtime completion marker appears or that exact tmux session lifetime ends; a caller timeout does not imply that submitted code stopped. This prevents `pi-repl` and `pi-studio` from concurrently claiming each other's output; it cannot prevent a person typing directly into an attached tmux pane.

## Clean record versus raw history

The clean record includes submissions whose semantic boundaries are known to a compatible client, plus explicit literate notes. Code typed directly into tmux is retained only in the raw pane/history mirror unless future runtime-specific instrumentation can establish reliable boundaries. Clients must not present raw `pipe-pane` output as reliably parsed code/output.

Canonical Markdown exports identify origin, mode, status, runtime, and timestamp and include this direct-input limitation.

## Compatibility

A client that sees an unsupported version leaves it untouched. Existing tmux sessions gain v1 metadata lazily when inspected or used. Studio may import legacy browser-local entries as `pi-studio` entries using their stable IDs, making retries idempotent.
