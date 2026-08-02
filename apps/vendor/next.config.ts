import type { NextConfig } from "next";

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
    // Revisit in Part C: the alternative is a custom loader pointing at
    // Supabase's own transform endpoint.
    unoptimized: true,
  },
};

export default nextConfig;
