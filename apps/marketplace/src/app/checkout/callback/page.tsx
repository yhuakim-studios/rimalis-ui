import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout";
import { requireSession } from "@/lib/auth";
import { PaymentStatusPoller } from "./PaymentStatusPoller";

/**
 * Where Paystack sends the shopper back.
 *
 * ## This page proves nothing about the payment, and must not pretend otherwise
 *
 * A shopper arriving here means a browser came back. It does not mean they paid:
 * they may have abandoned the Paystack page, or pressed back, or the charge may
 * have failed. The **webhook** is what settles a payment, server-side, and it
 * usually lands within a second or two of the charge — but not synchronously
 * with this redirect.
 *
 * So this page polls `GET /payments/:orderId` and shows a waiting state. It
 * never says "thank you for your payment" off the back of the redirect alone,
 * which is the single most common way a marketplace ends up shipping goods for
 * an abandoned checkout.
 *
 * ## Why the session survives the trip
 *
 * The return is a **cross-site top-level navigation**. A `SameSite=Strict`
 * cookie is not sent on one, so this page would render for a signed-out visitor
 * holding a receipt. The session cookie is `Lax` precisely for this hop — see
 * the header of `lib/session.ts`.
 *
 * ## `orderId` comes from our own callback URL, not from Paystack
 *
 * The app builds `callbackUrl` with the order id it just created, so the
 * parameter is ours. It is still only an id: every read is scoped to the
 * caller's own orders by the API, so a shopper editing it in the address bar
 * gets a 404 rather than somebody else's receipt.
 */

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const { orderId } = await searchParams;

  // Without an id there is nothing to poll. The orders list is the honest
  // destination — whatever happened, the order is there.
  if (!orderId) redirect("/account/orders");

  await requireSession(`/checkout/callback?orderId=${encodeURIComponent(orderId)}`);

  return (
    <Container className="py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">
        <PaymentStatusPoller orderId={orderId} />
      </div>
    </Container>
  );
}
