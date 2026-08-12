"use client";

import { useActionState } from "react";
import type { Address } from "@rimalis/types";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { createAddress, updateAddress } from "@/lib/account-actions";
import type { FormState } from "@/lib/auth-actions";

/**
 * Add or edit a delivery address. One component for both.
 *
 * ## Used by the account section AND by checkout
 *
 * A shopper with no saved address meets this form inside the checkout flow
 * rather than being sent away to the account section. That is why it takes no
 * layout of its own and why the two callers share it: two copies would drift on
 * exactly the details that are easy to get wrong and invisible until an order
 * fails — the two-letter country code, whether an empty postcode is sent as `""`.
 *
 * ## `country` is a code, and the field says so
 *
 * The column is two characters. Typing "Nigeria" earns a 400 whose message reads
 * as though the country were rejected rather than the length, so the label, the
 * hint and the `maxLength` all point at the code. Defaulted to `NG`, which is
 * where this marketplace operates.
 *
 * ## Binding the id for the edit case
 *
 * `updateAddress` takes `(id, previousState, formData)`; `useActionState` calls
 * with `(previousState, formData)`. `bind` supplies the id from the server side
 * of the boundary, so it is not a hidden field the browser could change — an
 * action is a public endpoint, and an id in a form is an id anyone can swap.
 * (The API scopes the write to the caller regardless, which is the real defence;
 * this just avoids relying on it.)
 */

const INITIAL: FormState = {};

export function AddressForm({
  address,
  onDone,
}: {
  /** Present when editing. Absent when adding. */
  address?: Address;
  /** Rendered under the submit — a Cancel link, typically. */
  onDone?: React.ReactNode;
}) {
  const action = address ? updateAddress.bind(null, address.id) : createAddress;
  const [state, submit] = useActionState(action, INITIAL);

  return (
    <form action={submit} className="flex flex-col gap-6">
      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <Input
        label="Label"
        name="label"
        defaultValue={address?.label ?? ""}
        maxLength={50}
        placeholder="e.g. Home, Office"
        hint="Optional. Makes the address easier to pick at checkout."
        {...(state.fieldErrors?.["label"] ? { error: state.fieldErrors["label"] } : {})}
      />

      <Input
        label="Street address"
        name="street"
        autoComplete="street-address"
        defaultValue={address?.street ?? ""}
        required
        {...(state.fieldErrors?.["street"] ? { error: state.fieldErrors["street"] } : {})}
      />

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          label="City"
          name="city"
          autoComplete="address-level2"
          defaultValue={address?.city ?? ""}
          required
          {...(state.fieldErrors?.["city"] ? { error: state.fieldErrors["city"] } : {})}
        />
        <Input
          label="State"
          name="state"
          autoComplete="address-level1"
          defaultValue={address?.state ?? ""}
          required
          {...(state.fieldErrors?.["state"] ? { error: state.fieldErrors["state"] } : {})}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Input
          label="Postal code"
          name="postalCode"
          autoComplete="postal-code"
          defaultValue={address?.postalCode ?? ""}
          maxLength={20}
          hint="Optional."
          {...(state.fieldErrors?.["postalCode"] ? { error: state.fieldErrors["postalCode"] } : {})}
        />
        <Input
          label="Country code"
          name="country"
          autoComplete="country"
          defaultValue={address?.country ?? "NG"}
          maxLength={2}
          required
          hint="Two letters, e.g. NG."
          {...(state.fieldErrors?.["country"] ? { error: state.fieldErrors["country"] } : {})}
        />
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="isDefault"
          defaultChecked={address?.isDefault ?? false}
          className="size-4 accent-ink"
        />
        <span className="text-caption text-ink">Use this as my default address</span>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>{address ? "Save changes" : "Save address"}</SubmitButton>
        {onDone}
      </div>
    </form>
  );
}
