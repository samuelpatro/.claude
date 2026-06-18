---
name: prototype
description: >-
  Reproduce an existing design as a faithful, self-contained standalone .html
  file you can tinker with safely, then generate variations on top of that copy
  and recommend the strongest. The source can be a live website (captured via the
  browser) or an existing page/component/design system already in the codebase.
  Use this skill whenever the user wants to copy/clone a design into an HTML
  sandbox, replicate how a site or page looks, mock up variations off an existing
  design, explore options without touching the real app, asks for "a copy of this
  design", "rebuild this page as html", "some variations of this", "mockups based
  on X", or says "prototype this". For implementing variants directly inside the
  running app with a live switcher instead, use the real-prototype skill.
---

# Prototype

Take an existing design, reproduce it as a **faithful standalone `.html` file**
(self-contained, opens with no build step, never touches the real app), then
generate **variations on top of that copy** and recommend one. The point is a safe
sandbox: an accurate base you can experiment against freely.

If the user wants variants implemented **directly in the running app** with a live
switcher, that's the **real-prototype** skill instead, not this one.

## 1. Identify the source and capture it

The design comes from one of two places. Figure out which from the request.

### Source A — a live website (URL)

Use the **agent-browser** skill to capture the design faithfully:

- Navigate to the URL. Take full-page and per-section screenshots at the target
  viewport(s) so you have a visual reference to match against.
- Extract the rendered structure and styling: the relevant DOM/HTML for the
  section, computed styles (colors, fonts, font sizes, spacing, radii, shadows),
  layout (fl/grid structure), and the real text content.
- Note fonts and key assets (logos, icons, images). Inline or link them so the copy
  renders standalone; if an asset can't be fetched, substitute a close placeholder
  and note it.

Reproduce what's actually rendered, not a guess from the URL.

### Source B — existing design already in the codebase

When the source is a page/component/design system in the repo:

- Read the component/page source and the project's design tokens (Tailwind config,
  CSS variables, theme files, shared UI components) so the copy uses the real
  colors, type scale, and spacing.
- Pull representative real content from the same place the component would get it.

## 2. Build a faithful standalone copy

Reproduce the source as **one self-contained `.html` file**:

- Inline `<style>` and any `<script>`; no external build, no dev server. A CDN build
  is acceptable only if real component state is genuinely needed; prefer plain
  HTML/CSS.
- Match the source closely: layout, spacing, type scale, colors, the actual
  content. Compare against the screenshots (Source A) or the rendered component
  (Source B) and tighten until it reads as the same design, not an approximation.
- Make it responsive to the same viewports as the source.

This faithful copy is the **base** — label it clearly (e.g. an "Original" tab or top
section). Save it under the project (or `scripts/` for throwaway work, per the
user's conventions). It must stand on its own so the user can open and tinker with
it directly.

## 3. Generate variations on top of the copy

With the faithful base in hand, produce variations that explore real alternatives.
Default to **3** variations (2 for a quick A/B, 4-5 when the space is wide open; cap
at 5). Add them to the same `.html` file alongside the original.

- Switch between original and variations via a **tab bar** (best for full pages) or
  stacked, labeled sections (best for small components you want side by side).
- Each variation embodies a different *idea*, not just a recolor: layout/structure,
  density, interaction model, visual tone, or progressive disclosure. Give each a
  short memorable name. If two converge, kill one and make it more divergent.
- Keep every variation polished enough to judge fairly (spacing, type, hover/focus,
  empty/error states where relevant) and consistent with the source's design
  language unless the user explicitly wants a fresh direction.

## 4. Recommend, then surface the remix

Evaluate the variations against the goal and **pick one**. Be a critic, not a
cheerleader: name each option's real weakness, not just its strength. Recommend one,
say why it wins for this use case, and note when a different one would be the better
call. Put a short **Recommendation** section at the bottom of the `.html` so the
decision travels with the file.

Then invite the most valuable feedback explicitly: **which elements to mix across
options** ("the header from the original, the layout from B"). That cross-pollination
is usually the design the user actually wants.

## 5. Hand it over

Open the file when possible (`open <file>` on macOS) and send it with the file tool
so it surfaces, then give your recommendation in chat too. Offer the next step:
refine a chosen variation here, or move it into the real app (point them to the
**real-prototype** skill for in-app implementation).

## Anti-patterns

- **A loose approximation instead of a faithful copy.** Step 2's base should match
  the source; if it doesn't, the variations have no honest baseline.
- **Variations that differ only in color or copy.** That's a tweak. Real variations
  disagree about structure.
- **Touching the real app.** This skill stays in the standalone `.html`. For in-app
  work, use real-prototype.
- **Lorem ipsum.** Use the source's real (or realistic) content; placeholder text
  hides design problems.
- **Skipping the browser capture for a live site.** Don't reconstruct a URL's design
  from memory; capture what's actually rendered.
