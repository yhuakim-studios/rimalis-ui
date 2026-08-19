/**
 * The layout components.
 *
 * ## `Header` and `Footer` are NOT re-exported here, on purpose
 *
 * `Header` is an async Server Component that reads cookies. A barrel that
 * exported it would drag it into the module graph of every Client Component
 * that wanted `Container` — and `error.tsx` is one, so the build failed with
 * "'server-only' cannot be imported from a Client Component module", pointing at
 * `lib/wishlist.ts` five imports away from anything anyone had edited.
 *
 * That is the general hazard with barrels in the App Router: a barrel has one
 * module graph, but its consumers are split across two runtimes. `Container` is
 * shared by both; `Header` is server-only. Keeping the server-only pair out of
 * the barrel means the two cannot be mixed by accident — `app/layout.tsx`
 * imports them from `./Header` directly, which is the only place that should.
 */

export { Container, Section, type ContainerProps } from "./Container";
export { SearchBox } from "./SearchBox";
