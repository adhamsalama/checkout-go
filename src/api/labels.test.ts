import { beforeEach, describe, expect, it } from "vitest";
import { setDb } from "../db";
import { createNodeDb } from "../test/nodeDb";
import * as budgets from "./budgets";
import { listSellerCounts, renameSeller } from "./sellers";
import { listTagCounts, renameTag } from "./tags";
import * as tx from "./transactions";

beforeEach(() => setDb(createNodeDb()));

describe("tags", () => {
  it("renames a tag on every expense and tag budget", async () => {
    const a = await tx.createExpense({ name: "a", price: 1, tags: ["مواصلا", "food"] });
    const b = await tx.createExpense({ name: "b", price: 1, tags: ["مواصلا"] });
    const c = await tx.createExpense({ name: "c", price: 1, tags: ["other"] });
    await budgets.createTaggedBudget({ name: "Transport", value: 100, tag: "مواصلا" });

    expect(await renameTag("مواصلا", " مواصلات ")).toBe(2);
    expect((await tx.getTransaction(a.id))!.tags).toEqual(["مواصلات", "food"]);
    expect((await tx.getTransaction(b.id))!.tags).toEqual(["مواصلات"]);
    expect((await tx.getTransaction(c.id))!.tags).toEqual(["other"]);
    expect((await budgets.getTaggedBudgets()).map((t) => t.tag)).toEqual(["مواصلات"]);
    expect(await listTagCounts()).toEqual([
      { name: "مواصلات", count: 2 },
      { name: "food", count: 1 },
      { name: "other", count: 1 },
    ]);
  });

  it("merges into an existing tag without duplicates", async () => {
    const a = await tx.createExpense({ name: "a", price: 1, tags: ["taxi", "transport"] });
    await renameTag("taxi", "transport");
    expect((await tx.getTransaction(a.id))!.tags).toEqual(["transport"]);
    await expect(renameTag("transport", "  ")).rejects.toThrow("tag name");
  });
});

describe("sellers", () => {
  it("renames and merges sellers on every transaction", async () => {
    const a = await tx.createExpense({ name: "a", price: 1, sellerName: "Carrefour" });
    await tx.createExpense({ name: "b", price: 1, sellerName: "Carrefour" });
    const c = await tx.createExpense({ name: "c", price: 1, sellerName: "carrefour" });
    await tx.createExpense({ name: "d", price: 1 });
    expect(await listSellerCounts()).toEqual([
      { name: "Carrefour", count: 2 },
      { name: "carrefour", count: 1 },
    ]);
    expect(await renameSeller("carrefour", " Carrefour ")).toBe(1);
    expect((await tx.getTransaction(c.id))!.sellerName).toBe("Carrefour");
    expect((await tx.getTransaction(a.id))!.sellerName).toBe("Carrefour");
    expect(await listSellerCounts()).toEqual([{ name: "Carrefour", count: 3 }]);
    await expect(renameSeller("Carrefour", "")).rejects.toThrow("seller name");
  });
});
