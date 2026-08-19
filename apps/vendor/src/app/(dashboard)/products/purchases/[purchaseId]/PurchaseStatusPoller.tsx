"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { StockPurchaseStatus } from "@rimalis/types";
import { ButtonLink } from "@/components/primitives";
import { pluralise } from "@/lib/format";
import { checkStockPurchase } from "@/lib/listing-actions";

/**
 * Waits for the webhook to turn a paid stock purchase into a listing.
 *
 * ## Why this polls at all
 *
 * The purchase row exists from the moment the vendor was sent to Paystack; what
 * arrives late is the `charge.success` webhook, which is what moves it to
 * `SUCCESS`, credits `ownedStock` and creates the listing. The redirect back
 * beats that webhook often enough to matter, so the page asks again.
 *
 * ## There is no retry button, at any point
 *
 * Not on `PENDING`, not on the give-up state, not on `FAILED`. Starting a new
 * purchase reserves a fresh batch out of the pool and opens a second Paystack
 * transaction — `POST /vendor/stock-purchases` has no idempotency key — so a
 * button here is a mechanism for charging a confused vendor twice for the same
 * stock. The way to buy again is to go back to the catalogue deliberately.
 *
 * ## The poll is bounded, and gives up honestly
 *
 * Ten attempts over roughly twenty seconds, backing off from 1s, then a link to
 * the products page. Giving up is worded as "still confirming", never as
 * failure: the money may well have left the vendor's account, and telling a
 * business their payment failed when it did not is how they end up disputing a
 * charge that was fine.
 *
 * `PENDING` past this point is not lost either — the sweep job expires an
 * unpaid purchase after ~30 minutes and returns the units to the pool, so
 * nothing stays reserved because a tab was closed.
 */

type Status = StockPurchaseStatus | null;

/** Ten tries, backing off 1s → 3s. About 20 seconds of patience in total. */
const MAX_ATTEMPTS = 10;
const delayFor = (attempt: number) => Math.min(1000 + attempt * 250, 3000);

export function PurchaseStatusPoller({
  purchaseId,
  initialStatus,
  quantity,
  totalCost,
}: {
  purchaseId: string;
  initialStatus: StockPurchaseStatus;
  quantity: number;
  totalCost: string;
}) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [gaveUp, setGaveUp] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    // The server already answered. Only PENDING is worth asking about again —
    // every other status is terminal.
    if (initialStatus !== "PENDING") return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (attempt: number) => {
      const result = await checkStockPurchase(purchaseId);
      if (cancelled) return;

      if (result.unreachable) {
        setUnreachable(true);
        return;
      }

      setStatus(result.status);
      if (result.status !== "PENDING") return;

      if (attempt + 1 >= MAX_ATTEMPTS) {
        setGaveUp(true);
        return;
      }

      timer = setTimeout(() => void poll(attempt + 1), delayFor(attempt));
    };

    void poll(0);

    // Without this a vendor who navigates away mid-poll leaves a chain of
    // timeouts calling a Server Action against an unmounted component.
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [purchaseId, initialStatus]);

  const units = pluralise(quantity, "unit");

  if (status === "SUCCESS") {
    return (
      <Panel
        icon={<CheckCircle2 className="size-7" strokeWidth={1.5} />}
        title="Stock is yours"
        body={`You paid ${totalCost} for ${units}. They're in your store now — switch the listing on if you want shoppers to see it.`}
      >
        <ButtonLink href="/products" size="lg" fullWidth>
          View your products
        </ButtonLink>
        <ButtonLink href="/products/add" variant="secondary" fullWidth>
          Buy more stock
        </ButtonLink>
      </Panel>
    );
  }

  if (status === "FAILED" || status === "ABANDONED") {
    return (
      <Panel
        icon={<XCircle className="size-7" strokeWidth={1.5} />}
        // Deliberately not "try again" — see the header. The catalogue is a
        // navigation, so a vendor who lands there has chosen to buy again.
        title={status === "FAILED" ? "That payment didn't go through" : "This purchase expired"}
        body={
          status === "FAILED"
            ? `Nothing was charged and no stock changed hands. The ${units} went back into Rimalis' pool.`
            : `The payment wasn't completed in time, so the ${units} went back into Rimalis' pool. Nothing was charged.`
        }
      >
        <ButtonLink href="/products/add" size="lg" fullWidth>
          Back to the catalogue
        </ButtonLink>
      </Panel>
    );
  }

  if (unreachable || gaveUp) {
    return (
      <Panel
        icon={<Clock className="size-7" strokeWidth={1.5} />}
        title="Still confirming your payment"
        body="This is taking longer than usual on our side. Your products page always shows what you actually own — open it in a moment and it should be up to date."
      >
        <ButtonLink href="/products" size="lg" fullWidth>
          Open your products
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel
      icon={<Clock className="size-7 animate-pulse" strokeWidth={1.5} />}
      title="Confirming your payment"
      body={`Adding ${units} to your store. This usually takes a couple of seconds — don't close this page.`}
    >
      <p className="text-center text-caption text-ink-muted">
        <Link href="/products" prefetch={false} className="underline underline-offset-4">
          Go to your products instead
        </Link>
      </p>
    </Panel>
  );
}

function Panel({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    // `role="status"` so the outcome is announced when it replaces the waiting
    // state — a screen-reader user would otherwise sit on "Confirming…" forever.
    <div role="status" className="flex flex-col items-center gap-6 text-center">
      <div className="grid size-16 place-items-center rounded-pill bg-canvas text-ink-subtle" aria-hidden>
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink">{title}</h1>
        <p className="text-body text-ink-muted">{body}</p>
      </div>
      <div className="flex w-full flex-col gap-3">{children}</div>
    </div>
  );
}
