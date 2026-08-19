"use client";

import { useActionState } from "react";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { clearCommissionRate, setCommissionRate } from "@/lib/vendor-actions";
import type { FormState } from "@/lib/form-state";

/**
 * The commission override — the one control on this app that changes money.
 *
 * ## Percent on screen, fraction on the wire
 *
 * Humans say "8%", the column holds `0.08`. Getting the direction wrong by a
 * factor of a hundred either hands a vendor the platform's entire margin or
 * charges them eight times over, so the conversion lives in exactly one place
 * (`vendor-actions.ts`) and this form only ever shows and collects a percentage.
 *
 * ## `null` is not "the default", and the copy has to say so
 *
 * Clearing the override does not fall back to a platform rate — it hands the
 * decision to the referral ladder, which resolves to a different rate for every
 * vendor depending on how many recruits they have qualified. "Clear" would imply
 * "reset to normal", so the button says what actually happens.
 *
 * That distinction is a comment in three places in this codebase and a comment
 * cannot reach the admin clicking the button, so here it is on-screen text.
 *
 * ## Two actions, not one with an empty value
 *
 * Setting a rate and returning a vendor to the ladder are different intents, and
 * an empty text field is an ambiguous way to express the second — it reads as
 * "I haven't decided" at least as readily as "remove the override". Two submits,
 * two server actions, no ambiguity about which one an empty input meant.
 */
export function CommissionRateForm({
  vendorId,
  currentOverride,
  qualifiedReferrals,
}: {
  vendorId: string;
  /** The fraction from the API, or `null` when the ladder decides. */
  currentOverride: number | null;
  /** Shown because it is what the ladder is scored on when there is no override. */
  qualifiedReferrals: number;
}) {
  const [setState, setAction] = useActionState<FormState, FormData>(setCommissionRate, {});
  const [clearState, clearAction] = useActionState<FormState, FormData>(
    clearCommissionRate,
    {},
  );

  const asPercent =
    currentOverride === null
      ? ""
      : // `Number(...toFixed(2))` strips the binary-float tail: 0.07 * 100 is
        // 7.000000000000001, and an input pre-filled with that reads as corrupt.
        String(Number((currentOverride * 100).toFixed(2)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-caption text-ink">
          {currentOverride === null ? (
            <>
              No override. This vendor is charged whatever their{" "}
              <strong className="font-semibold">referral tier</strong> has earned
              — they have {qualifiedReferrals} qualified{" "}
              {qualifiedReferrals === 1 ? "recruit" : "recruits"}.
            </>
          ) : (
            <>
              Overridden at{" "}
              <strong className="font-semibold">{asPercent}%</strong>, which beats
              their referral tier outright.
            </>
          )}
        </p>
        <p className="text-meta text-ink-subtle">
          Charged on the vendor&apos;s margin (retail minus cost), not on the sale
          price. Applies to future orders only — every existing order snapshotted
          its rate at checkout.
        </p>
      </div>

      {setState.error && <FormBanner tone="error">{setState.error}</FormBanner>}
      {setState.message && <FormBanner tone="success">{setState.message}</FormBanner>}
      {clearState.error && <FormBanner tone="error">{clearState.error}</FormBanner>}
      {clearState.message && (
        <FormBanner tone="success">{clearState.message}</FormBanner>
      )}

      <form action={setAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="vendorId" value={vendorId} />
        <div className="min-w-[160px]">
          <Input
            label="Commission"
            name="percent"
            // `type="text"` with a numeric hint rather than `type="number"`: a
            // number input's scroll wheel silently changes the value on a page
            // an admin is reading, and this is a field where a stray scroll is
            // a change to what a vendor gets paid.
            type="text"
            inputMode="decimal"
            defaultValue={asPercent}
            placeholder="8.5"
            hint="Percent, e.g. 8.5"
            error={setState.fieldErrors?.["percent"]}
          />
        </div>
        <SubmitButton variant="secondary">
          {currentOverride === null ? "Set override" : "Update override"}
        </SubmitButton>
      </form>

      {currentOverride !== null && (
        <form action={clearAction}>
          <input type="hidden" name="vendorId" value={vendorId} />
          <SubmitButton variant="tertiary">
            Remove override — let their referral tier decide
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
