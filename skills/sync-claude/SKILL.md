---
name: sync-claude
description: Sync the live ~/.claude global config (settings.json, CLAUDE.md, statusline.ts) into this git backup repo, then commit. Allowlist-based so credentials, history, and project transcripts are never copied. Use when the user says "sync my claude config", "back up .claude", "update the .claude repo", or runs "/sync-claude".
---

# Sync Claude config to git

Backs up the user's live global Claude Code config (`~/.claude`) into this repo.

## What it touches

Only these files are ever read or copied (the allowlist lives in `sync.ts`):

- `settings.json`
- `CLAUDE.md`
- `statusline.ts`

Everything else in `~/.claude` (`.credentials.json`, `history.jsonl`, `projects/`,
`sessions/`, `todos/`, `tasks/`, ...) is never read. That allowlist is the primary
defense against leaking secrets. A value-shaped secret scan on the copied content
is a second safety net: if a key or token ever appears inside an allowlisted file,
the copy is blocked and nothing is written.

Direction of flow: config goes live -> repo; this skill itself goes repo -> live
(authored here, copied to `~/.claude/skills/sync-claude/` to be runnable).

## Steps

1. From the repo root, show what would change (copies nothing):

   ```
   bun skills/sync-claude/sync.ts
   ```

2. Apply the copy:

   ```
   bun skills/sync-claude/sync.ts --apply
   ```

   If it exits non-zero, a possible secret was detected. Stop, show the user the
   flagged line, and do not commit.

3. Review and commit on `master` (this repo commits directly to master, no PR):

   ```
   git diff
   git add settings.json CLAUDE.md statusline.ts
   git commit -m "chore: sync live .claude config"
   ```

   Do not push unless the user asks.

## Notes

- Line endings are normalized to LF on copy, so CRLF/LF differences never show up
  as spurious changes.
- `statusline.ts` is the source. The live status line runs the compiled
  `statusline.exe`, which is large and not tracked.
- To add another file to the backup, add its name to `FILES` in `sync.ts` (and
  make sure it never contains secrets).
