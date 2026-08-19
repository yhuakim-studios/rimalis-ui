import { describe, expect, it } from "vitest";
import type { ApiError } from "@rimalis/api-client";
import { isMissing } from "./errors";

const http = (status: number, code?: string): ApiError => ({
  kind: "http",
  status,
  message: "x",
  ...(code !== undefined ? { code } : {}),
});

describe("isMissing", () => {
  it("treats a 404 as missing", () => {
    expect(isMissing(http(404))).toBe(true);
  });

  it("treats a 400 as missing, because a malformed id cannot name a real row", () => {
    // The bug: `/vendors/not-a-uuid` is a 400 from the API's Zod param schema,
    // and used to render "Couldn't load this vendor — Validation failed", which
    // invites a retry of a URL that will never work.
    expect(isMissing(http(400))).toBe(true);
  });

  it("does NOT treat a transport failure as missing", () => {
    // The distinction ErrorState exists to protect: an admin told a vendor does
    // not exist stops looking for it. `status: 0` is what the client uses when
    // there was no response at all — and note that a `malformed` kind CAN carry a
    // real status (an HTML error page behind a 404), which is exactly why this
    // branches on `kind` first rather than on the number.
    expect(isMissing({ kind: "network", status: 0, message: "down" })).toBe(false);
    expect(isMissing({ kind: "timeout", status: 0, message: "slow" })).toBe(false);
    expect(isMissing({ kind: "malformed", status: 404, message: "html" })).toBe(false);
  });

  it("does NOT treat a 5xx, 401 or 403 as missing", () => {
    for (const status of [500, 502, 503, 401, 403]) {
      expect(isMissing(http(status))).toBe(false);
    }
  });
});
