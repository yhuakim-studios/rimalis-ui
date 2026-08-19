"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Text inputs, selects and textareas — and the wiring that makes them accessible.
 *
 * ## The rule this file exists to enforce
 *
 * **The label is always visible.** Never a placeholder standing in for one.
 *
 * That is not a stylistic preference. A placeholder disappears the moment
 * someone types, so the field's meaning is gone exactly when they want to check
 * their work; it is announced inconsistently across screen readers; it fails
 * contrast requirements at the grey that makes it look like a label; and on a
 * form with an error, the shopper is left guessing which field "Invalid" refers
 * to. `label` is therefore a required prop, and `placeholder` is optional and for
 * *examples* only ("e.g. 0803 123 4567").
 *
 * ## Why the ids are generated here
 *
 * `label`→`htmlFor`, `aria-describedby`→hint, `aria-describedby`→error and
 * `aria-invalid` are four cross-references that all have to agree. Hand-written,
 * they agree on the day they are written; one copy-paste later two fields share
 * an id and the label points at the wrong input. `useId()` per instance removes
 * the possibility.
 *
 * ## The one shared shell
 *
 * `Input`, `Select` and `Textarea` differ only in the control element, so they
 * share `FieldShell`. Three separate implementations would drift on exactly the
 * details above — that is what "extract, don't invent" means in practice.
 */

const CONTROL_BASE =
  "w-full rounded-input bg-surface text-body text-ink " +
  "border border-divider-strong " +
  "placeholder:text-ink-subtle " +
  "transition-colors duration-150 ease-out-soft " +
  "hover:border-ink-muted " +
  "disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted";

/** 48px, or 56px for a hero search. Both are `h-` and not `min-h-`: a
 * single-line control with a fixed height is correct, unlike a button whose
 * label can wrap. */
const CONTROL_HEIGHT = { md: "h-12 px-4", lg: "h-14 px-5" } as const;

const INVALID = "border-danger hover:border-danger";

interface ShellProps {
  /** Required, and rendered visibly. See the header. */
  label: string;
  /** Helper text under the control. Announced via `aria-describedby`. */
  hint?: string;
  /** Error text. Its presence sets `aria-invalid`, so do not pass both this and a hint saying the same thing. */
  error?: string;
  /** Hides the label visually while keeping it for assistive tech. Use sparingly —
   *  justified only where surrounding content makes the label redundant to a
   *  sighted user, e.g. a search box next to a magnifier icon and a heading. */
  labelHidden?: boolean;
  required?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

function FieldShell({ label, hint, error, labelHidden, required, children }: ShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  // Both when both exist — a shopper needs the format rule AND what went wrong.
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={cn(
          "text-caption text-ink-muted",
          labelHidden && "sr-only",
        )}
      >
        {label}
        {required && (
          <>
            {" "}
            {/* The asterisk is decorative — `required` on the control is what
                assistive tech reads. Announcing "asterisk" adds noise. */}
            <span className="text-danger" aria-hidden>
              *
            </span>
          </>
        )}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint && !error && (
        <p id={hintId} className="text-caption text-ink-muted">
          {hint}
        </p>
      )}

      {/*
        `role="alert"` so an error that appears after submit is announced without
        the shopper having to go looking for it. Only on the error, never on the
        hint: an alert for static helper text would interrupt on every render.
      */}
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export interface InputProps
  // `size` is omitted from the HTML attributes and redefined below. The native
  // `size` on an `<input>` is a NUMBER — a legacy attribute giving the field's
  // width in characters, which nothing here uses and which CSS supersedes. Ours
  // is the design system's control height ("md" = 48px, "lg" = 56px), and the two
  // meanings cannot coexist on one prop name. Omitting the native one is the
  // right trade: it is unused, and the alternative is calling our prop something
  // that reads worse at every call site.
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "id" | "size"> {
  label: string;
  hint?: string;
  error?: string;
  labelHidden?: boolean;
  size?: keyof typeof CONTROL_HEIGHT;
  /**
   * A control inside the input's right edge — a submit button, a clear button, a
   * unit suffix.
   *
   * A slot here rather than the caller absolutely positioning something over the
   * field. Two reasons, and the first is a real bug rather than tidiness:
   * padding. The input needs `pr-14` so a long value scrolls to a stop *before*
   * the button instead of running underneath it, and a caller positioning from
   * outside has no way to add that. Second, `bottom-0` on the caller's side
   * silently misaligns the moment the field gains a hint or an error, because
   * the wrapper grows downward.
   */
  trailing?: ReactNode;
}

export function Input({
  label,
  hint,
  error,
  labelHidden,
  size = "md",
  trailing,
  ...rest
}: InputProps) {
  // `ReactNode` includes `0`, `""` and `0n`, none of which `cn` accepts and all
  // of which should count as "no trailing control" anyway. Narrowing once here
  // keeps the two uses below in step.
  const hasTrailing = Boolean(trailing);

  return (
    <FieldShell
      label={label}
      {...(hint !== undefined ? { hint } : {})}
      {...(error !== undefined ? { error } : {})}
      {...(labelHidden !== undefined ? { labelHidden } : {})}
      {...(rest.required !== undefined ? { required: rest.required } : {})}
    >
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(
              CONTROL_BASE,
              CONTROL_HEIGHT[size],
              // Room for a 44px control plus its inset. Without this a long
              // value renders underneath the button.
              hasTrailing && "pr-14",
              invalid && INVALID,
            )}
            {...rest}
          />
          {hasTrailing && (
            // Centred vertically against the control itself, so it stays put
            // when a hint or error appears below.
            <span className="absolute inset-y-0 right-2 grid place-items-center">
              {trailing}
            </span>
          )}
        </div>
      )}
    </FieldShell>
  );
}

export interface SelectProps
  // Same as `InputProps`: the native `size` on a `<select>` is the number of
  // visible rows, which would turn it into a list box. Ours is the control height.
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "className" | "id" | "size"> {
  label: string;
  hint?: string;
  error?: string;
  labelHidden?: boolean;
  size?: keyof typeof CONTROL_HEIGHT;
  children: ReactNode;
}

export function Select({
  label,
  hint,
  error,
  labelHidden,
  size = "md",
  children,
  ...rest
}: SelectProps) {
  return (
    <FieldShell
      label={label}
      {...(hint !== undefined ? { hint } : {})}
      {...(error !== undefined ? { error } : {})}
      {...(labelHidden !== undefined ? { labelHidden } : {})}
      {...(rest.required !== undefined ? { required: rest.required } : {})}
    >
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          // A native `<select>` on purpose: it gets the platform's own picker on
          // mobile, keyboard behaviour, and typeahead for free. A custom listbox
          // would need all three reimplemented and is the single most commonly
          // broken widget on the web.
          className={cn(CONTROL_BASE, CONTROL_HEIGHT[size], "pr-10", invalid && INVALID)}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}

export interface TextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "id"> {
  label: string;
  hint?: string;
  error?: string;
  labelHidden?: boolean;
}

export function Textarea({ label, hint, error, labelHidden, rows = 4, ...rest }: TextareaProps) {
  return (
    <FieldShell
      label={label}
      {...(hint !== undefined ? { hint } : {})}
      {...(error !== undefined ? { error } : {})}
      {...(labelHidden !== undefined ? { labelHidden } : {})}
      {...(rest.required !== undefined ? { required: rest.required } : {})}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(CONTROL_BASE, "px-4 py-3", invalid && INVALID)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
