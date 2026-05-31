#!/usr/bin/env bun
/**
 * Sync allowlisted Claude config files from the live ~/.claude directory into
 * this git repo. Allowlist-based by design: only the files named in FILES are
 * ever read or copied, so anything else in ~/.claude (.credentials.json,
 * history.jsonl, projects/, sessions/, todos/, ...) can never be picked up.
 * A value-shaped secret scan on the copied content is a second safety net.
 *
 *   bun sync.ts          # check: report what would change, copy nothing
 *   bun sync.ts --apply  # copy changed files into the repo (normalized to LF)
 *
 * Exit codes: 0 = ok, 2 = a possible secret was found and the copy was blocked.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const FILES = ["settings.json", "CLAUDE.md", "statusline.ts"];

// Repo root is two levels up from this script (skills/sync-claude/sync.ts).
const REPO = join(import.meta.dir, "..", "..");
const LIVE = join(homedir(), ".claude");

const apply = process.argv.includes("--apply");

// Match secret VALUES, not keywords, so prose like "never print token files"
// in CLAUDE.md does not trip the scan.
const SECRET_PATTERNS: [string, RegExp][] = [
  ["Anthropic key", /sk-ant-[A-Za-z0-9_-]{20,}/],
  ["OpenAI key", /\bsk-[A-Za-z0-9]{32,}\b/],
  ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b/],
  ["GitHub PAT", /\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ["AWS key id", /\bAKIA[0-9A-Z]{16}\b/],
  ["Google key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  [
    "Secret assignment",
    /(?:secret|token|password|passwd|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization|bearer)["']?\s*[:=]\s*["'][A-Za-z0-9_\-./+=]{16,}["']/i,
  ],
];

const norm = (s: string) => s.replace(/\r\n/g, "\n");

function scan(name: string, content: string): string[] {
  const hits: string[] = [];
  content.split("\n").forEach((line, i) => {
    for (const [label, re] of SECRET_PATTERNS) {
      if (re.test(line)) hits.push(`${name}:${i + 1} looks like ${label}`);
    }
  });
  return hits;
}

let changed = 0;
let blocked = 0;
const summary: string[] = [];

for (const file of FILES) {
  const livePath = join(LIVE, file);
  const repoPath = join(REPO, file);

  if (!existsSync(livePath)) {
    summary.push(`skip       ${file} (not present in ~/.claude)`);
    continue;
  }

  const live = norm(readFileSync(livePath, "utf8"));
  const repo = existsSync(repoPath) ? norm(readFileSync(repoPath, "utf8")) : null;

  if (repo === live) {
    summary.push(`unchanged  ${file}`);
    continue;
  }

  const hits = scan(file, live);
  if (hits.length) {
    blocked++;
    summary.push(`BLOCKED    ${file} (possible secret, not copied):`);
    for (const h of hits) summary.push(`             ${h}`);
    continue;
  }

  changed++;
  if (apply) {
    writeFileSync(repoPath, live); // normalized to LF
    summary.push(`copied     ${file}`);
  } else {
    summary.push(`would copy ${file}`);
  }
}

console.log(summary.join("\n"));
console.log(
  `\n${apply ? "Applied" : "Check"}: ${changed} changed, ${blocked} blocked` +
    (!apply && changed ? "  (run with --apply to copy)" : ""),
);
if (blocked) process.exit(2);
