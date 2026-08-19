import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { NextConfig } from "next";
import { parseBuildEnv } from "./src/lib/env.schema";

/*
 * ⚠️ NEVER RUN `next build` WHILE `next dev` IS SERVING THIS APP.
 *
 * They share `.next`, and they are not compatible tenants. The dev server keeps
 * its chunk graph under `.next/dev` but resolves against manifests and
 * `.next/static` that a production build overwrites wholesale. It does not
 * notice; it keeps serving and starts throwing resolution errors for packages
 * that are installed and perfectly resolvable on disk.
 *
 * The marketplace lost several hours to this. It presented as
 * `Error: Cannot find module 'lucide-react'` on a 500, which reads as a
 * dependency problem — and the package was installed, in the lockfile, symlinked
 * correctly and compiling fine in the production build the whole time. The
 * timestamps gave it away: `.next/BUILD_ID` was newer than the dev server's own
 * start time.
 *
 * Stop dev, `rm -rf .next`, build, then restart dev. Wiping `.next` is also the
 * fix once the two have already collided.
 */

/**
 * The monorepo root — the directory holding `pnpm-workspace.yaml`.
 *
 * Walks up from the working directory. Falls back to the working directory if
 * the marker is never found, which is the right failure: Turbopack then infers a
 * root as it did before, rather than being pinned to something wrong.
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
 * `parseBuildEnv`, NOT `parseEnv`: the full contract includes `SESSION_SECRET`,
 * which a Cloudflare build container does not have and does not need — it is a
 * Worker secret injected at request time. Demanding it here fails every Workers
 * Build. Values that ARE present are still fully validated, so a malformed local
 * `.env.local` still fails the build. See env.schema.ts.
 */
parseBuildEnv(process.env);

const nextConfig: NextConfig = {
  reactStrictMode: true,

  turbopack: {
    // Pin the workspace root. Turbopack infers it from lockfiles, and on this
    // machine it inferred `/Users/yhuakim` — from a stray `package-lock.json` in
    // the home directory, which outranked this repo's own `pnpm-workspace.yaml`.
    //
    // Not cosmetic: the inferred root anchors module resolution and every path in
    // the build output, so with the wrong one, error messages name files relative
    // to the home directory. It must be the MONOREPO root, not this app —
    // `packages/types` and `packages/api-client` are outside the app directory,
    // and Turbopack will not compile files outside its root.
    root: workspaceRoot(),
  },

  // Workspace packages ship compiled JS + .d.ts from their own `tsc` build, so
  // Next does NOT need to transpile them. If a package later ships raw TS or
  // JSX, add it to `transpilePackages` here rather than changing how it builds.

  // ⚠️ NOTE (Cloudflare): do NOT add a `middleware.ts`, and do not "fix" auth by
  // moving the guard into one.
  //
  // The scaffold this app replaced said middleware auth redirects "work fine on
  // the edge runtime". They do not, and the failure is invisible until
  // production: Next INLINES referenced env vars into edge code at BUILD time,
  // while `SESSION_SECRET` is a Cloudflare Worker secret injected at REQUEST
  // time and absent from the build container by design. It would be baked in as
  // `undefined`, the build would stay green, and every admin session would fail
  // to decrypt in production only.
  //
  // `runtime: "nodejs"` middleware is not the escape hatch either — it is
  // unsupported by the OpenNext Cloudflare adapter.
  //
  // The guard is `requireAdmin()` in src/lib/auth.ts, called by every page; the
  // refresh is the route handler at src/app/api/session/refresh. See the header
  // of src/lib/session.ts.
  images: {
    // `next/image` optimisation on Workers routes through Cloudflare Images, a
    // separately billed product — it is NOT free-by-default the way it is on
    // Vercel. Product images live in Supabase Storage, so the cheapest correct
    // option is to serve those URLs directly and skip optimisation entirely.
    unoptimized: true,

    // Declared even though `unoptimized` makes Next skip the check today, so
    // flipping it back off is a one-line change rather than a one-line change
    // plus a debugging session over `400 url parameter is not allowed`. The
    // wildcard subdomain is deliberate: the host carries the Supabase *project
    // ref*, which differs per environment.
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
