/**
 * The environment contract, as a schema — separate from `env.ts` on purpose.
 *
 * `env.ts` is `server-only`, which makes it unimportable from anywhere outside
 * the React server graph. `next.config.ts` is one of those places, and it is
 * also the ONLY place that can turn a missing variable into a failed BUILD
 * rather than a 500 on the first request that happens to need it. So the schema
 * lives here, with no side effects and no imports beyond zod, and both sides
 * use it:
 *
 *   next.config.ts  →  parseEnv(process.env)  at build time  →  build fails
 *   src/lib/env.ts  →  parseEnv(process.env)  at boot        →  module fails
 *
 * Do NOT put `import "server-only"` in this file, and do not read `process.env`
 * at module scope here. Both would break the next.config.ts side, which is the
 * half that catches the mistake early.
 */

import { z } from "zod";

/** `true` for `1`/`true`/`yes`, `false` for absent or anything else. */
const flag = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true" || v === "yes");

/**
 * An absolute origin with no trailing slash and no path.
 *
 * The no-trailing-slash rule is not fussiness: `buildUrl()` in
 * @digistore/api-client strips one, but `${APP_ORIGIN}/checkout/callback` is
 * interpolated raw into the Paystack `callbackUrl`, and `https://x//checkout`
 * is a different path that will not match a route. Reject it here rather than
 * debug it after a real charge.
 */
const origin = z
  .string()
  .min(1)
  .refine((v) => !v.endsWith("/"), { message: "must not end with a slash" })
  .refine(
    (v) => {
      try {
        const url = new URL(v);
        return (
          (url.protocol === "http:" || url.protocol === "https:") &&
          url.pathname === "/" &&
          !url.search &&
          !url.hash
        );
      } catch {
        return false;
      }
    },
    { message: "must be an absolute http(s) origin with no path, e.g. https://shop.example.com" },
  );

/**
 * 32 bytes of entropy, base64url — the key size A256GCM requires.
 *
 * Checked as *decoded byte length* rather than string length because a
 * 43-character string that is not valid base64url would sail past a length
 * check and then fail inside `jose` at the first login, in production, with a
 * message about key length that points nowhere near the .env file.
 *
 * Generate with:  openssl rand -base64url 32
 * (or, on an older openssl:  openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')
 */
const sessionSecret = z
  .string()
  .min(1, "SESSION_SECRET is required — generate one with `openssl rand -base64url 32`")
  .refine((v) => /^[A-Za-z0-9_-]+$/.test(v), {
    message: "must be base64url (A–Z a–z 0–9 - _), with no padding `=`",
  })
  .refine((v) => decodedByteLength(v) === 32, {
    message: "must decode to exactly 32 bytes — `openssl rand -base64url 32` produces 43 characters",
  });

/**
 * Byte length of a base64url string without decoding it.
 *
 * `atob` exists in workerd and in Node ≥16, but this runs inside next.config.ts
 * under whatever loader Next uses, so arithmetic is the portable answer. Every
 * 4 characters carry 3 bytes; a trailing group of 2 carries 1 and of 3 carries 2.
 */
function decodedByteLength(base64url: string): number {
  const groups = Math.floor(base64url.length / 4);
  const remainder = base64url.length % 4;
  const tail = remainder === 0 ? 0 : remainder === 2 ? 1 : remainder === 3 ? 2 : -1;
  return tail < 0 ? -1 : groups * 3 + tail;
}

export const envSchema = z.object({
  /**
   * Origin of digistore-api. `NEXT_PUBLIC_` for historical reasons — see the
   * warning in `env.ts`; nothing in the browser may use it.
   */
  NEXT_PUBLIC_API_URL: origin,

  /** Must match `BASE_PATH` on the API. Leading slash, no trailing slash. */
  API_BASE_PATH: z
    .string()
    .default("/api/v1")
    .refine((v) => v.startsWith("/") && !v.endsWith("/"), {
      message: "must start with `/` and not end with one, e.g. /api/v1",
    }),

  SESSION_SECRET: sessionSecret,

  /**
   * This app's own public origin. Used for the Paystack `callbackUrl` and for
   * absolute URLs in metadata. Cannot be derived from the request: a Worker
   * behind a proxy sees whatever `Host` the proxy sends, and getting this wrong
   * sends a paying customer to the wrong domain.
   */
  APP_ORIGIN: origin,

  /**
   * Serve the catalogue from local fixtures instead of the API. A development
   * escape hatch only — see the `NODE_ENV` guard at the single call site.
   */
  MARKETPLACE_FIXTURES: flag,
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and returns the environment, or throws with every problem listed.
 *
 * The formatting matters more than it looks. Zod's default `ZodError` message
 * is a JSON blob; a build that fails with a JSON blob gets skimmed, and the
 * skimmer concludes the build is broken rather than that their `.env.local` is
 * incomplete. One line per variable, naming the variable, is the difference.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    const detail = issue.code === "invalid_type" && issue.message === "Invalid input: expected string, received undefined"
      ? "missing"
      : issue.message;
    return `  • ${name}: ${detail}`;
  });

  throw new Error(
    [
      "",
      "Invalid environment for @digistore/marketplace:",
      "",
      ...lines,
      "",
      "Copy apps/marketplace/.env.example to apps/marketplace/.env.local and fill it in.",
      "",
    ].join("\n"),
  );
}
