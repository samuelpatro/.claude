---
name: herd-worktree
description: Serve the current git worktree as a Laravel Herd site (http://<project>-<worktree>.test), rewrite the worktree's .env to match, and install dependencies. Built for the Claude Code agents view, which already creates a worktree per background agent. Use when the user says "serve this worktree", "herd link this agent", "make this worktree reachable", or runs "/herd-worktree". Does NOT create or remove worktrees.
---

# Herd a worktree

The agents view already isolates each background agent in its own git worktree
under `.claude/worktrees/<name>`. This skill adds the Laravel-runnable layer the
harness does not: a Herd `.test` host, a `.env` rewritten for that host, and
installed dependencies. Run it **from inside the worktree you want to serve.**

## What it does (on `--apply`)

1. Derives a site name `<project>-<worktree>` and host `http://<site>.test`.
2. Copies `.env` from the main checkout if the worktree doesn't already have one
   (worktrees created after first run get `.env` automatically, see below).
3. Rewrites `APP_URL`, `SESSION_DOMAIN`, appends to `SANCTUM_STATEFUL_DOMAINS`
   (only if that key exists), and sets `SESSION_SECURE_COOKIE=false`.
4. Adds `.env` to the main checkout's `.worktreeinclude` so future worktrees get
   it copied in automatically (the cheap, always-on half of the setup).
5. `herd link <site>` — HTTP only (no `herd secure`, to match Vite).
6. `composer install` (if `composer.json`) and `bun install` (if `package.json`).
7. `php artisan config:clear` + `cache:clear` (if `artisan`).

It does **not** start Vite. Start the frontend yourself with `bun run dev` when
you need it.

## Steps

1. From inside the worktree, preview (changes nothing):

   ```
   bun ~/.claude/skills/herd-worktree/herd.ts
   ```

2. Apply:

   ```
   bun ~/.claude/skills/herd-worktree/herd.ts --apply
   ```

   Then open the printed `http://<site>.test`.

3. Tear down when finished with the worktree (before removing it):

   ```
   bun ~/.claude/skills/herd-worktree/herd.ts --down
   ```

## Notes

- Guard: refuses to run outside `.claude/worktrees/` unless you pass `--force`.
  This prevents it from ever touching your main checkout's `.env` or Herd site.
- Idempotent: re-running `--apply` is safe (no duplicate Sanctum domains, etc.).
- This is the on-demand half of a hybrid setup. The always-on half is the
  `.env` -> `.worktreeinclude` copy, which needs no skill once seeded.
- Source of truth lives in the `.claude` backup repo at
  `skills/herd-worktree/`; it is copied to `~/.claude/skills/herd-worktree/` to be
  runnable. Re-run the sync after editing.
