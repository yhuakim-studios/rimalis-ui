import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * OpenNext adapter config — how the Next build is turned into a Worker.
 *
 * Deliberately bare. Incremental cache (for ISR) needs an R2 or KV binding;
 * the binding is declared in wrangler.jsonc so the plumbing exists, but no
 * cache handler is wired here because nothing in the scaffold uses ISR yet.
 * Enabling one now would be config for a feature that does not exist.
 *
 * When Part C adds ISR to marketplace product pages, import
 * `r2IncrementalCache` from `@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache`
 * and pass it as `incrementalCache` below.
 */
export default defineCloudflareConfig({});
