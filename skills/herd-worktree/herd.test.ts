import { expect, test, describe } from "bun:test";
import { slugifySite, rewriteEnv, ensureWorktreeInclude } from "./herd.ts";

describe("slugifySite", () => {
  test("joins project and worktree", () => {
    expect(slugifySite("cnc-manager", "feature-x")).toBe("cnc-manager-feature-x");
  });
  test("lowercases and replaces slashes/spaces", () => {
    expect(slugifySite("CNC Manager", "feature/auth-2")).toBe("cnc-manager-feature-auth-2");
  });
  test("trims leading/trailing separators", () => {
    expect(slugifySite("_proj_", "#1234")).toBe("proj-1234");
  });
});

describe("rewriteEnv", () => {
  const host = "cnc-manager-feature-x.test";

  test("replaces existing host keys in place", () => {
    const out = rewriteEnv(
      ["APP_NAME=CNC", "APP_URL=http://localhost", "SESSION_DOMAIN=localhost"].join("\n"),
      host,
    );
    expect(out).toContain("APP_URL=http://cnc-manager-feature-x.test");
    expect(out).toContain("SESSION_DOMAIN=cnc-manager-feature-x.test");
    expect(out).toContain("APP_NAME=CNC"); // untouched
  });

  test("appends APP_URL/SESSION_DOMAIN/SESSION_SECURE_COOKIE when missing", () => {
    const out = rewriteEnv("APP_NAME=CNC", host);
    expect(out).toContain("APP_URL=http://cnc-manager-feature-x.test");
    expect(out).toContain("SESSION_DOMAIN=cnc-manager-feature-x.test");
    expect(out).toContain("SESSION_SECURE_COOKIE=false");
  });

  test("appends host to SANCTUM only when key already present", () => {
    const withSanctum = rewriteEnv("SANCTUM_STATEFUL_DOMAINS=localhost", host);
    expect(withSanctum).toContain("SANCTUM_STATEFUL_DOMAINS=localhost,cnc-manager-feature-x.test");
    const withoutSanctum = rewriteEnv("APP_NAME=CNC", host);
    expect(withoutSanctum).not.toContain("SANCTUM_STATEFUL_DOMAINS");
  });

  test("does not duplicate an already-present sanctum host", () => {
    const out = rewriteEnv(`SANCTUM_STATEFUL_DOMAINS=${host}`, host);
    const sanctum = out.split("\n").filter((l) => l.startsWith("SANCTUM_STATEFUL_DOMAINS="));
    expect(sanctum).toEqual([`SANCTUM_STATEFUL_DOMAINS=${host}`]);
  });

  test("forces SESSION_SECURE_COOKIE to false", () => {
    const out = rewriteEnv("SESSION_SECURE_COOKIE=true", host);
    expect(out).toContain("SESSION_SECURE_COOKIE=false");
    expect(out).not.toContain("SESSION_SECURE_COOKIE=true");
  });
});

describe("ensureWorktreeInclude", () => {
  test("creates content listing .env when file absent", () => {
    expect(ensureWorktreeInclude(null)).toBe(".env\n");
  });
  test("is idempotent when .env already listed", () => {
    expect(ensureWorktreeInclude(".env\n")).toBe(".env\n");
  });
  test("preserves existing entries and appends .env", () => {
    expect(ensureWorktreeInclude("config/secrets.json\n")).toBe("config/secrets.json\n.env\n");
  });
});
