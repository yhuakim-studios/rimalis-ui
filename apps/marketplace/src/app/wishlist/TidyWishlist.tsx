"use client";

import { useTransition } from "react";
import { Button } from "@/components/primitives";
import { removeFromWishlist } from "@/lib/wishlist-actions";

/**
 * "Some of these are gone — clear them?"
 *
 * The count is the point of this component. "1 saved item is no longer
 * available" is a fact a shopper can act on; a list that silently came back one
 * item shorter is one they will not notice and would not trust if they did.
 */

export function TidyWishlist({ ids }: { ids: string[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-input border border-divider bg-surface p-4">
      <p className="text-caption text-ink-muted">
        {ids.length} saved {ids.length === 1 ? "item is" : "items are"} no longer available.
      </p>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => startTransition(async () => void (await removeFromWishlist(ids)))}
      >
        Remove {ids.length === 1 ? "it" : "them"}
      </Button>
    </div>
  );
}
