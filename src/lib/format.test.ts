import { describe, expect, it } from "vitest";
import { openingMonth } from "./format";

describe("openingMonth", () => {
  it("steps back two months within a year", () => {
    expect(openingMonth("2026-11")).toBe("2026-09");
    expect(openingMonth("2026-03")).toBe("2026-01");
  });

  it("crosses the year boundary, so January and February hide nothing", () => {
    expect(openingMonth("2026-02")).toBe("2025-12");
    expect(openingMonth("2026-01")).toBe("2025-11");
  });
});
