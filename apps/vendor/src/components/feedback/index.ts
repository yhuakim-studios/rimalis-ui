/**
 * The three states, as three components.
 *
 * The design system requires empty, loading and error states on every surface,
 * and they are three genuinely different mechanisms. Conflating them is the most
 * common failure in this area, so the mapping is written down once here:
 *
 *   | state     | trigger                        | mechanism                          |
 *   |-----------|--------------------------------|------------------------------------|
 *   | empty     | valid response, zero rows      | <EmptyState>                       |
 *   | loading   | pending fetch                  | loading.tsx + <Suspense> + Skeleton|
 *   | not found | 404 (or 400) on one resource   | notFound() → not-found.tsx         |
 *   | error     | network / timeout / 5xx / HTML | <ErrorState> inline, or error.tsx  |
 *
 * The loading state has no component here on purpose: it is a *skeleton in the
 * shape of the real content*, which by definition cannot be generic. Each route's
 * `loading.tsx` composes `<Skeleton>` to match its own layout.
 */

export { EmptyState, type EmptyStateProps } from "./EmptyState";
export { ErrorState, type ErrorStateProps } from "./ErrorState";
/**
 * A fifth state this app has and the storefront does not: **blocked**. The
 * account is fine, the request is fine, and the vendor still may not trade — see
 * `GateScreen` on why that gets four screens rather than one 403.
 */
export { GateScreen, type GateScreenProps } from "./GateScreen";
