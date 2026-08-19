"use client";

import { useActionState, useState } from "react";
import { Button, Textarea } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import type { FormState } from "@/lib/form-state";

/**
 * A destructive or consequential action, behind one inline confirmation step.
 *
 * ## Why not a modal
 *
 * There is no modal primitive in this repo, and this is not the place to invent
 * one. A dialog that is actually correct needs a focus trap, focus restoration on
 * close, `aria-modal`, escape handling, scroll locking and an answer for what
 * happens when it opens while a form inside it is submitting. That is a component
 * worth building deliberately, once — not as a side effect of needing to confirm a
 * suspension.
 *
 * ## Why not `window.confirm`
 *
 * It cannot be styled, cannot be labelled, cannot carry the reason field half of
 * these actions require, blocks the main thread, and is suppressed outright in some
 * embedded contexts — where it returns `false` and the action silently never runs.
 * A confirmation that can be silently disabled is not a confirmation.
 *
 * ## What this does instead
 *
 * Two clicks in place. The first reveals a panel that states the consequence in
 * words and, where the endpoint accepts one, asks for a reason. The second submits.
 * The revealed panel is ordinary flow content, so it needs no focus management and
 * cannot trap anyone.
 *
 * That makes the copy the component's real job. `consequence` should say what will
 * be *true afterwards*, not repeat the button — "This vendor's listings stop
 * selling immediately and their dashboard locks" rather than "Are you sure?".
 * "Are you sure" is a question the admin cannot answer without the information the
 * dialog declined to give them.
 *
 * ## The reason field
 *
 * Where the API records a reason, it is worth saying so on screen: it lands in the
 * audit trail and is the only thing that answers "why is this vendor suspended"
 * six months later. The audit table exists *because* three endpoints used to
 * validate a reason and then discard it.
 *
 * ⚠️ Do not add a reason field to an action that does not accept one. `rejectVendor`
 * takes no body at all — a field there would silently discard what was typed, which
 * is the exact bug the trail was created to fix.
 */

export interface ConfirmActionProps {
  /** The Server Action. Receives the hidden fields plus `reason` when present. */
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** The resting button. */
  label: string;
  /** The confirming button. Name the outcome — "Suspend vendor", not "Confirm". */
  confirmLabel: string;
  /** What will be true afterwards. Shown in the panel. */
  consequence: string;
  /** Renders the button and the confirm control in the danger variant. */
  danger?: boolean;
  /**
   * Ask for a reason. Only when the endpoint actually records one.
   *
   * `required` mirrors the API: `adjustStock` demands a reason, `suspendVendor`
   * accepts an optional one.
   */
  reasonField?: { label: string; required?: boolean; hint?: string };
  /** Ids and other fixed values the action needs, as hidden inputs. */
  hidden?: Record<string, string>;
  /** Disables the trigger and says why — e.g. an action invalid in this state. */
  disabledReason?: string;
}

export function ConfirmAction({
  action,
  label,
  confirmLabel,
  consequence,
  danger = false,
  reasonField,
  hidden = {},
  disabledReason,
}: ConfirmActionProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(action, {});

  if (disabledReason !== undefined) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="secondary" disabled>
          {label}
        </Button>
        <p className="text-meta text-ink-subtle">{disabledReason}</p>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button variant={danger ? "danger" : "secondary"} onClick={() => setOpen(true)}>
          {label}
        </Button>
        {/*
          An error from a previous attempt survives closing the panel, so the admin
          is not left thinking it worked. `useActionState` keeps it until the next
          submission.
        */}
        {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
        {state.message && <FormBanner tone="success">{state.message}</FormBanner>}
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-input border border-divider-strong bg-canvas p-4"
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <p className="text-caption text-ink">{consequence}</p>

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}

      {reasonField && (
        <Textarea
          label={reasonField.label}
          name="reason"
          rows={2}
          required={reasonField.required ?? false}
          hint={
            reasonField.hint ??
            "Recorded in the activity log against your account."
          }
          error={state.fieldErrors?.["reason"]}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <SubmitButton variant={danger ? "danger" : "primary"}>{confirmLabel}</SubmitButton>
        {/*
          `type="button"` is load-bearing: a bare <button> inside a form defaults
          to type="submit", so a "Cancel" without it performs the action it exists
          to cancel. That is a genuinely dangerous default on a suspension control.
        */}
        <Button type="button" variant="tertiary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
