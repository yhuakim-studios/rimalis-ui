"use client";

import { useTransition } from "react";
import { Button } from "@/components/primitives";
import { signOut, signOutEverywhere } from "@/lib/auth-actions";

/**
 * Sign out here, or sign out everywhere.
 *
 * Two distinct actions, not one with a checkbox. "Sign out" revokes this
 * browser's refresh token; "sign out of all devices" revokes every session on
 * the account and is the remedy to offer someone who thinks they have been
 * compromised. A shopper reaching for the second one is worried, and making them
 * find it behind an option is the wrong moment to be economical with buttons.
 *
 * The destructive one is `danger`, and it is the only `danger` button on this
 * page — the variant is reserved for actions that cannot be undone by pressing
 * the same thing again.
 */

export function SessionActions() {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => startTransition(async () => void (await signOut()))}
      >
        Sign out
      </Button>

      <Button
        variant="danger"
        disabled={pending}
        onClick={() => startTransition(async () => void (await signOutEverywhere()))}
      >
        Sign out of all devices
      </Button>
    </div>
  );
}
