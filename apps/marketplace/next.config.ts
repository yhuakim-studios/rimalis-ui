import type { NextConfig } from "next";
import { parseEnv } from "./src/lib/env.schema";

/*
 * Fail the BUILD on a bad environment, not the first request that needs it.
 *
 * This is the whole reason `env.schema.ts` is a separate module from `env.ts`:
 * `env.ts` is `server-only` and cannot be imported here, and here is the only
 * place in the app that runs before a single page is compiled.
 *
 * Without it, a missing `SESSION_SECRET` deploys perfectly green and then throws
 * inside `jose` on the first login attempt in production — a 500 with a message
 * about key length, arriving hours after the deploy, from a code path no local
 * test exercised because `.env.local` had the value all along.
 *
 * Next loads `.env`, `.env.local` and friends before evaluating this file, so
 * `process.env` here is the same environment the app will see. It is NOT the
 * same as the deployed Worker's environment, though — Cloudflare secrets are
 * set with `wrangler secret put` and are not visible to a local build. So this
 * catches "the template is incomplete", which is the common mistake; it cannot
 * catch "the secret was never uploaded". Guard that with a deploy checklist.
 */
parseEnv(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Workspace packages ship compiled JS + .d.ts from their own `tsc` build, so
  // Next does NOT need to transpile them. If a package later ships raw TS or
  // JSX, add it to `transpilePackages` here rather than changing how it builds.

  // NOTE (Cloudflare): do NOT add a `middleware.ts` with `runtime: "nodejs"`.
  // Node Middleware is unsupported by the OpenNext Cloudflare adapter. Our
  // middleware need is auth redirects, which work fine on the edge runtime.
  images: {
    // `next/image` optimisation on Workers routes through Cloudflare Images, a
    // separately billed product — it is NOT free-by-default the way it is on
    // Vercel. Product images live in Supabase Storage, so the cheapest correct
    // option is to serve those URLs directly and skip optimisation entirely.
    // Revisit in Phase 8: the alternative is a custom loader pointing at
    // Supabase's own transform endpoint.
    unoptimized: true,

    // Declared even though `unoptimized` makes Next skip this check today, so
    // that flipping `unoptimized` back off is a one-line change rather than a
    // one-line change plus a debugging session over `400 url parameter is not
    // allowed`. The wildcard subdomain is deliberate: the host carries the
    // Supabase *project ref*, which differs per environment, and hardcoding
    // this repo's would break every other one — the same mistake the seed used
    // to make with its hardcoded image URLs.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
