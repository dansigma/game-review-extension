import { describe, expect, it } from "vitest";
import { applyOpeningFilter } from "../src/classify.ts";

describe("applyOpeningFilter", () => {
  it("rewrites positive classes to opening during the opening phase", () => {
    expect(applyOpeningFilter("best", true)).toBe("opening");
    expect(applyOpeningFilter("great", true)).toBe("opening");
    expect(applyOpeningFilter("brilliant", true)).toBe("opening");
  });

  it("keeps negative and neutral classes during the opening phase", () => {
    expect(applyOpeningFilter("blunder", true)).toBe("blunder");
    expect(applyOpeningFilter("inaccuracy", true)).toBe("inaccuracy");
    expect(applyOpeningFilter("mistake", true)).toBe("mistake");
    expect(applyOpeningFilter("miss", true)).toBe("miss");
    expect(applyOpeningFilter("forced", true)).toBe("forced");
  });

  it("leaves classifications unchanged after the opening phase", () => {
    expect(applyOpeningFilter("best", false)).toBe("best");
    expect(applyOpeningFilter("great", false)).toBe("great");
    expect(applyOpeningFilter("brilliant", false)).toBe("brilliant");
  });
});
