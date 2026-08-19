import { ButtonLink, Input, Select } from "@/components/primitives";
import { SubmitButton } from "@/components/forms";

/**
 * The filter row above every admin list — a plain `<form method="get">`.
 *
 * ## Why a GET form and not client state
 *
 * Submitting navigates to the same path with the fields as query parameters, which
 * makes the URL the single source of truth for what is on screen. That buys, for
 * free and with **zero bytes of client JavaScript**: a shareable filtered view, a
 * working back button, a reload that keeps the filters, and a Server Component that
 * reads `searchParams` and needs no hydration.
 *
 * The `useState` version would need a client component, a debounce, a
 * `router.push`, and its own answer for "what happens on reload" — to arrive at
 * what the platform already does.
 *
 * ## `page` is deliberately not a field
 *
 * A GET form submits exactly the inputs it contains, so omitting `page` means
 * changing any filter drops it — landing on page 1. That is the correct behaviour
 * and it is achieved by leaving something out rather than by remembering to reset
 * it, which is the version that cannot be forgotten.
 *
 * ## Blank inputs
 *
 * An untouched text input submits as `""`, and the API 400s on `?status=`. The
 * browser sends it either way; `optional()` in `lib/admin-params.ts` is what turns
 * it back into "no filter" on the way in. Do not try to fix it here — a
 * `disabled`-when-empty scheme would break the "clear one filter" case.
 */

export interface FilterField {
  name: string;
  label: string;
  /** A `<select>` when options are given, a text input otherwise. */
  options?: readonly { value: string; label: string }[];
  /** The value currently in the URL, so the control renders as the admin left it. */
  value?: string | undefined;
  placeholder?: string;
  /** Widen a field that needs it — a search box next to two narrow selects. */
  grow?: boolean;
}

export interface FilterBarProps {
  /** The list's own path, for the Clear link. */
  basePath: string;
  fields: readonly FilterField[];
  /** True when anything is filtered, so Clear only appears when it would do something. */
  active: boolean;
}

export function FilterBar({ basePath, fields, active }: FilterBarProps) {
  return (
    <form
      // `method="get"` and no `action`: submits to the current path. Naming the
      // path here would break the moment a route moved.
      method="get"
      className="flex flex-wrap items-end gap-3"
    >
      {fields.map((field) =>
        field.options ? (
          <div key={field.name} className={field.grow ? "min-w-[180px] flex-1" : "min-w-[150px]"}>
            <Select
              label={field.label}
              name={field.name}
              // `defaultValue`, not `value`: this is an uncontrolled form and a
              // `value` with no `onChange` makes React log a warning and the
              // control unusable.
              defaultValue={field.value ?? ""}
            >
              {/*
                The empty option is what lets an admin clear one filter without
                clearing the rest. Its label says "Any", not "None" — "None" reads
                as "match nothing", which is the opposite.
              */}
              <option value="">Any {field.label.toLowerCase()}</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div key={field.name} className={field.grow ? "min-w-[200px] flex-1" : "min-w-[150px]"}>
            <Input
              label={field.label}
              name={field.name}
              type="search"
              defaultValue={field.value ?? ""}
              {...(field.placeholder !== undefined ? { placeholder: field.placeholder } : {})}
            />
          </div>
        ),
      )}

      <div className="flex items-center gap-2 pb-0.5">
        <SubmitButton variant="secondary">Filter</SubmitButton>
        {active && (
          <ButtonLink href={basePath} variant="tertiary">
            Clear
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
