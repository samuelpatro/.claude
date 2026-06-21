import { execFileSync } from "child_process";
import { basename, join } from "path";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { createHash } from "crypto";

// ── Colors ──────────────────────────────────────────────
const orange = "\x1b[38;2;255;176;85m";
const green = "\x1b[38;2;0;175;80m";
const cyan = "\x1b[38;2;86;182;194m";
const red = "\x1b[38;2;255;85;85m";
const yellow = "\x1b[38;2;230;200;0m";
const magenta = "\x1b[38;2;180;140;255m";
const blue = "\x1b[38;2;100;149;237m";
const gray = "\x1b[38;2;140;140;140m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";
const rst = "\x1b[0m";

const sep = ` ${gray}·${rst} `;

// ── Helpers ─────────────────────────────────────────────
function formatTokens(num: number): string {
  if (num >= 1_000_000) {
    const val = num / 1_000_000;
    return (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)) + "M";
  }
  if (num >= 1000) return Math.floor(num / 1000) + "k";
  return String(num);
}

function colorForPct(pct: number): string {
  // Ascending severity (green -> yellow -> orange -> red). Stays green through
  // the first two thirds so a half-full context reads as calm; warning colors
  // only kick in as it approaches the compaction limit.
  if (pct >= 90) return red;
  if (pct >= 80) return orange;
  if (pct >= 65) return yellow;
  return green;
}

function mutedColorForPct(pct: number): string {
  if (pct >= 80) return red;
  if (pct >= 70) return "\x1b[38;2;170;150;50m";
  if (pct >= 50) return "\x1b[38;2;180;135;75m";
  return "\x1b[38;2;60;135;75m";
}

function effortStyle(level: string): string {
  switch (level) {
    case "low":
      return blue;
    case "medium":
      return yellow;
    case "high":
      return orange;
    case "xhigh":
      return magenta;
    case "max":
      return `${bold}${red}`;
    default:
      return gray;
  }
}

function formatResetTime(
  value: string | number | undefined | null,
  style: "time" | "datetime",
): string {
  if (value == null || value === "null") return "";
  const d = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (isNaN(d.getTime())) return "";

  const h = d.getHours();
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  const timeStr = `${h12}:${d.getMinutes().toString().padStart(2, "0")}${ampm}`;
  if (style === "time") return timeStr;

  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${timeStr}`;
}

// ── Read input ──────────────────────────────────────────
// readFileSync on fd 0 is the cheapest sync stdin read and avoids top-level
// await (which blocks --bytecode compilation).
let input: any;
try {
  const raw = readFileSync(0, "utf8");
  input = raw ? JSON.parse(raw) : null;
} catch {
  process.stdout.write("Claude");
  process.exit(0);
}

if (!input) {
  process.stdout.write("Claude");
  process.exit(0);
}


// ── Load ~/.claude/settings.json once (context window + effort) ──
let settings: any = {};
try {
  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (home) {
    settings = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8"));
  }
} catch {}

// ── Extract JSON data ───────────────────────────────────
const modelName: string = (input.model?.display_name ?? "Claude").replace(/\s*\(.*?\)/, "");

// Denominator matches what `/context` shows. When auto-compact is enabled the
// context is effectively capped at autoCompactWindow (compaction triggers there),
// so divide by that instead of the model's full window. Fall back to the model
// size when auto-compact is off or no window is configured.
const modelSize: number = input.context_window?.context_window_size || 1000000;
const autoCompactOn = settings.autoCompactEnabled !== false;
const compactWindow: number = Number(settings.autoCompactWindow) || 0;
const size: number =
  autoCompactOn && compactWindow > 0 ? Math.min(compactWindow, modelSize) : modelSize;
const inputTokens: number = input.context_window?.current_usage?.input_tokens ?? 0;
const cacheCreate: number = input.context_window?.current_usage?.cache_creation_input_tokens ?? 0;
const cacheRead: number = input.context_window?.current_usage?.cache_read_input_tokens ?? 0;
const current = inputTokens + cacheCreate + cacheRead;
const pctUsed = size > 0 ? Math.floor((current * 100) / size) : 0;

// ── Session duration (from transcript file birth time) ──
let sessionDuration = "";
try {
  const transcriptPath: string = input.transcript_path ?? "";
  if (transcriptPath) {
    const birthMs = statSync(transcriptPath).birthtimeMs;
    const elapsedMs = Date.now() - birthMs;
    const totalSec = Math.floor(elapsedMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h > 0) sessionDuration = `${h}h${m > 0 ? `${m}m` : ""}`;
    else if (m > 0) sessionDuration = `${m}m`;
    else sessionDuration = "<1m";
  }
} catch {}

// Effort level lives at `input.effort.level` in current schema; fall back to
// legacy `input.effort_level` and finally to settings.json on disk.
let effort: string = input.effort?.level ?? input.effort_level ?? "default";
if (effort === "default") {
  effort = settings.effortLevel ?? "default";
}

// ── Git info ────────────────────────────────────────────
const cwd: string = input.cwd ?? input.workspace?.current_dir ?? process.cwd();
const dirName = basename(cwd);

type GitInfo = {
  branch: string;
  additions: number;
  deletions: number;
  ahead: number;
  behind: number;
  repoName?: string;
};

const GIT_CACHE_TTL_MS = 5000;
const sessionId: string = input.session_id ?? "default";
const cacheDir = join(tmpdir(), "claude-statusline-cache");
const cacheKey =
  sessionId + "-" + createHash("sha1").update(cwd).digest("hex").slice(0, 16) + ".json";
const cachePath = join(cacheDir, cacheKey);

let gitInfo: GitInfo | null = null;
try {
  if (Date.now() - statSync(cachePath).mtimeMs < GIT_CACHE_TTL_MS) {
    gitInfo = JSON.parse(readFileSync(cachePath, "utf8"));
  }
} catch {}

if (!gitInfo) {
  gitInfo = { branch: "", additions: 0, deletions: 0, ahead: 0, behind: 0 };
  const gitOpts = { encoding: "utf8" as const, stdio: ["pipe", "pipe", "ignore"] as const };
  let ranGit = false;
  try {
    ranGit = true;
    // Single combined call: branch + upstream ahead/behind + porcelain changes.
    // Implicitly errors out when cwd is not a git repo.
    const statusOut = execFileSync(
      "git",
      ["-C", cwd, "status", "--porcelain=v2", "--branch"],
      gitOpts,
    );
    let hasChanges = false;
    for (const line of statusOut.split("\n")) {
      if (line.startsWith("# branch.head ")) {
        const b = line.slice(14);
        if (b && !b.startsWith("(")) gitInfo.branch = b;
      } else if (line.startsWith("# branch.ab ")) {
        const parts = line.slice(12).split(" ");
        gitInfo.ahead = parseInt(parts[0]?.slice(1) ?? "", 10) || 0;
        gitInfo.behind = parseInt(parts[1]?.slice(1) ?? "", 10) || 0;
      } else if (line && !line.startsWith("# ")) {
        hasChanges = true;
      }
    }
    if (hasChanges) {
      let numstatRaw = "";
      try {
        numstatRaw = execFileSync(
          "git",
          ["-C", cwd, "diff", "HEAD", "--numstat"],
          gitOpts,
        ).trim();
      } catch {}
      if (!numstatRaw) {
        try {
          numstatRaw = execFileSync(
            "git",
            ["-C", cwd, "diff", "--cached", "--numstat"],
            gitOpts,
          ).trim();
        } catch {}
      }
      for (const line of numstatRaw.split("\n")) {
        const parts = line.split("\t");
        if (parts.length >= 2) {
          const adds = parseInt(parts[0], 10);
          const dels = parseInt(parts[1], 10);
          if (!isNaN(adds)) gitInfo.additions += adds;
          if (!isNaN(dels)) gitInfo.deletions += dels;
        }
      }
    }
    // In a worktree, cwd's basename is the worktree name (== input.worktree.name),
    // so showing it as the dir would duplicate the ⧉ segment. Resolve the parent
    // repo's name from the shared git dir to show instead. Cached with the rest.
    if (input.worktree) {
      try {
        let commonDir = execFileSync(
          "git",
          ["-C", cwd, "rev-parse", "--git-common-dir"],
          gitOpts,
        ).trim();
        if (commonDir) {
          if (!commonDir.startsWith("/")) commonDir = join(cwd, commonDir);
          gitInfo.repoName = basename(commonDir.replace(/\/\.git\/?$/, ""));
        }
      } catch {}
    }
  } catch {}
  if (ranGit) {
    try {
      mkdirSync(cacheDir, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(gitInfo));
    } catch {}
  }
}

const gitBranch = gitInfo.branch;
const gitAdditions = gitInfo.additions;
const gitDeletions = gitInfo.deletions;
const gitAhead = gitInfo.ahead;
const gitBehind = gitInfo.behind;

// ── LINE 1: Dir (branch) │ Context % │ Model │ Effort ──
// In a worktree, prefer the parent repo's name so the dir segment isn't a
// duplicate of the ⧉ worktree name (they're the same folder basename).
const projectName = input.worktree && gitInfo.repoName ? gitInfo.repoName : dirName;
let line1 = `${cyan}${projectName}${rst}`;
if (input.worktree) {
  // Drop the ⧉ segment if it would just repeat the dir name (repo name unknown).
  if (input.worktree.name && input.worktree.name !== projectName) {
    line1 += ` ${magenta}⧉ ${input.worktree.name}${rst}`;
  }
  if (input.worktree.original_branch) {
    line1 += `${dim} ← ${input.worktree.original_branch}${rst}`;
  }
} else if (gitBranch) {
  line1 += ` ${blue}⎇ ${gitBranch}${rst}`;
}
if (gitAdditions > 0 || gitDeletions > 0) {
  if (gitAdditions > 0) line1 += ` ${green}+${gitAdditions}${rst}`;
  if (gitDeletions > 0) line1 += ` ${red}-${gitDeletions}${rst}`;
}
if (gitAhead > 0 || gitBehind > 0) {
  if (gitAhead > 0) line1 += ` ${green}↑${gitAhead}${rst}`;
  if (gitBehind > 0) line1 += ` ${yellow}↓${gitBehind}${rst}`;
}
line1 += sep;
line1 += `${colorForPct(pctUsed)}${formatTokens(current)}/${formatTokens(size)} ${pctUsed}%${rst}`;
if (pctUsed >= 90) {
  line1 += ` ${red}⚠${rst}`;
}
line1 += sep;
line1 += `${orange}${modelName} ${effortStyle(effort)}(${effort})${rst}`;
if (sessionDuration) {
  line1 += sep;
  line1 += `${gray}${sessionDuration}${rst}`;
}

// ── Rate limit line (from input.rate_limits) ────────────
const rateLimits = input.rate_limits;
let rateLine = "";

if (rateLimits?.five_hour) {
  const fhPct = Math.round(rateLimits.five_hour.used_percentage ?? 0);
  const sdPct = rateLimits.seven_day ? Math.round(rateLimits.seven_day.used_percentage ?? 0) : 0;

  if (fhPct >= 10 || sdPct >= 10) {
    const fhReset = formatResetTime(rateLimits.five_hour.resets_at, "time");
    rateLine += `${gray}5h:${rst} ${mutedColorForPct(fhPct)}${fhPct}%${rst} ${gray}⟳ ${fhReset}${rst}`;

    if (rateLimits.seven_day) {
      const sdReset = formatResetTime(rateLimits.seven_day.resets_at, "datetime");
      rateLine += `${sep}${gray}7d:${rst} ${mutedColorForPct(sdPct)}${sdPct}%${rst} ${gray}⟳ ${sdReset}${rst}`;
    }
  }
}


// ── Output ──────────────────────────────────────────────
// Single write avoids an extra syscall when both lines are present.
process.stdout.write(rateLine ? line1 + "\n" + rateLine : line1);
