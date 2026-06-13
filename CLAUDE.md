## Tooling
Use bun, not npm (bun install, bun add, bun remove, bun run, bunx). PHP via Herd.
Skip frontend builds during dev unless explicitly asked or for production.
Use scripts/ folder for throwaway scripts or complex one-off work. Run with bun. Delete after use, unless meant to be shared with other devs (then keep it and name it clearly).

## Workflow
When fanning out across multiple files, items, or independent queries, spawn subagents (Agent tool) in parallel in the same turn, rather than sequentially.
Verify UI components, form fields, and API endpoints by reading source before assuming.
Add tests when introducing new public functions, API endpoints, or non-trivial logic. Throwaway scripts and tiny refactors don't need tests.

## Code
Code, DB columns, variables, API fields, and comments: English only. UI strings may be localized.

## Docs & GitHub
No em-dashes (—) or sentence-joining hyphens as punctuation; rephrase with periods, commas, or parentheses. Hyphens in flags, kebab-case, file names, and compound words are fine.
Place new docs in /docs/ (except root README.md). Create the folder if missing.
For questions about GitHub, use the gh tool.
Never mention Claude Code in PR descriptions, PR comments, or issue comments. Do not include a "Test plan" section in PR descriptions.
