import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";
import { parseBuildEnv } from "./src/lib/env.schema";

/*
 * ⚠️ NEVER RUN `next build` WHILE `next dev` IS SERVING THIS APP.
 *
 * They share `.next`, and they are not compatible tenants. `next dev` keeps its
 * chunk graph under `.next/dev` but resolves against manifests and `.next/static`
 * that a production build overwrites wholesale. The dev server does not notice;
 * it keeps serving and starts throwing resolution errors for packages that are
 * installed and perfectly resolvable on disk.
 *
 * This is written down because the symptom points nowhere near the cause. It
 * presented as `Error: Cannot find module 'lucide-react'` on a 500 from `/`,
 * which reads as a dependency problem — and `lucide-react` was installed, in the
 * lockfile, symlinked correctly, and compiling fine in the production build the
 * whole time. Several hours went into resolution, tsconfig and Turbopack theories
 * before the timestamps gave it away: `.next/BUILD_ID` was newer than the dev
 * server's own start time.
 *
 * If you need both at once, give the build its own directory:
 *
 *     next build --experimental-build-mode … # or
 *     NEXT_DIST_DIR=.next-build next build   # with `distDir` read from env
 *
 * Otherwise: stop dev, `rm -rf .next`, build, then restart dev. Wiping `.next`
 * is also the fix once the two have already collided — nothing short of that
 * clears the mixed state.
 */

/**
 * The monorepo root — the directory holding `pnpm-workspace.yaml`.
 *
 * Walks up from the working directory. Falls back to the working directory if the
 * marker is never found, which is the right failure: Turbopack then infers a root
 * as it did before, rather than being pinned to something wrong.
 */
function workspaceRoot(): string {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
}

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
 *
 * `parseBuildEnv`, NOT `parseEnv`: the full contract includes `SESSION_SECRET`
 * and `APP_ORIGIN`, which a Cloudflare build container does not have and does
 * not need — they are a Worker secret and a `vars` entry, both injected at
 * request time. Demanding them here failed every Workers Build with
 * `SESSION_SECRET: missing`. Values that ARE present are still fully validated,
 * so a malformed local `.env.local` still fails the build. See env.schema.ts.
 */
parseBuildEnv(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  turbopack: {
    // Pin the workspace root. Turbopack infers it from lockfiles, and on this
    // machine it inferred `/Users/yhuakim` — from a stray `package-lock.json` in
    // the home directory, which outranked this repo's own `pnpm-workspace.yaml`.
    //
    // That is not cosmetic. The inferred root anchors module resolution and every
    // path in the build output, so with the wrong one, error messages name files
    // relative to the home directory. It surfaced as a warning that was easy to
    // skim past, alongside 38 resolution errors that had a different cause — two
    // separate problems arriving together.
    //
    // It must be the MONOREPO root, not this app: `packages/types` and
    // `packages/api-client` are outside the app directory, and Turbopack will not
    // compile files outside its root.
    //
    // Found by walking up for `pnpm-workspace.yaml` rather than by a literal
    // `"../.."`, because this file has no reliable notion of its own location:
    // `import.meta.dirname` inside a compiled Next config resolved to
    // `src/app`, which set the root to a directory with no `next` package in it
    // and produced a *different* confusing error. `process.cwd()` is dependable
    // (Turbo and pnpm both run the script from the package directory) and the
    // walk makes the depth irrelevant.
    root: workspaceRoot(),
  },

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
