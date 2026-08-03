/**
 * The typed client for digistore-api.
 *
 * **This is the reason the three apps live in one repository.** Three separate
 * repos would each carry their own copy of the JWT refresh/rotation logic, and
 * for a solo maintainer that is where multi-repo setups rot — the copies drift,
 * and the one that drifts is the one you weren't looking at. See ADR-0001.
 *
 * EMPTY ON PURPOSE. No endpoint methods yet: this is Part B (scaffold), and the
 * client is Part C, built auth-first then marketplace-reads. What exists today
 * is the config type and the base-URL helper, which is enough to prove the
 * package builds and is importable from all three apps.
 *
 * ---
 *
 * ## Read ADR-0003 before adding auth calls here
 *
 * The browser never calls this API directly for auth. Each Next.js app is a
 * **BFF**: the browser posts to that app's own route handler, which calls
 * digistore-api server-to-server and sets an `httpOnly; Secure;
 * SameSite=Strict` cookie scoped to **that one subdomain**.
 *
 * Two consequences for whoever writes the real client:
 *
 * - This module will run **server-side**, inside route handlers and server
 *   components. Do not reach for `localStorage`, `document.cookie`, or
 *   `window` — none of them exist where this code runs, and the whole point of
 *   the BFF is that the token never reaches anywhere they could read it.
 * - **Never scope the session cookie to `.<domain>`.** A parent-domain cookie
 *   is readable by every subdomain and silently undoes the marketplace /
 *   vendor / admin session separation that three subdomains exist to provide.
 *   This is the single easiest way to quietly break the security model.
 */

import type { ApiResponse } from "@digistore/types";

export interface ApiClientConfig {
  /**
   * Origin of digistore-api, no trailing slash — e.g. `https://api.example.com`.
   * Comes from `NEXT_PUBLIC_API_URL`.
   */
  baseUrl: string;
  /**
   * Path prefix every route mounts under. Comes from `API_BASE_PATH`, and must
   * match `BASE_PATH` on the API, which defaults to `/api/v1`.
   *
   * It is a variable rather than a constant precisely so the two cannot drift:
   * the API interpolates its own `BASE_PATH` into every mount, and a hardcoded
   * `/api/v1` here would break the day that changes.
   */
  basePath: string;
}

/**
 * Joins config into a request URL, tolerating a stray slash on either side.
 *
 * Trivial, and here mainly so the package has one real exported function to
 * typecheck, build and import — an entirely empty module is not proof that the
 * build plumbing works.
 */
export const buildUrl = (config: ApiClientConfig, path: string): string => {
  const origin = config.baseUrl.replace(/\/+$/, "");
  const prefix = config.basePath.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${prefix}${suffix}`;
};

/** Re-exported so consumers need only one import for the common case. */
export type { ApiResponse };

/**
 * The Result union every endpoint method will return. Landed in Phase 0 rather
 * than Phase 1 because it is a pure type module with no dependencies, and
 * writing it in the app first would have meant moving it a phase later for no
 * benefit. Nothing consumes it yet — `http.ts` is Phase 1.
 */
export * from "./result";
