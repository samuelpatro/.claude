#!/usr/bin/env bun
// Compile the status line to a native binary for the CURRENT OS.
//
// bun --compile emits a host-native binary (Mach-O on macOS, ELF on Linux, PE on
// Windows), so there is no single portable artifact. On macOS/Linux the output has
// no extension; on Windows bun automatically appends `.exe`. Both are gitignored.
//
//   bun ~/.claude/statusline.build.ts
//
// Then point statusLine.command in settings.json at the result. Rebuild on each
// machine, since the binary is specific to that OS/arch.
import { $ } from "bun";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "statusline.ts");
const out = join(here, "statusline"); // bun appends .exe automatically on Windows

await $`bun build --bytecode --compile ${src} --outfile ${out}`;

console.log(`\nBuilt status line for ${process.platform}/${process.arch}.`);
console.log("Rebuild on each machine; the binary is host-specific.");
