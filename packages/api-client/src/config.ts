/**
 * Where the API is, and how to build a URL for it.
 *
 * Its own module rather than living in `index.ts` so that `http.ts` can import
 * it without importing the barrel — a module importing its own package's
 * `index.ts` is a cycle that works until the day the bundler decides it doesn't.
 */

export interface ApiClientConfig {
  /**
   * Origin of rimalis-api, no trailing slash — e.g. `https://api.example.com`.
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

/** Joins config into a request URL, tolerating a stray slash on either side. */
export const buildUrl = (config: ApiClientConfig, path: string): string => {
  const origin = config.baseUrl.replace(/\/+$/, "");
  const prefix = config.basePath.replace(/\/+$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${prefix}${suffix}`;
};
