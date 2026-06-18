
# Claude Code Setup

Personal Claude Code configuration with settings, statusline, and plugins.

## Links
- [Claude Code Documentation](https://docs.claude.com/claude-code)
- [Claude Log](https://claudelog.com/)

## Prerequisites

[Bun](https://bun.sh/) is required for the statusline source.

## Setup

Copy and paste this prompt into Claude Code to install globally (into `~/.claude/`):

```
Clone https://github.com/samuelpatro/.claude into ~/.claude/, merging settings.json, statusline.ts, statusline.build.ts, and CLAUDE.md into my existing global config. Preserve my existing settings and only update the files from the repo.

Then compile the status line for my OS and wire it up:
- Run: bun ~/.claude/statusline.build.ts
- macOS / Linux: this builds ~/.claude/statusline (no extension); settings.json already points there.
- Windows: it builds ~/.claude/statusline.exe, and ~ is not expanded, so set statusLine.command to the absolute path "%USERPROFILE%\\.claude\\statusline.exe".
```

The binary is host-specific, so build it on each machine. If you would rather skip the build, set `statusLine.command` to `bun ~/.claude/statusline.ts` to run the source directly on any OS.

## What's Inside

- **settings.json** Permissions (allow/deny/ask), enabled plugins, statusline command
- **statusline.ts** Custom status line with context, git info, model, effort, rate limits, session duration
- **statusline.build.ts** Compiles the status line to a native per-OS binary (run with bun)
- **CLAUDE.md** Global instructions for scope, communication, workflow, tooling, localization, testing, and docs
- **skills/** Personal agent skills (see [Skills](#skills) below)

## Status Line

The statusline is minimal and non distracting with muted colors and dot separators.

```
my-project ⎇ main +5 -2 ↑1 · 12k/200k 6% · Opus 4.7 (high) · 15m
5h: 34% ⟳ 2:30pm · 7d: 12% ⟳ apr 5, 9:00am
```

**Line 1:**
- **Project and branch** with additions/deletions and ahead/behind remote
- **Context usage** tokens used / max, color coded percentage, red ⚠ warning when over 256k (retrieval quality degrades)
- **Model and effort** combined in one segment. Effort label is tinted by tier (gray for default, blue for low, yellow for medium, orange for high, magenta for xhigh, bold red for max)
- **Session duration** derived from transcript file creation time

**Line 2 (conditional):**
- **Rate limits** 5 hour and weekly usage as percentages with reset times
- Hidden entirely when both are under 10%
- Colors shift from muted green to yellow to red at 80%+

### Performance

The script does a single combined `git status --porcelain=v2 --branch` call, caches results to a tmp file with a 5 second TTL, and reads stdin synchronously to keep startup latency low.

For the lowest latency it is compiled to a native binary. bun emits a host-native binary (Mach-O on macOS, ELF on Linux, PE on Windows), so the output has no `.exe` on Unix. Build it per machine with the helper script, which names the output correctly for the OS:

```bash
bun ~/.claude/statusline.build.ts
```

Or compile directly:

```bash
bun build --bytecode --compile ~/.claude/statusline.ts --outfile ~/.claude/statusline
```

On macOS / Linux this produces `~/.claude/statusline` (no extension). On Windows bun automatically appends `.exe`, so the same command produces `~/.claude/statusline.exe`.

Then point `settings.json` at it (use the absolute path with `.exe` on Windows, since `~` is not expanded there):

```json
"statusLine": {
  "type": "command",
  "command": "~/.claude/statusline"
}
```

### Benchmark: binary vs bun vs shell

Mean per-invocation latency over 60 warm-cache runs (macOS, arm64, M-series). A shell rewrite was tested on the hypothesis that avoiding a JS runtime would be faster. It was not.

| Implementation | Command | ms/run |
| --- | --- | ---: |
| Compiled binary | `~/.claude/statusline` | ~13.5 |
| bun on source | `bun ~/.claude/statusline.ts` | ~14.0 |
| Shell port | `statusline.sh` | ~22.0 |

Takeaways:

- **Shell is the slowest, by ~1.5x.** A faithful shell port forks roughly 15 short-lived processes per render (`jq` x3, `git` x4, `stat`, `date`, `shasum`, `cut`, `basename`, `awk`). On macOS each `fork`/`exec` costs around 1 ms, and that overhead dwarfs any saving from skipping a runtime. The TypeScript version does all parsing, hashing, and formatting in a single process.
- **The compiled binary beats `bun` on the source by only about 0.5 ms** for a script this small, within run-to-run noise. The `--bytecode --compile` step mainly pays off for large entrypoints; here it is a marginal win. If you would rather not maintain a build, `bun ~/.claude/statusline.ts` is effectively just as fast.
- Numbers are machine-specific and warm-cache (the git result is cached for 5 s). The ranking holds regardless; absolute values vary by hardware.

## CLAUDE.md

Global instructions organized into sections:

- **Scope** Verify UI components, form fields, and API endpoints by reading source; never read or print secrets
- **Communication** Use AskUserQuestion for option choices
- **Workflow** TaskCreate for 2+ step work, parallel subagents, explicit subagent model picks (Haiku for grunt, Opus for hard reasoning, Sonnet default)
- **Tooling** Bun over npm, skip frontend builds in dev, scripts/ folder for throwaway work
- **Localization** Code, DB columns, variables, API fields, and comments in English only. UI text may be localized
- **Testing** Tests required for new public functions, API endpoints, and non trivial logic
- **Docs** No em dashes or sentence joining hyphens as punctuation, docs go in `/docs/` folder

## Skills

Personal agent skills in `skills/`. Each is a `SKILL.md` that Claude loads on demand when the task matches its description.

- **prototype** Clone an existing design (a live website captured via the browser, or in repo components and design tokens) into a faithful standalone `.html`, then generate variations on top and recommend one. Never touches the real app.
- **real-prototype** Implement design variants directly on the real app route with a live frosted glass switcher (URL synced, gated out of production), judged against real data, then fold the winner into the real code.
- **to-issues** Break a plan, spec, or PRD into tracer bullet vertical slices and publish them as GitHub issues, attached as native sub issues under a parent tracking issue. Adapts to each repo's existing labels.
- **flow** Verify a change end to end in the current worktree: detect the change set (working changes, a PR, a ref, or a worktree), run the relevant tests, drive the browser, and report a verdict. Read only on git, never switches or creates worktrees.
- **herd-worktree** Serve the current git worktree as a Laravel Herd site and rewrite its `.env` to match.
- **sync-claude** Sync the live `~/.claude` config (settings.json, CLAUDE.md, statusline.ts) into this repo. Allowlist based, so credentials and transcripts are never copied.

## MCP Servers

```bash
# Figma integration
claude mcp add --transport http figma https://mcp.figma.com/mcp

# Sentry error tracking
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

## Plugins

- `frontend-design@claude-plugins-official` Frontend design generation
- `skill-creator@claude-plugins-official` Skill creation and testing
- `code-review@power-plugins` Code review for PRs
- `git@power-plugins` Git commit/PR workflows
- `docs@power-plugins` Documentation generation
- `engineering@power-plugins` Engineering helpers
- `cloudflare@power-plugins` Cloudflare power plugin
- `cloudflare@cloudflare` Cloudflare Workers, KV, D1, R2, AI

Marketplaces:
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) Default marketplace (built in, available via `/plugin`)
- [dajanarodriguez/claude-plugins](https://github.com/dajanarodriguez/claude-plugins) Extra plugins
- [cloudflare/skills](https://github.com/cloudflare/skills) Cloudflare platform skills
