"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Address } from "@rimalis/types";
import { Card, Textarea } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { placeOrder, type CheckoutState } from "@/lib/checkout-actions";

/**
 * Address choice, delivery notes, and the button that spends money.
 *
 * ## The idempotency key is minted once, here, and never regenerated
 *
 * `useState(() => crypto.randomUUID())` runs its initialiser on first render and
 * never again, so the key survives re-renders, a failed submit, and a second
 * press of the button. That is the entire mechanism: the API returns the
 * *original* order for a repeat of the same key, so a double-tapped checkout
 * produces one order and one charge.
 *
 * Generating it in the submit handler — the obvious alternative — would produce
 * a fresh key per press and defeat it completely. Generating it on the server
 * inside the action would be worse still, since the action runs once per submit
 * by definition.
 *
 * A new key IS wanted after a genuinely different attempt: if the shopper edits
 * the basket and comes back, the page has remounted and the key is new, which is
 * correct — that is a different order.
 *
 * `crypto.randomUUID()` is available in every browser this app supports and
 * requires a secure context, which production is and `localhost` counts as.
 */

const INITIAL: CheckoutState = {};

export interface CheckoutFormProps {
  addresses: Address[];
  /** Pre-selected: the account's default, or the only one there is. */
  defaultAddressId: string;
}

export function CheckoutForm({ addresses, defaultAddressId }: CheckoutFormProps) {
  const [state, action] = useActionState(placeOrder, INITIAL);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [addressId, setAddressId] = useState(defaultAddressId);

  return (
    <form action={action} className="flex flex-col gap-8">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {state.error && (
        <FormBanner tone="error">
          {state.error}{" "}
          {state.reviewCart && (
            <Link href="/cart" className="font-medium underline underline-offset-4">
              Review your basket
            </Link>
          )}
          {state.needsVerification && (
            <Link href="/verify-email" className="font-medium underline underline-offset-4">
              Verify your email
            </Link>
          )}
        </FormBanner>
      )}

      <fieldset className="flex flex-col gap-4">
        <legend className="pb-2 text-section text-ink">Delivery address</legend>

        {/*
          Radios, not a `<select>`. An address is four lines of text and a
          shopper has to *read* the one they are choosing — a collapsed select
          shows one line and hides the rest behind an interaction, which is how
          an order goes to an old flat. Radios also give each option its own
          touch target rather than one shared 48px row.
        */}
        <div className="flex flex-col gap-3">
          {addresses.map((address) => (
            <label
              key={address.id}
              className="flex cursor-pointer items-start gap-3 rounded-input border border-divider-strong bg-surface p-4 transition-colors duration-150 ease-out-soft hover:border-ink-muted has-[:checked]:border-ink"
            >
              <input
                type="radio"
                name="addressId"
                value={address.id}
                checked={addressId === address.id}
                onChange={() => setAddressId(address.id)}
                className="mt-1 size-4 accent-ink"
              />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-body text-ink">
                  {address.label ?? address.street}
                  {address.isDefault && (
                    <span className="pl-2 text-meta text-ink-muted">Default</span>
                  )}
                </span>
                <span className="text-caption text-ink-muted">
                  {address.street}, {address.city}, {address.state}
                  {address.postalCode ? ` ${address.postalCode}` : ""} · {address.country}
                </span>
              </span>
            </label>
          ))}
        </div>

        <Link
          href="/account/addresses?next=%2Fcheckout"
          className="inline-flex min-h-11 w-fit items-center text-caption font-medium text-ink underline underline-offset-4"
        >
          Add or edit addresses
        </Link>
      </fieldset>

      <Textarea
        label="Delivery notes"
        name="notes"
        rows={3}
        maxLength={500}
        placeholder="e.g. Gate code, landmark, best time to deliver"
        hint="Optional. Up to 500 characters, shared with every seller in this order."
      />

      <div className="flex flex-col gap-3">
        <SubmitButton size="lg" fullWidth disabled={!addressId}>
          Place order and pay
        </SubmitButton>
        <p className="text-caption text-ink-muted">
          You&rsquo;ll be taken to Paystack to pay. Your order is created first, so nothing
          is lost if you come back.
        </p>
      </div>
    </form>
  );
}
