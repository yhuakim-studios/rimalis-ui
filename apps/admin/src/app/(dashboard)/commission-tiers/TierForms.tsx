"use client";

import { useActionState, useState } from "react";
import type { CommissionTier } from "@rimalis/types";
import { Button, Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { ConfirmAction } from "@/components/admin";
import { createTier, deleteTier, setTierActive, updateTier } from "@/lib/tier-actions";
import type { FormState } from "@/lib/form-state";

/** The percentage an admin reads, from the fraction the API stores. */
export const asPercent = (rate: number): string =>
  // `Number(...toFixed(2))` strips the binary-float tail — 0.07 * 100 is
  // 7.000000000000001, which pre-filled into an input reads as corrupt data.
  String(Number((rate * 100).toFixed(2)));

export function CreateTierForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createTier, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Level"
          name="level"
          type="text"
          inputMode="numeric"
          required
          hint="Display order, from 0. Unique."
          error={state.fieldErrors?.["level"]}
        />
        <Input
          label="Name"
          name="name"
          required
          placeholder="Silver"
          error={state.fieldErrors?.["name"]}
        />
        <Input
          label="Qualified referrals"
          name="minReferrals"
          type="text"
          inputMode="numeric"
          required
          hint="0 is the entry rung."
          error={state.fieldErrors?.["minReferrals"]}
        />
        <Input
          label="Commission"
          name="percent"
          // Not type="number": the scroll wheel silently changes a value on a page
          // an admin is reading, and this one sets what vendors pay.
          type="text"
          inputMode="decimal"
          required
          hint="Percent, e.g. 8.5"
          error={state.fieldErrors?.["percent"]}
        />
      </div>

      <label className="flex w-fit items-center gap-2 text-caption">
        {/*
          An unchecked checkbox is ABSENT from FormData rather than "false", which is
          why the action reads `formData.has(name)` instead of parsing a value.
          `defaultChecked` so the ordinary case — adding a live rung — needs no click.
        */}
        <input type="checkbox" name="isActive" defaultChecked className="size-4" />
        Live immediately
      </label>

      <div>
        <SubmitButton>Add rung</SubmitButton>
      </div>
    </form>
  );
}

/**
 * One rung: edit inline, toggle live, or delete.
 *
 * Deactivating is offered before deleting, and the copy says why: the row stays
 * readable for anyone auditing a historical rate, and the API refuses to delete the
 * last active rung regardless.
 */
export function TierRow({ tier }: { tier: CommissionTier }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(updateTier, {});
  const [toggleState, toggleAction] = useActionState<FormState, FormData>(
    setTierActive,
    {},
  );

  return (
    <li className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-caption font-medium">
          {tier.level}. {tier.name}
        </span>
        <span className="text-caption tabular-nums">
          {asPercent(tier.rate)}%
          <span className="ml-1.5 font-mono text-meta text-ink-subtle">
            ({tier.rate})
          </span>
        </span>
        <span className="text-caption text-ink-muted">
          from {tier.minReferrals} qualified{" "}
          {tier.minReferrals === 1 ? "referral" : "referrals"}
        </span>
        {!tier.isActive && (
          <span className="text-meta font-medium text-ink-subtle">Not live</span>
        )}

        <span className="ml-auto flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="tertiary"
            onClick={() => setEditing((open) => !open)}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>

          <form action={toggleAction}>
            <input type="hidden" name="tierId" value={tier.id} />
            <input
              type="hidden"
              name="isActive"
              value={tier.isActive ? "false" : "true"}
            />
            <SubmitButton variant="tertiary">
              {tier.isActive ? "Deactivate" : "Make live"}
            </SubmitButton>
          </form>

          <ConfirmAction
            action={deleteTier}
            label="Delete"
            confirmLabel="Delete rung"
            consequence="Deactivating is usually better — it keeps the rung readable for anyone auditing a rate a vendor was charged in the past. The API refuses to delete the last active rung."
            danger
            hidden={{ tierId: tier.id }}
          />
        </span>
      </div>

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}
      {toggleState.error && <FormBanner tone="error">{toggleState.error}</FormBanner>}
      {toggleState.message && (
        <FormBanner tone="success">{toggleState.message}</FormBanner>
      )}

      {editing && (
        <form
          action={formAction}
          className="grid gap-3 rounded-input bg-canvas p-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <input type="hidden" name="tierId" value={tier.id} />
          <Input
            label="Level"
            name="level"
            type="text"
            inputMode="numeric"
            defaultValue={String(tier.level)}
            error={state.fieldErrors?.["level"]}
          />
          <Input
            label="Name"
            name="name"
            defaultValue={tier.name}
            error={state.fieldErrors?.["name"]}
          />
          <Input
            label="Referrals"
            name="minReferrals"
            type="text"
            inputMode="numeric"
            defaultValue={String(tier.minReferrals)}
            error={state.fieldErrors?.["minReferrals"]}
          />
          <Input
            label="Commission %"
            name="percent"
            type="text"
            inputMode="decimal"
            defaultValue={asPercent(tier.rate)}
            error={state.fieldErrors?.["percent"]}
          />
          <div className="flex items-end">
            <SubmitButton variant="secondary">Save</SubmitButton>
          </div>
        </form>
      )}
    </li>
  );
}
