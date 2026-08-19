import type { z } from "zod";

/**
 * The shape every Server Action in this app returns, and the Zod-to-fields helper.
 *
 * ## Why this is a separate module from `auth-actions.ts`
 *
 * The vendor app declares both of these inside its `"use server"` action file and
 * keeps `fieldErrorsOf` private. That works there because it is used in one file.
 * Here seven action files need it, and **exporting a synchronous function from a
 * `"use server"` module is a hard error** — every export in a Server Actions file
 * must be an async function, because each one becomes a callable RPC endpoint.
 *
 * The failure is worth naming because it does not look like what it is: the build
 * reports "Ecmascript file had an error" and underlines the `export function`
 * line, with no mention of `"use server"` being the reason.
 *
 * So the sharable, non-action parts live here in an ordinary module. Types would
 * have been fine to re-export (they are erased), but keeping the interface next to
 * the helper that populates it is the more useful grouping.
 */

export interface FormState {
  /** Shown above the form. `undefined` on first render and on success. */
  error?: string;
  /** Per-field messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /** A confirmation for actions that do not navigate. */
  message?: string;
}

/**
 * Turns a Zod failure into per-field copy the form can render inline.
 *
 * Takes the FIRST issue per field rather than joining them. Two messages under one
 * input ("must be a number" and "must be positive") is noise — the admin fixes the
 * first problem, resubmits, and sees the second if it survives. Joining them
 * produces a wall of text under a single input that is harder to act on than one
 * sentence.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key] === undefined) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
