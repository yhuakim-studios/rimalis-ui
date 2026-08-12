"use client";

import { useState, useTransition } from "react";
import type { Address } from "@rimalis/types";
import { Button } from "@/components/primitives";
import { deleteAddress, setDefaultAddress } from "@/lib/account-actions";
import { AddressForm } from "./AddressForm";

/**
 * Edit / make default / delete, for one saved address.
 *
 * ## Delete asks first, unlike removing a cart line
 *
 * The distinction is whether the action is reversible by the person taking it. A
 * removed cart line is one click away from being re-added; a deleted address is
 * four fields the shopper has to retype from memory, and the delete button sits
 * beside an edit button they were probably aiming for. So this one confirms
 * inline — two presses, no modal, and the second button says what it will do
 * rather than "OK".
 *
 * ## Editing expands in place
 *
 * The form replaces the row rather than opening a dialog. A dialog would trap
 * focus and hide the other addresses, which are the context for "is this the one
 * I meant to change?".
 */

export function AddressActions({ address }: { address: Address }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (editing) {
    return (
      <div className="w-full pt-4">
        <AddressForm
          address={address}
          onDone={
            <Button variant="tertiary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!address.isDefault && (
        <Button
          variant="tertiary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => void (await setDefaultAddress(address.id)))
          }
        >
          Make default
        </Button>
      )}

      <Button variant="tertiary" onClick={() => setEditing(true)}>
        Edit
      </Button>

      {confirmingDelete ? (
        <>
          <Button
            variant="danger"
            loading={pending}
            onClick={() =>
              startTransition(async () => void (await deleteAddress(address.id)))
            }
          >
            Delete for good
          </Button>
          <Button variant="tertiary" onClick={() => setConfirmingDelete(false)}>
            Keep it
          </Button>
        </>
      ) : (
        <Button variant="tertiary" onClick={() => setConfirmingDelete(true)}>
          Delete
        </Button>
      )}
    </div>
  );
}
