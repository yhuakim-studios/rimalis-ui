import { describe, expect, it } from "vitest";
import { parseBuildEnv, parseEnv } from "./env.schema";

/**
 * The build-vs-runtime split is the whole point of `env.schema.ts` being separate
 * from `env.ts`, and it is easy to "simplify" back into one schema — which fails
 * every Cloudflare build, because `SESSION_SECRET` is a Worker secret injected at
 * request time and absent from the build container by design.
 *
 * These pin the asymmetry: absence is tolerated at build time, a MALFORMED value
 * never is, and the runtime contract still demands it.
 */
const valid = {
  NEXT_PUBLIC_API_URL: "http://localhost:4000",
  API_BASE_PATH: "/api/v1",
};

describe("parseBuildEnv", () => {
  it("tolerates an absent SESSION_SECRET — a build container legitimately has none", () => {
    expect(() => parseBuildEnv(valid)).not.toThrow();
  });

  it("still rejects a malformed SESSION_SECRET, because only absence is excused", () => {
    expect(() => parseBuildEnv({ ...valid, SESSION_SECRET: "too-short" })).toThrow(
      /32 bytes/,
    );
  });

  it("names the app and the variable, one line each, rather than dumping a Zod blob", () => {
    // A build that fails with JSON gets skimmed, and the skimmer concludes the
    // build is broken rather than that their .env.local is incomplete.
    expect(() => parseBuildEnv({})).toThrow(/@rimalis\/admin/);
    expect(() => parseBuildEnv({})).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it("rejects a trailing slash on the origin, which would double up in buildUrl", () => {
    expect(() =>
      parseBuildEnv({ ...valid, NEXT_PUBLIC_API_URL: "http://localhost:4000/" }),
    ).toThrow(/slash/);
  });

  it("rejects an origin carrying a path", () => {
    expect(() =>
      parseBuildEnv({ ...valid, NEXT_PUBLIC_API_URL: "http://localhost:4000/api" }),
    ).toThrow(/absolute http/);
  });

  it("defaults API_BASE_PATH so only the API url is mandatory", () => {
    expect(parseBuildEnv({ NEXT_PUBLIC_API_URL: "https://api.example.com" }).API_BASE_PATH).toBe(
      "/api/v1",
    );
  });
});

describe("parseEnv", () => {
  it("DOES require SESSION_SECRET — this is the runtime contract", () => {
    expect(() => parseEnv(valid)).toThrow(/SESSION_SECRET/);
  });

  it("accepts a real 43-character base64url key", () => {
    // 32 bytes of base64url, no padding — what `openssl rand -base64url 32` emits.
    const key = "A".repeat(43);
    expect(() => parseEnv({ ...valid, SESSION_SECRET: key })).not.toThrow();
  });

  it("rejects base64 padding, which is not base64url", () => {
    expect(() => parseEnv({ ...valid, SESSION_SECRET: `${"A".repeat(42)}=` })).toThrow(
      /base64url/,
    );
  });
});
