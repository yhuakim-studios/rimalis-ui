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
 *   next.config.ts  →  parseBuildEnv(process.env)  at build time
 *   src/lib/env.ts  →  parseBuildEnv(process.env)  at boot, + lazy accessors
 *
 * Do NOT put `import "server-only"` in this file, and do not read `process.env`
 * at module scope here. Both would break the next.config.ts side, which is the
 * half that catches the mistake early.
 *
 * ## Deliberately narrower than the marketplace's copy
 *
 * No `APP_ORIGIN`: the vendor app has no Paystack callback to come back to and
 * no OpenGraph cards to build absolute URLs for. It is a signed-in tool behind a
 * login, so an origin it never interpolates would be a variable that can only
 * ever be wrong. No `MARKETPLACE_FIXTURES` either — there is no public catalogue
 * here to serve from fixtures.
 */

import { z } from "zod";

/**
 * An absolute origin with no trailing slash and no path.
 *
 * The no-trailing-slash rule is not fussiness: `buildUrl()` in
 * @rimalis/api-client strips one, but a doubled slash changes a path, and
 * `https://x//api/v1` is not the route you meant. Reject it here rather than
 * debug a 404 that looks like a missing endpoint.
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
    { message: "must be an absolute http(s) origin with no path, e.g. https://vendor.example.com" },
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
 *
 * ⚠️ Use a DIFFERENT secret from the marketplace's. Sharing one would let a
 * cookie minted by one app decrypt in the other, which is precisely the
 * cross-app session bleed that three separate subdomains exist to prevent.
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
   * Origin of rimalis-api. `NEXT_PUBLIC_` for consistency with the other two
   * apps, and just as misleading here — see the warning in `env.ts`. Nothing in
   * the browser may use it.
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
});

export type Env = z.infer<typeof envSchema>;

/**
 * The BUILD-time contract: the same schema, minus the one variable a build has
 * no way to know and no business knowing.
 *
 * `next build` and the deployed Worker do NOT see the same environment. On
 * Cloudflare, `SESSION_SECRET` is a Worker *secret* (`wrangler secret put`),
 * injected into the isolate at request time and absent from the build container.
 * Requiring it here fails every Workers Build, and the only way to satisfy it
 * would be to copy the session key into the build environment as well — which
 * spreads a secret to a second place to answer a question the build was never
 * entitled to ask. The marketplace learned this the expensive way.
 *
 * `NEXT_PUBLIC_API_URL` stays required, because that one genuinely IS a build
 * input: Next inlines `NEXT_PUBLIC_*` into the bundle, so a missing value is
 * baked in permanently and no amount of correct runtime configuration recovers
 * it.
 *
 * Note `.optional()`, not a bypass flag: a value that IS present is still fully
 * validated, so a malformed `SESSION_SECRET` in a local `.env.local` still fails
 * the build. Only *absence* is tolerated, and only absence is what CI has.
 */
export const buildEnvSchema = envSchema.extend({
  SESSION_SECRET: sessionSecret.optional(),
});

export type BuildEnv = z.infer<typeof buildEnvSchema>;

/**
 * Formats a failed parse as one line per variable, or returns the value.
 *
 * The formatting matters more than it looks. Zod's default `ZodError` message is
 * a JSON blob; a build that fails with a JSON blob gets skimmed, and the skimmer
 * concludes the build is broken rather than that their `.env.local` is
 * incomplete. One line per variable, naming the variable, is the difference.
 */
function parse<T extends z.ZodType>(
  schema: T,
  source: Record<string, string | undefined>,
  hint: string[],
): z.infer<T> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;

  const lines = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(root)";
    const detail =
      issue.code === "invalid_type" &&
      issue.message === "Invalid input: expected string, received undefined"
        ? "missing"
        : issue.message;
    return `  • ${name}: ${detail}`;
  });

  throw new Error(
    ["", "Invalid environment for @rimalis/vendor:", "", ...lines, "", ...hint, ""].join("\n"),
  );
}

/** The full contract. Use at RUNTIME, where every variable must be present. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return parse(envSchema, source, [
    "Locally: copy apps/vendor/.env.example to apps/vendor/.env.local and fill it in.",
    "On Cloudflare: `wrangler secret put SESSION_SECRET` from apps/vendor.",
  ]);
}

/**
 * The build-time subset. Use from `next.config.ts` and anywhere that is
 * evaluated while `next build` collects page data.
 */
export function parseBuildEnv(source: Record<string, string | undefined>): BuildEnv {
  return parse(buildEnvSchema, source, [
    "Copy apps/vendor/.env.example to apps/vendor/.env.local and fill it in.",
    "In CI, set NEXT_PUBLIC_API_URL as a build environment variable — it is inlined at build time.",
  ]);
}
