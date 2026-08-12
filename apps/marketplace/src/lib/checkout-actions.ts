"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { shopperMessage } from "@rimalis/api-client";
import { getSession, orders, payments } from "./auth";
import { apiConfig, appOrigin } from "./env";
import { clearCart } from "./cart-actions";
import { loadCart, toOrderItems } from "./cart";

/**
 * Placing the order and starting the charge. The one action that spends money.
 *
 * ## The sequence, and why each step is where it is
 *
 *   1. re-read the basket from the API   — prices and stock as of *now*
 *   2. POST /orders with an idempotency key — stock is decremented here
 *   3. clear the basket                  — the order owns those items now
 *   4. POST /payments/initialize         — build the Paystack split
 *   5. redirect to Paystack
 *
 * Step 1 is not paranoia. The cart page rendered at some earlier moment, and
 * between then and now a vendor can reprice, a listing can sell out, and a
 * vendor can be suspended. Sending the stale basket produces a 409 the shopper
 * has to interpret; re-reading produces a page that says which line changed.
 *
 * Step 3 sits **before** payment initialisation, not after the charge. The order
 * exists and holds stock the moment step 2 returns, whether or not the shopper
 * ever reaches Paystack — so the basket's job is finished at step 2. Leaving it
 * populated invites a second, accidental purchase of things already ordered.
 *
 * ## The idempotency key comes from the client, and must not be generated here
 *
 * It is a hidden field, minted once when the checkout form mounts. Generating it
 * inside this action would produce a *fresh* key on every submit — which is
 * exactly the case the key exists to defend against, since a double-tapped
 * button submits twice. A stable key makes the second submit return the first
 * order instead of creating a second one.
 *
 * `http.ts` additionally refuses to retry any non-GET, so nothing in the stack
 * silently repeats this request on our behalf.
 *
 * ## Payment failure does not undo the order, and that is the right behaviour
 *
 * If step 4 fails the order stands as `PENDING` with its stock held, and the
 * shopper is sent to the order page, which offers "Retry payment". Cancelling
 * the order automatically would be a worse default: a Paystack blip would
 * silently destroy a correct order, and the API's nightly sweep already returns
 * the stock of anything genuinely abandoned.
 */

export interface CheckoutState {
  error?: string;
  /** True when the failure is about the basket's contents, not the account. */
  reviewCart?: boolean;
  /** True when the account's email needs verifying before checkout is allowed. */
  needsVerification?: boolean;
}

export async function placeOrder(
  _previous: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Fcheckout");

  const addressId = String(formData.get("addressId") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!addressId) return { error: "Choose a delivery address." };
  if (!idempotencyKey) {
    // Never generated server-side as a fallback — see the module header. A
    // missing key means the form did not render properly, and a fresh key would
    // convert a double submit into a double order.
    return { error: "Something went wrong with this form. Reload the page and try again." };
  }

  // 1. Fresh view of the basket.
  const cart = await loadCart();
  if (cart.error) {
    return { error: shopperMessage(cart.error) };
  }
  if (cart.lines.length === 0) {
    return { error: "Your basket is empty.", reviewCart: true };
  }
  if (cart.hasProblems) {
    return {
      error:
        "Something in your basket changed while you were checking out. Review it and try again.",
      reviewCart: true,
    };
  }

  const ctx = { config: apiConfig, accessToken: session.accessToken };

  // 2. The order. Stock is decremented inside this call.
  const order = await orders.create(
    ctx,
    {
      addressId,
      items: toOrderItems(cart),
      ...(notes ? { notes: notes.slice(0, 500) } : {}),
    },
    idempotencyKey,
  );

  if (!order.ok) {
    if (orders.isEmailUnverified(order.error)) {
      return {
        error:
          "Confirm your email address before checking out — we've sent you a link, and you can ask for another below.",
        needsVerification: true,
      };
    }
    if (orders.isLineItemProblem(order.error)) {
      // The API does not say WHICH line failed, so the honest move is to send
      // the shopper back to a basket that re-reads everything and marks the
      // offending line itself. Guessing here would name the wrong product.
      return {
        error: `${order.error.message} Your basket has been rechecked — the item is marked there.`,
        reviewCart: true,
      };
    }
    return { error: shopperMessage(order.error) };
  }

  // 3. The order owns these items now.
  await clearCart();

  // 4. Start the charge. `APP_ORIGIN`, never the request's Host: a Worker behind
  // a proxy sees whatever Host the proxy sent, and getting this wrong sends a
  // customer who has just paid to somebody else's domain.
  const init = await payments.initialize(
    ctx,
    order.data.id,
    `${appOrigin()}/checkout/callback?orderId=${encodeURIComponent(order.data.id)}`,
  );

  revalidatePath("/account/orders");

  if (!init.ok) {
    // The order stands. Send them to it rather than leaving them on a checkout
    // form for a basket that no longer exists — that page can explain the state
    // and offer a retry.
    redirect(`/account/orders/${order.data.id}?payment=failed`);
  }

  // 5. Off to Paystack. A top-level navigation, so the session cookie's
  // `SameSite=Lax` is what brings the shopper back signed in.
  redirect(init.data.authorizationUrl);
}

/**
 * "Retry payment", from an order page.
 *
 * Deliberately a separate, explicit action rather than something automatic:
 * `POST /payments/initialize` has no idempotency guard, so each call is a new
 * Paystack transaction. A retry must be something a person chose.
 */
export async function retryPayment(orderId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect(`/login?next=%2Faccount%2Forders%2F${orderId}`);

  const init = await payments.initialize(
    { config: apiConfig, accessToken: session.accessToken },
    orderId,
    `${appOrigin()}/checkout/callback?orderId=${encodeURIComponent(orderId)}`,
  );

  if (!init.ok) redirect(`/account/orders/${orderId}?payment=failed`);
  redirect(init.data.authorizationUrl);
}

/**
 * What the payment for an order looks like right now. Polled by the callback page.
 *
 * ## A Server Action, because the browser may not call the API
 *
 * The callback page needs to poll, and polling is a client-side loop — but under
 * the BFF the browser has no token and the API's production CORS list is empty.
 * So the loop calls this, which holds the session cookie. `lib/api.ts` being
 * `server-only` makes the alternative a build error rather than a launch-day
 * CORS failure.
 *
 * ## `null` means "no payment row yet", which is not an error
 *
 * The API 404s when no payment exists for an order — which is what a shopper who
 * closed the Paystack tab before it was created gets. That is a legitimate
 * waiting state, not a failure, so it is `null` here and the poller keeps
 * waiting rather than showing an error.
 */
export async function checkPaymentStatus(
  orderId: string,
): Promise<{ status: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | null; unreachable: boolean }> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Forders");

  const result = await payments.getStatus(
    { config: apiConfig, accessToken: session.accessToken },
    orderId,
  );

  if (result.ok) return { status: result.data.status, unreachable: false };

  // A 404 is "not yet"; anything else transport-shaped is "we couldn't ask".
  // The poller treats them differently: it keeps waiting on the first and stops
  // pestering the API on the second.
  const notYet = result.error.kind === "http" && result.error.status === 404;
  return { status: null, unreachable: !notYet };
}

/** Cancels an unpaid order and returns its stock to the pool. */
export async function cancelOrder(orderId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect(`/login?next=%2Faccount%2Forders%2F${orderId}`);

  await orders.cancel({ config: apiConfig, accessToken: session.accessToken }, orderId);

  revalidatePath(`/account/orders/${orderId}`);
  revalidatePath("/account/orders");
}
