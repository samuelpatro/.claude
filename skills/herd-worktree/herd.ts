#!/usr/bin/env bun
// Set up (or tear down) a Laravel Herd site for the current git worktree.
//
// Designed for the Claude Code agents view, which already creates an isolated
// worktree per background agent under .claude/worktrees/<name>. This script does
// the part the harness does NOT: serve that worktree via Herd at a .test host,
// rewrite the copied .env to match, and install dependencies. It never creates or
// removes worktrees itself.
//
// Usage (run from inside the worktree):
//   bun herd.ts            # plan: print what would happen, change nothing
//   bun herd.ts --apply    # link site, rewrite .env, install deps
//   bun herd.ts --down     # herd unlink the site for this worktree
//   bun herd.ts --force    # skip the "must be in .claude/worktrees" guard

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { basename, join } from "node:path";

// --- pure helpers (unit tested) ----------------------------------------------

/** Build a DNS-safe Herd site name from project + worktree names. */
export function slugifySite(project: string, worktree: string): string {
  return `${project}-${worktree}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Rewrite a Laravel .env so the app answers on `host` (an `<site>.test` domain).
 * Existing keys are replaced in place; APP_URL/SESSION_DOMAIN/SESSION_SECURE_COOKIE
 * are appended if missing. SANCTUM_STATEFUL_DOMAINS is only touched when present
 * (apps without Sanctum should not gain the key).
 */
export function rewriteEnv(env: string, host: string): string {
  const seen = new Set<string>();
  const lines = env.split("\n").map((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) return line;
    const [, key, rawVal] = m;
    seen.add(key);
    switch (key) {
      case "APP_URL":
        return `APP_URL=http://${host}`;
      case "SESSION_DOMAIN":
        return `SESSION_DOMAIN=${host}`;
      case "SESSION_SECURE_COOKIE":
        return "SESSION_SECURE_COOKIE=false";
      case "SANCTUM_STATEFUL_DOMAINS": {
        const val = rawVal.trim();
        const parts = val ? val.split(",").map((s) => s.trim()) : [];
        if (parts.includes(host)) return line;
        return `SANCTUM_STATEFUL_DOMAINS=${val ? val + "," : ""}${host}`;
      }
      default:
        return line;
    }
  });

  const additions: string[] = [];
  if (!seen.has("APP_URL")) additions.push(`APP_URL=http://${host}`);
  if (!seen.has("SESSION_DOMAIN")) additions.push(`SESSION_DOMAIN=${host}`);
  if (!seen.has("SESSION_SECURE_COOKIE")) additions.push("SESSION_SECURE_COOKIE=false");

  let result = lines.join("\n");
  if (additions.length) {
    if (result.length && !result.endsWith("\n")) result += "\n";
    result += additions.join("\n") + "\n";
  }
  return result;
}

/** Ensure `.worktreeinclude` in the main checkout lists `.env` (idempotent). */
export function ensureWorktreeInclude(content: string | null): string {
  const trimmed = content ? content.replace(/\n+$/, "") : "";
  const lines = trimmed ? trimmed.split("\n") : [];
  if (!lines.some((l) => l.trim() === ".env")) lines.push(".env");
  return lines.join("\n") + "\n";
}

// --- side-effecting CLI -------------------------------------------------------

function mainCheckout(cwd: string): string {
  const out = execSync("git worktree list --porcelain", { cwd, encoding: "utf8" });
  const first = out.split("\n").find((l) => l.startsWith("worktree "));
  if (!first) throw new Error("not inside a git repository with worktrees");
  return first.slice("worktree ".length).trim();
}

function run(cmd: string, args: string[], cwd: string) {
  console.log(`  $ ${cmd} ${args.join(" ")}`);
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

function cli() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply");
  const down = args.has("--down");
  const force = args.has("--force");
  const cwd = process.cwd();

  if (!cwd.includes("/.claude/worktrees/") && !force) {
    console.error(
      "Refusing to run: not inside a .claude/worktrees/ worktree.\n" +
        "Run this from a worktree (e.g. an agents-view background agent), or pass --force.",
    );
    process.exit(1);
  }

  const main = mainCheckout(cwd);
  const project = basename(main);
  const worktree = basename(cwd);
  const site = slugifySite(project, worktree);
  const host = `${site}.test`;

  if (down) {
    console.log(`Unlinking Herd site "${site}" (http://${host})`);
    try {
      run("herd", ["unlink", site], cwd);
    } catch {
      console.error("  (herd unlink failed or site not linked — ignoring)");
    }
    console.log("Done.");
    return;
  }

  const envSrc = join(main, ".env");
  const envDst = join(cwd, ".env");
  const hasComposer = existsSync(join(cwd, "composer.json"));
  const hasArtisan = existsSync(join(cwd, "artisan"));
  const hasPackage = existsSync(join(cwd, "package.json"));

  console.log(`Project:   ${project}`);
  console.log(`Worktree:  ${worktree}`);
  console.log(`Site:      http://${host}`);
  console.log(`.env src:  ${existsSync(envSrc) ? envSrc : "(none — will skip copy)"}`);
  console.log(
    `Plan:      ${[
      existsSync(envDst) ? "rewrite .env" : existsSync(envSrc) ? "copy + rewrite .env" : "no .env",
      "herd link",
      hasComposer ? "composer install" : null,
      hasPackage ? "bun install" : null,
      hasArtisan ? "artisan config:clear/cache:clear" : null,
    ]
      .filter(Boolean)
      .join(", ")}`,
  );

  if (!apply) {
    console.log("\n(plan only — re-run with --apply to execute)");
    return;
  }

  console.log("\nApplying:");

  // 1. .env into the worktree (if not already copied by .worktreeinclude)
  if (!existsSync(envDst) && existsSync(envSrc)) {
    console.log("  copy .env from main checkout");
    copyFileSync(envSrc, envDst);
  }
  if (existsSync(envDst)) {
    console.log("  rewrite .env host keys");
    writeFileSync(envDst, rewriteEnv(readFileSync(envDst, "utf8"), host));
  }

  // 2. keep future worktrees auto-copying .env (the cheap "hybrid" half)
  const wtInclude = join(main, ".worktreeinclude");
  const before = existsSync(wtInclude) ? readFileSync(wtInclude, "utf8") : null;
  const after = ensureWorktreeInclude(before);
  if (after !== before) {
    console.log(`  ensure ${wtInclude} lists .env`);
    writeFileSync(wtInclude, after);
  }

  // 3. serve via Herd (HTTP only — matches Vite, no herd secure)
  run("herd", ["link", site], cwd);

  // 4. dependencies
  if (hasComposer) run("composer", ["install", "--no-interaction"], cwd);
  if (hasPackage) run("bun", ["install"], cwd);
  if (hasArtisan) {
    run("php", ["artisan", "config:clear"], cwd);
    run("php", ["artisan", "cache:clear"], cwd);
  }

  console.log(`\nReady: http://${host}`);
  console.log("Start the frontend yourself when needed (e.g. `bun run dev`).");
}

if (import.meta.main) cli();
