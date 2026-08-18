import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ErrorState } from "@/components/feedback";
import { Card } from "@/components/primitives";
import { ctxFor, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PurchaseStatusPoller } from "./PurchaseStatusPoller";

/**
 * Where Paystack sends the vendor back after paying for stock.
 *
 * The API builds this URL itself — `stock-purchases.service.ts` defaults
 * `callbackUrl` to `${VENDOR_APP_URL}/products/purchases/${purchase.id}` — so
 * the path is a contract with the API, not a free choice. Renaming this route
 * without changing that default is a 404 at the end of a payment the vendor has
 * already made.
 *
 * Paystack appends its own `trxref` and `reference` query parameters on the way
 * back. Both are ignored on purpose: the id in the path is ours, and the
 * reference proves nothing that `GET /vendor/stock-purchases/:id` does not
 * answer authoritatively.
 *
 * ## Arriving here is not proof of payment
 *
 * It means a browser came back. The vendor may have abandoned the Paystack page
 * or the charge may have failed; the **webhook** is what moves the purchase to
 * `SUCCESS` and creates the listing, and it lands out of band. So this page
 * fetches once, and hands anything still `PENDING` to a poller rather than
 * congratulating anyone off the back of a redirect.
 *
 * ## The first read happens on the server
 *
 * The webhook is usually there before the vendor is, so the common case renders
 * settled with no client round trip at all — and an id that is not this vendor's
 * gets `notFound()` instead of a spinner that never resolves.
 */

export const metadata: Metadata = {
  title: "Confirming your purchase",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StockPurchaseCallbackPage({
  params,
}: {
  params: Promise<{ purchaseId: string }>;
}) {
  const { purchaseId } = await params;
  const { session } = await requireApprovedVendor(`/products/purchases/${purchaseId}`);

  const result = await vendorApi.getStockPurchase(ctxFor(session), purchaseId);

  if (!result.ok) {
    // As on the order page: 404 and 400 both mean "no such purchase for you" —
    // the API answers 404 rather than 403 for another vendor's row so an id
    // cannot be confirmed by probing, and a malformed uuid is a 400.
    if (result.error.kind === "http" && (result.error.status === 404 || result.error.status === 400)) {
      notFound();
    }
    return (
      <Card padding="lg">
        <ErrorState error={result.error} title="We couldn't check this purchase" />
      </Card>
    );
  }

  const purchase = result.data;

  return (
    <div className="mx-auto w-full max-w-md py-8 md:py-16">
      <PurchaseStatusPoller
        purchaseId={purchase.id}
        initialStatus={purchase.status}
        quantity={purchase.quantity}
        totalCost={formatMoney(purchase.totalCost)}
      />
    </div>
  );
}
