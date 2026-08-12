/**
 * Shared DTOs mirroring the rimalis-api contract.
 *
 * ## How these were produced, and how to extend them
 *
 * Transcribed from `rimalis-api/openapi.json` — which is generated from the
 * Zod schemas that actually validate the requests, so it cannot drift from the
 * code — and then **checked against live responses**. Both halves were
 * necessary: three shapes in that document were wrong when this was written
 * (`data` typed as one `Category` where an array is returned; a bare array where
 * `{ vendor, items }` is returned; and one schema shared by the browse and
 * detail endpoints, which differ). See the rimalis-api commit
 * `fix(docs): correct three response shapes the OpenAPI document got wrong`,
 * which fixed the document rather than working around it.
 *
 * The lesson for whoever adds the next module: read the document, then curl the
 * endpoint. A generated spec proves the request validation is accurate. It does
 * not prove the response shape is, because nothing on that side compares a
 * generated envelope to a real body.
 *
 * ## Why hand-written rather than generated
 *
 * ADR-0001. A generator would emit every admin and vendor DTO as well, and the
 * comments are the actual value here — `MarketplaceListing.id` vs `product.id`,
 * `minPrice=0` being a 400 rather than "no minimum", `images` being possibly
 * empty. None of that survives codegen, and all of it is what a caller gets
 * wrong.
 *
 * ## Layout
 *
 *   common.ts    the envelope, `Money`, pagination — the stable core
 *   catalog.ts   categories, products, listings, storefronts (public)
 *   auth.ts      accounts, sessions, addresses
 *   commerce.ts  orders and payments
 *   vendor.ts    a seller's own store, listings, orders and settlements
 *
 * `auth.ts` and `commerce.ts` were transcribed the same way as `catalog.ts` —
 * document first, live response second — and the same class of documentation bug
 * turned up again: `GET /users/me/addresses` is declared as returning a single
 * `Address` where it returns an array (see `listAddresses` in the API's own
 * controller, which passes the array straight through). The type here follows
 * the code, not the document.
 */

export * from "./common";
export * from "./catalog";
export * from "./auth";
export * from "./commerce";
export * from "./vendor";
