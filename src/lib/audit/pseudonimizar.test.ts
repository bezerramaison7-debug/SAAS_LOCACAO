import { describe, expect, it } from "vitest";

import { pseudonimizar } from "./pseudonimizar";

describe("pseudonimizar", () => {
  it("normaliza, é determinístico e depende do segredo", () => {
    const a = pseudonimizar(" Admin.A@Demo.test ", "s1".repeat(16));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(pseudonimizar("admin.a@demo.test", "s1".repeat(16))).toBe(a);
    expect(pseudonimizar("admin.a@demo.test", "s2".repeat(16))).not.toBe(a);
    expect(a).not.toContain("admin");
  });
});
