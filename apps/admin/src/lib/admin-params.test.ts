import { describe, expect, it } from "vitest";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "./admin-params";

/**
 * These are the two mistakes that reach the API as a 400 rather than as a
 * sensible default — see the module header. Both are one character wide and
 * neither is visible in review, so they are pinned here.
 */
describe("pageParam", () => {
  it("defaults to 1 when absent", () => {
    expect(pageParam(undefined)).toBe(1);
  });

  it("never produces NaN, which would travel to the API as the string 'NaN'", () => {
    expect(pageParam("abc")).toBe(1);
    expect(pageParam("")).toBe(1);
    expect(pageParam("1.5.2")).toBe(1);
  });

  it("floors at 1, because the API rejects 0 and negatives", () => {
    expect(pageParam("0")).toBe(1);
    expect(pageParam("-3")).toBe(1);
  });

  it("does not clamp high pages — an empty page is the honest answer", () => {
    expect(pageParam("999")).toBe(999);
  });

  it("truncates a decimal rather than rejecting it", () => {
    expect(pageParam("3.7")).toBe(3);
  });

  it("takes the first of a repeated param", () => {
    expect(pageParam(["2", "5"])).toBe(2);
  });
});

describe("optional", () => {
  it("turns absent and blank into undefined, not an empty string", () => {
    // The distinction matters: buildQuery drops undefined, and the API 400s on
    // `?status=`. A GET form submits every untouched input as "".
    expect(optional(undefined)).toBeUndefined();
    expect(optional("")).toBeUndefined();
    expect(optional("   ")).toBeUndefined();
  });

  it("trims a real value", () => {
    expect(optional("  lagos ")).toBe("lagos");
  });
});

describe("oneOf", () => {
  const STATUSES = ["PENDING", "APPROVED"] as const;

  it("passes a known value through", () => {
    expect(oneOf("APPROVED", STATUSES)).toBe("APPROVED");
  });

  it("treats a hand-mangled value as no filter rather than a 400", () => {
    expect(oneOf("APROVED", STATUSES)).toBeUndefined();
    expect(oneOf("approved", STATUSES)).toBeUndefined();
  });
});

describe("hrefForPage", () => {
  it("omits page=1 so the first page has one canonical URL", () => {
    expect(hrefForPage("/vendors", { status: "PENDING" }, 1)).toBe(
      "/vendors?status=PENDING",
    );
  });

  it("keeps every other filter when paging", () => {
    expect(hrefForPage("/vendors", { status: "PENDING", search: "kano" }, 3)).toBe(
      "/vendors?status=PENDING&search=kano&page=3",
    );
  });

  it("drops empty filters and any incoming page", () => {
    expect(hrefForPage("/users", { role: undefined, search: "", page: "7" }, 2)).toBe(
      "/users?page=2",
    );
  });

  it("returns the bare path when there is nothing to add", () => {
    expect(hrefForPage("/orders", {}, 1)).toBe("/orders");
  });
});

describe("emptyCopy", () => {
  const base = { noun: "vendors", genuinelyEmpty: "Vendors appear once someone applies." };

  it("says the page is past the end when rows exist elsewhere", () => {
    // The bug this exists for: `?page=999` on a populated list used to announce
    // that the platform had no vendors.
    const copy = emptyCopy({ ...base, filtered: false, total: 12, page: 999 });
    expect(copy.title).toBe("Page 999 is past the end");
    expect(copy.body).toContain("12 matching vendors");
  });

  it("singularises when exactly one row matches", () => {
    const copy = emptyCopy({ ...base, filtered: false, total: 1, page: 4 });
    expect(copy.body).toContain("There is 1 matching vendor,");
  });

  it("offers to clear filters when filters are what excluded everything", () => {
    const copy = emptyCopy({ ...base, filtered: true, total: 0, page: 1 });
    expect(copy.title).toBe("No vendors match");
    expect(copy.body).toContain("Clear them");
  });

  it("explains how rows get created when there are genuinely none", () => {
    const copy = emptyCopy({ ...base, filtered: false, total: 0, page: 1 });
    expect(copy.title).toBe("No vendors yet");
    expect(copy.body).toBe(base.genuinelyEmpty);
  });

  it("prefers the filter message over past-the-end on page 1", () => {
    const copy = emptyCopy({ ...base, filtered: true, total: 0, page: 1 });
    expect(copy.title).toBe("No vendors match");
  });
});
