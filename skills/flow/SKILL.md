---
name: flow
description: >-
  Verify a code change end-to-end in the current worktree: figure out what
  changed, run the relevant tests, get the app running, drive a browser to
  exercise the affected areas, and report a verdict with screenshots. Generic
  across project types (Laravel/Herd, Node/bun, frontend, CLI, library). Use this
  skill whenever the user wants to verify/QA/smoke-test a change, check that a PR
  or branch's changes actually work, validate uncommitted work before pushing, or
  says "/flow", "flow this", "verify this change", "does this PR work", "check my
  changes", "test and click through this". Accepts an optional target (a PR
  number/URL, a branch/ref, or a worktree path); with no argument it verifies the
  current uncommitted/working changes.
---

# Flow

Verify a change end-to-end and report whether it actually works: **identify the
change set → run relevant tests → get the app running → drive the browser →
report a verdict.**

## Hard rule: never mutate git state

This skill is **read-only on the repository**. It must NOT run `git checkout`,
`git switch`, `git stash`, `git reset`, `git worktree add`, `git pull`, or anything
that changes what's checked out or creates new worktrees. It verifies whatever is
**already present in the current worktree**. A target argument is used only to
*locate the change set* and *pull context* (e.g. a PR's acceptance criteria), never
to switch code.

If verifying the requested target would require changing the current checkout (e.g.
the user names a branch that isn't the one checked out), do not switch. State what's
currently checked out versus what was requested, verify what's actually there, and
let the user decide. The only directory change allowed is `cd`-ing into an
**existing** worktree path the user passes as the target.

## 1. Resolve the target and the change set (no mutation)

Determine what "the change" is, using the optional argument:

- **No argument** → the working changes in the current worktree:
  `git status --short` plus `git diff HEAD` (staged + unstaged).
- **PR number or URL** (e.g. `142`, a `github.com/.../pull/142` URL) → pull context
  with `gh pr view <n> --json title,body,headRefName,files,comments` and the diff
  with `gh pr diff <n>`. If the current branch matches the PR's head branch, verify
  the current worktree directly. If it doesn't match, do NOT switch — note the
  mismatch, and still use the PR body for acceptance criteria while verifying the
  current code (or ask the user how to proceed).
- **Branch or ref** (e.g. `feature/login`, a tag, a SHA) → compute the change set
  with `git diff <ref>...HEAD` (or `git diff <ref>`) to see what differs, without
  switching.
- **Worktree path** (an existing directory) → `cd` into it and treat its working
  changes as the target. Never create it.

## 2. Understand what changed

Read the diff and build a mental model before touching anything:

- List changed files and classify them: backend/API, frontend/UI, config, database
  migrations, tests, infra.
- Identify the **affected surfaces** — which routes, pages, components, endpoints,
  or commands a user would reach this change through. These drive the browser step.
- Extract **acceptance criteria** if the source has them (PR/issue body, a linked
  spec, or the conversation). If there are none, you'll smoke-test instead.

If the change is purely non-UI (library, CLI, pure backend with no reachable
screen), plan to verify via tests and, where relevant, by running the CLI/command
directly rather than a browser.

## 3. Run the relevant tests

Detect the runner from the project's own conventions rather than assuming:

- Check `package.json` scripts (prefer `bun test` / `bun run test`, vitest, jest).
- For PHP/Laravel, use Pest or PHPUnit per the repo (`./vendor/bin/pest`,
  `php artisan test`).
- Other ecosystems: use their standard runner.

Prefer running the tests **relevant to the change** (the changed test files, or a
path/pattern filter) for speed; fall back to the full suite when scoping isn't
reliable. Report pass/fail with the actual output. Failing tests don't stop the
flow — continue, but surface them prominently in the verdict.

## 4. Get the app running

Reuse existing infrastructure; don't stand up anything new if it's already serving.

- Invoke the project's **`run`** skill if available, or follow the project's
  documented dev command. Match the user's tooling (bun, not npm; PHP via Herd).
- **Laravel/Herd**: the site is typically already served at `<project>.test` (or the
  worktree's Herd URL). Use that; don't spin up a second server.
- **Node/frontend**: start or reuse the dev server; capture the local URL.
- Determine the **base URL** for the browser step. If nothing can serve a UI, skip
  to step 6 with tests (and any CLI checks) as the evidence.

## 5. Drive the browser (adaptive)

Use the **agent-browser** skill to exercise the change against the running app.

- **If acceptance criteria exist** → drive the browser through each one and record
  whether it's met, with a screenshot as evidence.
- **If no criteria** → smoke-test the affected surfaces from step 2: navigate to
  each touched route/screen, perform the obvious interactions (submit the form,
  open the modal, load the list), screenshot each, and watch for breakage — console
  errors, failed network requests, layout that's obviously wrong, server errors.

Keep it focused on what the diff actually touched; this is verification of *this
change*, not a full-site audit. Capture screenshots so the report is concrete.

## 6. Report a verdict

Give a structured, self-contained report. Lead with a **status table** so the
result is scannable at a glance, then the detail, then nitpicks.

Use these status icons consistently everywhere in the report:

- ✅ pass / works as expected
- ❌ fail / broken — blocks the change
- ⚠️ works but with a caveat, or couldn't be fully verified (e.g. auth-gated, no
  backend, skipped)
- ⏭️ not applicable / intentionally skipped

### Report structure

1. **Verdict line** — one line up top with an overall icon: `✅ Looks good`,
   `❌ Issues found`, or `⚠️ Works with caveats`. Be a critic, not a
   rubber-stamp: if anything is ❌, the overall verdict cannot be ✅.

2. **Target** — one line: what was verified (working changes / PR #N / ref /
   worktree) and the current checkout it ran against. Flag any mismatch.

3. **Status table** — a Markdown table covering every check performed. Columns:
   `Check | Status | Notes`. One row per meaningful check. Example:

   ```
   | Check                     | Status | Notes                                  |
   | ------------------------- | :----: | -------------------------------------- |
   | Typecheck                 |   ✅   | tsc clean                              |
   | Unit tests                |   ✅   | 497 passed / 31 files                  |
   | Build                     |   ✅   | vite build, all utilities generated    |
   | Login page renders        |   ✅   | no console errors                      |
   | Cashflow pages (live)     |   ⚠️   | auth-gated, no backend under vite dev  |
   | Computed-style parity     |   ✅   | class == inline var, light + dark      |
   ```

   When acceptance criteria exist, give each criterion its own row.

4. **Change summary** — a few lines on what the diff does and the surfaces touched.

5. **Detail** — expand anything that needs it: failing test output verbatim,
   per-surface browser results with screenshots, exact reproduction for any ❌.

6. **Nitpicks & follow-ups** — a separate bulleted list of issues that are **not
   blocking** but should be fixed later: cosmetic glitches, console warnings, dead
   code spotted, missing edge-case handling, minor inconsistencies, tech debt. Each
   bullet: what it is, where (`file:line` when known), and why it's low-priority.
   Use ⚠️ for ones worth a closer look and a plain `-` for pure nits. If there are
   none, say "None spotted." explicitly — don't omit the section.

Every ❌ and ⚠️ in the table must be explained in Detail or Nitpicks. Don't bury a
real problem; surface it plainly.

Do not commit, push, or open a PR — flow only observes and reports.

## Anti-patterns

- **Mutating git state.** No checkout/switch/stash/reset/worktree-add/pull. Verify
  what's already there.
- **Spinning up duplicate servers.** Reuse the Herd site or running dev server.
- **Auditing the whole app.** Stay scoped to what the diff touched.
- **Rubber-stamping.** If tests fail or the browser shows breakage, say so plainly
  in the verdict.
- **Browser-forcing a non-UI change.** A library/CLI change is verified by tests and
  direct command runs, not a browser.
