---
name: to-issues
description: >-
  Break a plan, spec, PRD, or conversation into independently-grabbable GitHub
  issues using tracer-bullet vertical slices, then publish them with the gh CLI
  as native sub-issues under a parent tracking issue. Use this skill whenever the
  user wants to turn a plan/spec/PRD into GitHub issues, create implementation
  tickets, break work down into issues, file a set of tasks on GitHub, or says
  "/to-issues", "make issues for this", "create tickets", "break this into
  issues", even if they don't say "GitHub". Works in any repo with a GitHub
  remote.
---

# To Issues

Break a plan into independently-grabbable GitHub issues using vertical slices
(tracer bullets), then publish them as native sub-issues under a parent tracking
issue. The aim is issues an agent or teammate can pick up and finish without
needing the rest of the plan in their head.

This skill talks to GitHub directly via the `gh` CLI. It infers the repo from the
clone's `git remote`, so run it from inside the target repository. If `gh` isn't
authenticated, stop and ask the user to run `gh auth login` (suggest they type
`! gh auth login` in the prompt).

## Process

### 1. Gather context

Work from whatever is already in the conversation. If the user passes an issue
reference (number, URL, or a file path to a plan/PRD), fetch and read it fully:

```bash
gh issue view <number> --comments
```

If the source is an existing issue, it becomes the parent in step 5.

### 2. Explore the codebase (when it helps)

If you haven't already, explore the repo enough to ground the issues in reality.
Issue titles and descriptions should use the project's actual domain vocabulary
and respect existing conventions and architecture in the area you're touching.
Concrete, codebase-aware issues beat generic ones.

### 3. Draft vertical slices

Break the plan into **tracer-bullet** issues. Each issue is a thin vertical slice
that cuts end-to-end through ALL integration layers, NOT a horizontal slice of one
layer.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer it touches
  (schema, API, UI, tests).
- A completed slice is demoable or verifiable on its own.
- Prefer many thin slices over few thick ones.
</vertical-slice-rules>

Mark each slice **AFK** (can be implemented and merged with no human interaction)
or **HITL** (needs human input first, e.g. an architectural decision or design
review). Prefer AFK where possible; pull the human-judgment parts into their own
HITL slices so the rest can proceed unblocked.

### 4. Quiz the user before publishing

Present the breakdown as a numbered list. For each slice show:

- **Title** — short, descriptive
- **Type** — AFK / HITL
- **Blocked by** — which other slices must land first (if any)
- **Covers** — which user stories / goals it addresses (if the source has them)

Then ask:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependencies correct?
- Should any slices be merged or split further?
- Are the AFK / HITL markings right?

Iterate until the user approves. Do not create any issues before approval.

### 5. Publish to GitHub

Publish in **dependency order (blockers first)** so each issue can reference the
real numbers of the issues that block it.

**a. Pick labels — adapt to the repo.** List what already exists and reuse fitting
labels rather than inventing new ones:

```bash
gh label list --limit 100
```

Map slices onto sensible existing labels (e.g. an `enhancement`/`feature` label, a
`needs-decision`/`blocked` label for HITL). If a genuinely useful label is missing,
**ask the user before creating it** (`gh label create "<name>" --color <hex>
--description "..."`). Never silently invent labels.

**b. Create the parent tracking issue.** If the source was an existing issue, use
it as the parent. Otherwise create one that frames the whole effort and will hold
the slices as sub-issues:

```bash
gh issue create --title "<feature> — tracking" --body "$(cat <<'EOF'
## Overview
<one-paragraph summary of the plan>

## Slices
(sub-issues are linked below once created)
EOF
)"
```

Capture the parent number from the returned URL.

**c. Create each slice issue** using the template below. Capture each new issue's
number and its REST id (the sub-issues API needs the id, not the number):

```bash
gh issue create --title "<slice title>" --body "$(cat <<'EOF'
<rendered template>
EOF
)" --label "<chosen label>"

# then resolve the numeric id for the sub-issue link:
gh api "repos/{owner}/{repo}/issues/<new-number>" --jq '.id'
```

**d. Attach each slice as a native sub-issue of the parent:**

```bash
gh api --method POST "repos/{owner}/{repo}/issues/<parent-number>/sub_issues" \
  -F sub_issue_id=<child-id>
```

If the sub-issues endpoint is unavailable on the repo/plan, fall back gracefully:
add a `## Sub-issues` task list to the parent body (`- [ ] #<number>`) and tell the
user native sub-issues weren't available, so they know why.

Do NOT close or modify the parent's original content beyond adding the slice links.

### 6. Report back

Give the user the parent issue URL and a short list of the created slice numbers
with their titles and dependency order, so they can see the whole tree at a glance.

## Issue body template

<issue-template>
## What to build

A concise description of this vertical slice. Describe the end-to-end behavior,
not a layer-by-layer implementation plan.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a
prototype or prior discussion produced a snippet that encodes a decision more
precisely than prose can (a state machine, reducer, schema, or type shape), inline
just the decision-rich part and note where it came from.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- #<number> (the blocking slice), or "None — can start immediately"
</issue-template>

## Anti-patterns

- **Horizontal slices.** "Build all the API endpoints" then "build all the UI" is
  not a tracer bullet. Each issue must reach through every layer it needs.
- **Publishing before approval.** Always quiz the user first (step 4).
- **Inventing labels silently.** Reuse the repo's labels; ask before creating new
  ones.
- **File paths and code dumps in issue bodies.** They rot. Describe behavior and
  acceptance criteria instead.
- **Touching the parent issue's existing content.** Only add sub-issue links; never
  close or rewrite it.
