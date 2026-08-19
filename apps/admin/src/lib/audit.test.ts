import { describe, expect, it } from "vitest";
import type { AuditLogEntry } from "@rimalis/types";
import { actorName, auditSentence, describeAction, targetHref, targetName } from "./audit";

const entry = (over: Partial<AuditLogEntry> = {}): AuditLogEntry => ({
  id: "1",
  actorId: "a",
  action: "vendor.suspended",
  targetType: "VENDOR",
  targetId: "v1",
  reason: null,
  metadata: null,
  createdAt: "2026-08-18T20:00:00.000Z",
  actor: {
    id: "a",
    email: "admin@marketplace.ng",
    firstName: "Platform",
    lastName: "Admin",
    role: "ADMIN",
  },
  ...over,
});

/**
 * The fallback is the whole reason this module is tested.
 *
 * `AuditLog.action` is a String column, NOT a Postgres enum, specifically so the
 * API can add an audited action without a migration. So this map WILL be incomplete
 * at some point, and an unrecognised action must still render a truthful sentence
 * rather than a blank cell or the word "undefined".
 */
describe("describeAction", () => {
  it("uses the written phrase for a known action", () => {
    expect(describeAction("vendor.suspended")).toBe("suspended the vendor");
  });

  it("derives a legible phrase for an action it has never seen", () => {
    // The API's convention is <entity>.<past-tense verb>, so the verb is the
    // second half. A new action ships and appears here immediately.
    expect(describeAction("refund.issued")).toBe("issued the refund");
    expect(describeAction("payout.retried")).toBe("retried the payout");
  });

  it("turns underscores into spaces in a derived phrase", () => {
    expect(describeAction("invoice.marked_paid")).toBe("marked paid the invoice");
  });

  it("shows an undotted action verbatim rather than mangling it", () => {
    // A truthful odd string beats a confident wrong sentence.
    expect(describeAction("somethinghappened")).toBe("somethinghappened");
  });

  it("never returns an empty string, whatever it is handed", () => {
    // An empty phrase renders a row as the actor's name and nothing else, which
    // reads as a broken row rather than an unknown one.
    for (const action of ["", "   ", ".", "a.", ".b", "x.y.z", "__"]) {
      expect(describeAction(action).length).toBeGreaterThan(0);
    }
  });

  it("degrades to the only certain statement for a blank action", () => {
    expect(describeAction("")).toBe("made a change");
  });

  it("uses the verb alone when there is no entity half", () => {
    expect(describeAction(".issued")).toBe("issued");
  });
});

describe("actorName", () => {
  it("prefers the name", () => {
    expect(actorName(entry())).toBe("Platform Admin");
  });

  it("falls back to the email, then to a short id", () => {
    const noName = entry({
      actor: { ...entry().actor, firstName: "", lastName: "" },
    });
    expect(actorName(noName)).toBe("admin@marketplace.ng");

    const anonymous = entry({
      actor: { ...entry().actor, firstName: "", lastName: "", email: "", id: "abcdef1234" },
    });
    expect(actorName(anonymous)).toBe("abcdef12");
  });
});

describe("targetName", () => {
  it("reads a human label out of the metadata when there is one", () => {
    expect(targetName(entry({ metadata: { storeName: "Kano Deals" } }))).toBe(
      "Kano Deals",
    );
  });

  it("falls back to the target TYPE, never to a raw uuid", () => {
    // A bare uuid mid-sentence reads as a rendering failure, and the id is already
    // on the row.
    expect(targetName(entry({ metadata: null }))).toBe("a vendor");
  });

  it("survives a metadata blob of an unexpected shape", () => {
    // `metadata` is `unknown` by design — the API promises nothing about it.
    for (const metadata of [42, "text", [], { storeName: 5 }, { storeName: "  " }]) {
      expect(() => targetName(entry({ metadata }))).not.toThrow();
    }
    expect(targetName(entry({ metadata: [] }))).toBe("a vendor");
  });
});

describe("auditSentence", () => {
  it("reads as a sentence", () => {
    expect(auditSentence(entry({ metadata: { storeName: "Kano Deals" } }))).toBe(
      "Platform Admin suspended the vendor Kano Deals",
    );
  });

  it("still reads as a sentence for an unknown action and no metadata", () => {
    expect(
      auditSentence(entry({ action: "refund.issued", targetType: "ORDER" })),
    ).toBe("Platform Admin issued the refund an order");
  });
});

describe("targetHref", () => {
  it("links the five known target types", () => {
    expect(targetHref(entry({ targetType: "USER", targetId: "u" }))).toBe("/users/u");
    expect(targetHref(entry({ targetType: "PRODUCT", targetId: "p" }))).toBe(
      "/products/p",
    );
    expect(targetHref(entry({ targetType: "STOCK_PURCHASE", targetId: "s" }))).toBe(
      "/stock-purchases/s",
    );
  });

  it("returns undefined for a type this app has no screen for", () => {
    expect(targetHref(entry({ targetType: "INVOICE" }))).toBeUndefined();
  });
});
