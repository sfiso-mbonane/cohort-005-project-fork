import { describe, expect, it } from "vitest";

import {
  estimateTokens,
  findOversizedFiles,
  formatReport,
  MAX_TOKENS,
} from "./check-file-tokens";

const LIMIT_BYTES = MAX_TOKENS * 4;

describe("check-file-tokens", () => {
  it("estimates tokens as bytes / 4", () => {
    expect(estimateTokens(20_000)).toBe(5000);
    expect(estimateTokens(20_001)).toBe(5001);
  });

  it("allows a file exactly at the limit and flags one just over", () => {
    expect(
      findOversizedFiles([
        { path: "app/at-limit.ts", bytes: LIMIT_BYTES },
        { path: "app/over.ts", bytes: LIMIT_BYTES + 4 },
      ])
    ).toEqual([{ path: "app/over.ts", tokens: MAX_TOKENS + 1 }]);
  });

  it("ignores generated and binary files", () => {
    const huge = LIMIT_BYTES * 10;
    expect(
      findOversizedFiles([
        { path: "package-lock.json", bytes: huge },
        { path: "drizzle/meta/0012_snapshot.json", bytes: huge },
        { path: "public/logo.png", bytes: huge },
      ])
    ).toEqual([]);
  });

  it("gives route-specific guidance for route files", () => {
    const report = formatReport([
      { path: "app/routes/courses.$slug.tsx", tokens: 8000 },
    ]);
    expect(report).toContain("app/routes/courses.$slug.tsx");
    expect(report).toContain("app/modules/<name>/");
    expect(report).toContain("Do NOT shrink the file by minifying");
  });

  it("gives test-specific guidance for test files", () => {
    const report = formatReport([
      { path: "app/lib/refunds.server.test.ts", tokens: 6000 },
    ]);
    expect(report).toContain("describe");
  });
});
