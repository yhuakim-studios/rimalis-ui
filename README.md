# digistore-uis

The three Digistore frontends, in one pnpm + Turborepo workspace.

| App | Package | Dev port | Deploys to | Worker |
| --- | --- | --- | --- | --- |
| [apps/marketplace](apps/marketplace) | `@digistore/marketplace` | 3000 | `shop.example.com` | `digistore-shop` |
| [apps/vendor](apps/vendor) | `@digistore/vendor` | 3001 | `vendor.example.com` | `digistore-vendor` |
| [apps/admin](apps/admin) | `@digistore/admin` | 3002 | `admin.example.com` | `digistore-admin` |

> **`example.com` is a placeholder.** Search for it across `apps/*/wrangler.jsonc`
> and `apps/*/.env.example` when the real domain is registered.

The API ([`../digistore-api`](../digistore-api)) is **a separate repository with
its own Railway deploy** and is not part of this workspace. Per
[ADR-0001](../docs/decisions/0001-repo-and-deploy-topology.md), the frontends
share a repo and the API does not.

## Status: scaffold only

**This is Part B — buildable empty shells.** No API calls, no auth, no
features. The point is to prove the workspace, the shared config and the
Cloudflare deploy path all work *before* any of it is load-bearing. Features
are Part C.

Three things are empty **on purpose**, and the reason is written at the top of
each file:

- [`packages/ui`](packages/ui/src/index.ts) — extracting shared components
  before one real app exists produces the wrong abstractions. Populate it after
  the marketplace is built end to end, from what turned out to be shared.
- [`packages/types`](packages/types/src/index.ts) — only the response envelope
  and pagination shape, which are the stable part of the contract.
- [`packages/api-client`](packages/api-client/src/index.ts) — config type and a
  URL helper. This package existing is the reason the three apps share a repo:
  three copies of JWT refresh logic is where a multi-repo setup rots.

## Commands

```bash
pnpm install
pnpm dev          # all three, ports 3000 / 3001 / 3002
pnpm build        # packages then apps, in dependency order
pnpm typecheck
pnpm --filter @digistore/marketplace dev    # just one app
```

Cloudflare, per app:

```bash
cd apps/marketplace
pnpm cf:build     # next build -> OpenNext -> .open-next/worker.js
pnpm preview      # build + run under workerd locally  (see caveat below)
pnpm deploy       # build + wrangler deploy            (needs `wrangler login`)
```

## Environment

Copy each app's `.env.example` to `.env.local`. Two variables, both pointing at
the API:

- `NEXT_PUBLIC_API_URL` — origin, no trailing slash. Locally `http://localhost:4000`.
- `API_BASE_PATH` — must match `BASE_PATH` on the API. A variable rather than a
  constant so the two cannot drift.

## Before you write auth: read ADR-0003

Each app is a **BFF**. The browser never calls the API directly for auth — it
posts to that app's own Next.js route handler, which calls the API
server-to-server and sets an `httpOnly` cookie **scoped to that one
subdomain**. This is why the API returns tokens in a JSON body and why that is
safe.

**Never scope a session cookie to `.example.com`.** A parent-domain cookie is
readable by all three apps and silently destroys the session separation that
three subdomains exist to provide. This is the easiest way to quietly break the
security model.

## Deploying (Cloudflare Workers)

Not yet connected — no Cloudflare account is wired up. When you do it:

1. **Create the Worker per app.** From `apps/<app>`, `wrangler login` then
   `pnpm deploy`. Names come from `wrangler.jsonc` (`digistore-shop`, etc.).
2. **Add the custom domain.** Uncomment the `routes` block in that app's
   `wrangler.jsonc` once the zone exists in the account, and replace
   `example.com`.
3. **Connect Workers Builds** to this repo for push-to-deploy. Because it is a
   monorepo, **set the build watch paths per Worker** or every push rebuilds
   and redeploys all three:
   - root directory `apps/<app>`
   - build command `pnpm cf:build`, deploy command `npx wrangler deploy`
   - include paths: `apps/<app>/*`, `packages/*`, and the root lockfile
4. **API CORS is probably not involved.** Under the BFF these apps call the API
   from a server, which sends no `Origin` header and is outside CORS entirely.
   Only add an origin to the API's `CORS_ORIGINS` if a browser genuinely calls
   it directly.

### ⚠️ `pnpm preview` does not run on this machine

`wrangler dev` runs the real Workers runtime (`workerd`) locally, and **workerd
requires macOS 13.5+ — this machine is on 12.6.0**, so it exits with
`Unsupported macOS version` before serving anything.

What was verified instead, and what it does and does not prove:

| | Status |
| --- | --- |
| `next build` for all three | ✅ passes |
| OpenNext → `.open-next/worker.js` for all three | ✅ passes |
| `wrangler deploy --dry-run` — config parse, bundle, bindings | ✅ passes (3.7 MB / 770 KB gzip) |
| Worker actually executing under workerd | ❌ **unverified** |

So the deploy path is verified up to the point of upload, but **nothing has
executed Next.js server code in a Workers runtime yet.** Runtime gaps between
Node and workerd — a Node built-in that is not polyfilled, say — would surface
at this step and have not been ruled out. Options: upgrade macOS, use a Linux
DevContainer, or let Cloudflare's own preview deployments (which build on
Linux) be the first real runtime check.

## Decisions worth knowing

**Next 16, not 15.** The plan assumed 15. `@opennextjs/cloudflare@1.20.2`
declares `next: ">=15.5.21 <16 || >=16.2.11"`, so 16.2.12 is supported — there
was no reason to pin backwards.

**TypeScript 5.9, not 7.** TS 7 (the native port) is out and is what `npm view`
recommends, but it is days old and the Next/Tailwind/eslint plugin ecosystem
has not caught up. A scaffold is the wrong place to absorb that risk. It also
keeps this in step with `digistore-api`, which is on 5.9.3.

**Tailwind v4 has no JS presets.** The plan called for a "tailwind preset"; v4
is CSS-first and `tailwind.config.js` no longer exists. The shared layer is
[`packages/config/tailwind/theme.css`](packages/config/tailwind/theme.css),
imported by each app's `globals.css` after `@import "tailwindcss"`. Same
intent, current mechanism. The plugin also moved to its own package —
`@tailwindcss/postcss`, not `tailwindcss`, in `postcss.config.mjs`.

**`images.unoptimized: true`.** `next/image` optimisation on Workers routes
through Cloudflare Images, which is separately billed — it is not
free-by-default the way it is on Vercel. Product images already live in
Supabase Storage, so serving those URLs directly costs nothing. Revisit in Part
C with a custom loader against Supabase's transform endpoint.

**No `middleware.ts` with `runtime: "nodejs"`.** Node Middleware is unsupported
by the OpenNext Cloudflare adapter. The middleware this project needs is auth
redirects, which the edge runtime handles.

**`next-env.d.ts` is gitignored.** It is generated by `next build`, so
committing it makes the first build in a fresh clone a guaranteed Turbo cache
miss for every app — the file appears on run 1 and changes the input hash on
run 2. Observed, then fixed: `pnpm build` three times in a row now goes
`0 cached` → `4 cached` → `FULL TURBO`.

**`typecheck` depends on `^build`, not `^typecheck`.** Typechecking an app
needs the workspace packages' emitted `.d.ts` files, which only `build`
produces.
