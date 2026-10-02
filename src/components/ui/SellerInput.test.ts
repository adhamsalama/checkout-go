import { describe, expect, it } from "vitest";
import { matchSellers } from "./SellerInput";

describe("matchSellers", () => {
  const sellers = ["Uber", "Carrefour", "Super market", "Spinneys", "سوبر ماركت"];
  it("matches anywhere, case-insensitively, prefix matches first", () => {
    expect(matchSellers(sellers, "s")).toEqual(["Super market", "Spinneys"]);
    expect(matchSellers(sellers, "re")).toEqual(["Carrefour"]);
    expect(matchSellers(sellers, "UB")).toEqual(["Uber"]);
    expect(matchSellers(sellers, "سوبر")).toEqual(["سوبر ماركت"]);
  });
  it("hides the list when empty or already an exact match", () => {
    expect(matchSellers(sellers, "  ")).toEqual([]);
    expect(matchSellers(sellers, "Uber")).toEqual([]);
  });
});
