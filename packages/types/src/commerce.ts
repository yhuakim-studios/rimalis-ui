import type { Address } from "./auth";
import type { IsoDateTime, Money, Uuid } from "./common";

/**
 * Orders and payments — the transactional half of the contract.
 *
 * ## There is no server-side cart
 *
 * Checkout is stateless: the client sends the whole basket to `POST /orders` in
 * one request and the order is built in a single transaction. There is no cart
 * resource to create, sync or reconcile, which is why the marketplace keeps its
 * basket in a cookie and why nothing in this module describes one.
 *
 * ## The client sends quantities. It never sends money.
 *
 * `CreateOrderBody` carries `{ vendorProductId, quantity }` and nothing else.
 * Unit price, commission rate, vendor payout and the product's name and SKU are
 * all snapshotted server-side from the API's own database at the moment the
 * order is written. There is no field in this module — or anywhere in the API —
 * into which a client-computed amount could be placed, and that is deliberate:
 * an endpoint that accepted a price would be a way to buy a television for one
 * naira.
 *
 * The corollary is that a total shown before checkout is an *estimate* rendered
 * from live listing prices. If a vendor repriced a listing between the cart
 * render and the submit, the order comes back with the new price. The cart UI
 * therefore re-reads listings on every render rather than trusting anything it
 * stored.
 */

/**
 * The order's own status.
 *
 * `PROCESSING`, `SHIPPED` and `DELIVERED` are a **rollup** computed from the
 * items' `fulfillmentStatus` and cannot be set directly — which is the whole
 * point on a multi-vendor order, where one parcel can ship while another has not
 * been picked. A UI that wants to say "1 of 2 shipped" reads the items, not this.
 */
export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

/** Per-line, per-vendor progress. Set by the vendor app, read here. */
export type FulfillmentStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED";

export interface Order {
  id: Uuid;
  customerId: Uuid;
  /** `null` if the address was deleted after the order was placed. */
  addressId: Uuid | null;
  status: OrderStatus;
  subtotal: Money;
  shippingTotal: Money;
  discountTotal: Money;
  /** What was charged. The only total worth showing beside the order. */
  grandTotal: Money;
  /** The Paystack reference, once a charge has been initialised. */
  paymentRef: string | null;
  idempotencyKey: Uuid | null;
  notes: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface OrderItem {
  id: Uuid;
  orderId: Uuid;
  /** The LISTING id — the same id the catalogue and the cart use. */
  vendorProductId: Uuid;
  vendorId: Uuid;
  productId: Uuid;
  quantity: number;
  fulfillmentStatus: FulfillmentStatus;
  unitPrice: Money;
  totalPrice: Money;
  /**
   * What the VENDOR paid the platform per unit, frozen at order time.
   *
   * A vendor's real profit on a line is `vendorPayout − totalCost`, NOT
   * `vendorPayout` — they had already spent `totalCost` to hold the stock.
   * Any earnings figure that omits it overstates what the vendor made.
   */
  unitCost: Money;
  totalCost: Money;
  /** `totalPrice − totalCost`, floored at 0. What commission is charged on. */
  marginAmount: Money;
  /** A rate, e.g. `0.1`. A genuine number — see the money rule in `common.ts`. */
  commissionRate: number;
  /**
   * `marginAmount × commissionRate` — charged on the vendor's MARGIN, not on
   * revenue.
   *
   * ⚠️ On items created before the wholesale migration this will not reconcile
   * with `marginAmount`: those lines were charged on the full sale price under
   * the old rules, and `marginAmount` on them is a backfilled estimate.
   */
  commissionAmount: Money;
  /**
   * `totalPrice − commissionAmount`. What reaches the vendor's subaccount, and
   * the figure the Paystack split is built from — so
   * `commissionAmount + vendorPayout === totalPrice` exactly, always.
   */
  vendorPayout: Money;
  /**
   * ⚠️ **Render this, not a live product name.**
   *
   * Frozen at order time. The product may since have been renamed, withdrawn or
   * deleted, and a historical order that changes its own contents when an admin
   * edits the catalogue is not a record of anything. There is deliberately no
   * embedded `product` object on an order item to reach for instead.
   */
  productNameSnapshot: string;
  productSkuSnapshot: string;
  createdAt: IsoDateTime;
}

/**
 * `GET /orders/:id`, `POST /orders`, `POST /orders/:id/cancel`.
 *
 * `address` is the shipping address **as it is now**, not a snapshot — it is
 * `null` when the shopper has since deleted it. Unlike the item snapshots, the
 * API does not freeze it, so an order page must handle its absence rather than
 * assume every order can show where it went.
 */
export interface OrderDetail extends Order {
  items: OrderItem[];
  address?: Address | null;
  /** Present once a charge has been initialised. Shape as `Payment` below. */
  payment?: Payment | null;
}

export interface CreateOrderItem {
  /** `MarketplaceListing.id` — the listing, never `product.id`. */
  vendorProductId: Uuid;
  /** A positive integer. The API rejects 0 and fractions. */
  quantity: number;
}

export interface CreateOrderBody {
  addressId: Uuid;
  /**
   * 1–50 lines. **Duplicate `vendorProductId`s are rejected, not merged** — a
   * silent merge would make the order total disagree with what the shopper saw,
   * so the cart must deduplicate before it submits.
   */
  items: CreateOrderItem[];
  /** Up to 500 characters of delivery instructions. */
  notes?: string;
}

export interface ListOrdersQuery {
  page?: number;
  /** 1–100. Out of range is a 400, not a clamp. */
  limit?: number;
  status?: OrderStatus;
}

export type PaymentProvider = "PAYSTACK" | "FLUTTERWAVE";

/**
 * `PENDING` until the **webhook** settles it.
 *
 * A shopper returning from Paystack to the callback URL proves only that a
 * browser came back — they may have closed the tab on the success screen, or
 * hit back before paying. The authoritative transition is made server-side when
 * Paystack calls the API's webhook, which is usually within a second or two of
 * the charge but is not synchronous with the redirect. So a callback page polls;
 * it never concludes.
 */
export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export interface Payment {
  id: Uuid;
  orderId: Uuid;
  provider: PaymentProvider;
  /** Paystack's reference, `ord_<orderId>_<8 hex>`. Worth showing on a receipt. */
  reference: string;
  amount: Money;
  /** ISO 4217, `NGN` today. */
  currency: string;
  status: PaymentStatus;
  /** The raw provider payload, kept verbatim for debugging. Never rendered. */
  providerPayload?: unknown;
  paidAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** `POST /payments/initialize` — where to send the shopper. */
export interface PaymentInit {
  /** Redirect here. A top-level navigation, not a fetch. */
  authorizationUrl: string;
  /** For Paystack's inline widget, which this app does not use. */
  accessCode: string;
  reference: string;
}

export interface InitializePaymentBody {
  orderId: Uuid;
  /**
   * Where Paystack returns the shopper. Must be absolute.
   *
   * ⚠️ Two things depend on getting it right. It is interpolated from the app's
   * own `APP_ORIGIN`, so a wrong origin sends a customer who has just been
   * charged to another domain. And the return is a **cross-site top-level
   * navigation**, which a `SameSite=Strict` session cookie is not sent on — the
   * callback page would see a signed-out shopper holding a receipt. The
   * marketplace uses `SameSite=Lax` for exactly this reason.
   */
  callbackUrl?: string;
}
