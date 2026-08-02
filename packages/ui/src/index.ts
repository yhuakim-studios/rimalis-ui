/**
 * Shared UI primitives.
 *
 * **INTENTIONALLY EMPTY, and it should stay that way for now.**
 *
 * The plan is explicit about this and it is worth restating where someone will
 * actually read it: extracting shared components before one real app exists
 * produces the wrong abstractions. You end up with a `<Button>` shaped by the
 * first screen anyone happened to build, and then three apps bend around it.
 *
 * Populate this AFTER the marketplace is built end-to-end (Part C), by pulling
 * out the components that turned out to be genuinely shared — not the ones that
 * looked like they would be.
 *
 * The package exists now only so the workspace graph, build order and Turbo
 * caching are proven with a real dependency in place.
 */

export {};
