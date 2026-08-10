"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { ButtonLink } from "@/components/primitives";
import { checkPaymentStatus } from "@/lib/checkout-actions";

/**
 * Waits for the webhook to settle the charge, then says what happened.
 *
 * ## Why this polls at all
 *
 * The redirect from Paystack is not proof of payment — the API's webhook is what
 * moves a payment to `SUCCESS`, and it arrives out of band. So the page asks,
 * waits, and asks again.
 *
 * ## The poll is bounded, and gives up honestly
 *
 * Ten attempts over roughly twenty seconds, backing off from 1s. A poll that
 * runs forever is a tab quietly hammering an API for as long as it stays open,
 * and after twenty seconds the answer is not going to arrive in the next second
 * either — at that point the useful thing is a link to the order, which shows
 * the authoritative state whenever the shopper looks.
 *
 * Giving up is worded as "still confirming", never as failure. The money may
 * well have left their account; telling them the payment failed because *our*
 * webhook is slow would be false and would send them to their bank.
 *
 * ## The timer is cleaned up on unmount
 *
 * Without the `cancelled` flag, a shopper who navigates away mid-poll leaves a
 * chain of `setTimeout`s calling a Server Action against an unmounted component
 * — React logs a warning and the requests keep going.
 */

type Status = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | null;

/** Ten tries, backing off 1s → 3s. About 20 seconds of patience in total. */
const MAX_ATTEMPTS = 10;
const delayFor = (attempt: number) => Math.min(1000 + attempt * 250, 3000);

export function PaymentStatusPoller({ orderId }: { orderId: string }) {
  const [status, setStatus] = useState<Status>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async (attempt: number) => {
      const result = await checkPaymentStatus(orderId);
      if (cancelled) return;

      if (result.unreachable) {
        setUnreachable(true);
        return;
      }

      setStatus(result.status);

      // A settled payment is settled — stop. Only `PENDING` and "no row yet"
      // are worth asking about again.
      if (result.status === "SUCCESS" || result.status === "FAILED" || result.status === "REFUNDED") {
        return;
      }

      if (attempt + 1 >= MAX_ATTEMPTS) {
        setGaveUp(true);
        return;
      }

      timer = setTimeout(() => void poll(attempt + 1), delayFor(attempt));
    };

    void poll(0);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId]);

  const orderHref = `/account/orders/${orderId}`;

  if (status === "SUCCESS") {
    return (
      <Panel
        icon={<CheckCircle2 className="size-7" strokeWidth={1.5} />}
        title="Payment received"
        body="Your order is confirmed and the sellers have been notified. You'll get an email as each parcel is dispatched."
      >
        <ButtonLink href={orderHref} size="lg" fullWidth>
          View your order
        </ButtonLink>
        <ButtonLink href="/products" variant="secondary" fullWidth>
          Keep shopping
        </ButtonLink>
      </Panel>
    );
  }

  if (status === "FAILED") {
    return (
      <Panel
        icon={<XCircle className="size-7" strokeWidth={1.5} />}
        title="That payment didn't go through"
        body="Nothing has been charged. Your order is still held — you can try paying again from the order page."
      >
        <ButtonLink href={orderHref} size="lg" fullWidth>
          Try paying again
        </ButtonLink>
      </Panel>
    );
  }

  if (status === "REFUNDED") {
    return (
      <Panel
        icon={<XCircle className="size-7" strokeWidth={1.5} />}
        title="This payment was refunded"
        body="The money is on its way back to you. Get in touch if it hasn't arrived within a few working days."
      >
        <ButtonLink href={orderHref} size="lg" fullWidth>
          View your order
        </ButtonLink>
      </Panel>
    );
  }

  if (unreachable || gaveUp) {
    return (
      <Panel
        icon={<Clock className="size-7" strokeWidth={1.5} />}
        // Deliberately not "failed". We do not know that, and if the charge did
        // go through, telling someone it failed sends them to their bank.
        title="Still confirming your payment"
        body="This is taking longer than usual on our side. Your order page always shows the current state — open it in a moment and it should be up to date."
      >
        <ButtonLink href={orderHref} size="lg" fullWidth>
          Open your order
        </ButtonLink>
      </Panel>
    );
  }

  return (
    <Panel
      icon={<Clock className="size-7 animate-pulse" strokeWidth={1.5} />}
      title="Confirming your payment"
      body="This usually takes a couple of seconds. Don't close this page."
    >
      <p className="text-center text-caption text-ink-muted">
        {/* A link out, even while waiting: a shopper who does close the tab must
            not be left wondering where their order went. */}
        <Link href={orderHref} className="underline underline-offset-4">
          Go to your order instead
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
