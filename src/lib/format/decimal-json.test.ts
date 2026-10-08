import { describe, expect, it } from "vitest";

import { decimalParaJson } from "./decimal-json";

describe("decimalParaJson", () => {
  it.each(["0", "1234.56", "999999999999.99", "0.001", "12345678901.123"])("%s é exato", (v) => {
    expect(JSON.stringify(decimalParaJson(v))).toBe(String(Number(v)));
    expect(String(decimalParaJson(v))).toBe(String(Number(v)));
  });

  it("rejeita valores que perderiam precisão", () => {
    expect(() => decimalParaJson("12345678901234567.89")).toThrow(RangeError);
  });
});
