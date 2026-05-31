## Scope
- Verify UI components, form fields, and API endpoints by reading source before assuming.
- Never read or print contents of .env*, credentials, or token files. Treat secrets as opaque.

## Workflow
- Use TaskCreate for 2+ step work; track dependencies with addBlockedBy/addBlocks.
- Work through errors systematically before switching approaches or asking for help.
- When fanning out across multiple files, items, or independent queries, spawn subagents (Agent tool) in parallel in the same turn, rather than sequentially.
- Pick subagent model explicitly: Haiku for grunt work (file scans, log greps), Opus for hard reasoning, Sonnet default.

## Tooling
- Use bun, not npm (bun install, bun add, bun remove, bun run, bunx).
- Skip frontend builds during dev unless explicitly asked or for production.
- Use scripts/ folder for throwaway scripts to test things or do more complex one-off work. Run them with bun. Delete after use, unless the script is meant to be shared with other devs (then keep it and name it clearly).

## Localization
- Code, DB columns, variables, API fields, and comments: English only. UI strings may be localized.

## Scope discipline
- Only make changes directly requested or clearly necessary. Don't add features, refactors, or "improvements" beyond what was asked.
- Don't add abstractions or helpers for one-time operations, or build for hypothetical future needs.
- Don't add error handling, fallbacks, or validation for cases that can't happen. Validate only at system boundaries (user input, external APIs).
- Don't add docstrings, comments, or type annotations to code you didn't change. Comment only where logic isn't self-evident.

## Testing
- Add tests when introducing new public functions, API endpoints, or non-trivial logic. Throwaway scripts and tiny refactors don't need tests.

## Docs
- No em-dashes (—) or sentence-joining hyphens as punctuation; rephrase with periods, commas, or parentheses. Hyphens in flags, kebab-case, file names, and compound words are fine.
- Place new docs in /docs/ (except root README.md). Create the folder if missing.
