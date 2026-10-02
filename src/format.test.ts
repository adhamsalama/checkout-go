import { describe, expect, it } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("uses a 12-hour clock", () => {
    expect(formatTime("2025-02-03T00:05:00")).toBe("12:05 AM");
    expect(formatTime("2025-02-03T09:30:00")).toBe("9:30 AM");
    expect(formatTime("2025-02-03T12:00:00")).toBe("12:00 PM");
    expect(formatTime("2025-02-03T23:59:59")).toBe("11:59 PM");
  });
});
