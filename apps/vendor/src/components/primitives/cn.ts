/**
 * Joins class names, dropping falsy entries.
 *
 * Not `clsx`, and not `tailwind-merge`. `clsx` is 200 bytes of a function that is
 * four lines here; `tailwind-merge` is ~7KB gzipped and solves conflict
 * resolution (`p-4` beating an inherited `p-2`), which is a problem this codebase
 * does not have — variants below are defined as complete, mutually exclusive
 * class strings rather than as overrides layered on a base.
 *
 * That is a constraint on how variants are written, not a limitation: if a
 * variant needs to *override* a base class, the base class should not have been
 * there. Overriding order in a template string is invisible in review and
 * depends on Tailwind's emitted CSS order rather than on the string, which is why
 * `tailwind-merge` exists in the first place.
 */
export const cn = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");
