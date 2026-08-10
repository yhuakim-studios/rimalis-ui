"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/components/primitives";
import { toggleWishlist } from "@/lib/wishlist-actions";

/**
 * The heart. Saves a listing, or unsaves it.
 *
 * ## The label changes with the state, and it is not decoration
 *
 * A heart that is filled when saved and outlined when not is invisible to a
 * screen reader and to anyone who cannot distinguish the two shapes at 20px.
 * `aria-pressed` is what actually carries the state, and the accessible name
 * says what pressing it will do — "Save X" versus "Remove X from saved items" —
 * rather than naming the icon.
 *
 * ## Optimistic, because the alternative is a heart that lags a tap
 *
 * The fill flips immediately; the cookie write follows. If it fails — the limit
 * is reached — the state reverts and a message appears. The failure is rare
 * enough that optimism is the right default and visible enough that it is not a
 * lie.
 */

export function SaveButton({
  listingId,
  productName,
  saved: initiallySaved,
  className,
}: {
  listingId: string;
  productName: string;
  saved: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(initiallySaved);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = () => {
    const optimistic = !saved;
    setSaved(optimistic);
    setMessage(null);

    startTransition(async () => {
      const result = await toggleWishlist(listingId);
      // The action's own answer wins over the optimistic flip — it is the one
      // that read the cookie at the moment it wrote it.
      setSaved(result.saved);
      if (result.message) setMessage(result.message);
    });
  };

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${productName} from saved items` : `Save ${productName}`}
        title={saved ? "Saved" : "Save for later"}
        className={cn(
          "inline-grid size-11 shrink-0 place-items-center rounded-pill transition-colors duration-150 ease-out-soft",
          "border border-divider-strong bg-surface hover:bg-canvas",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <Heart
          className={cn("size-5", saved ? "fill-ink text-ink" : "text-ink")}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {message && (
        <p role="status" className="text-meta text-ink-muted">
          {message}
        </p>
      )}
    </div>
  );
}
