import type {
  Address,
  CreateAddressBody,
  UpdateAddressBody,
  UpdateProfileBody,
  User,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { Result } from "./result";

/**
 * The signed-in shopper's own profile and addresses. Every call needs a token.
 *
 * Nothing here takes a user id. All five endpoints are `/users/me...` and scope
 * themselves to the token's subject server-side, which is why there is no way to
 * ask this module for somebody else's data and therefore no way to get the
 * authorisation check wrong at a call site.
 */

/**
 * `GET /users/me` — the live profile.
 *
 * Prefer this over `auth.me()` for anything rendered. `auth.me()` reads the JWT
 * without touching the database, so it is cheap and up to 15 minutes stale, and
 * it has no `isVerified` — which is the field checkout depends on.
 */
export const getProfile = (ctx: RequestContext): Promise<Result<User>> =>
  request({ ...ctx, path: "/users/me" });

export const updateProfile = (
  ctx: RequestContext,
  body: UpdateProfileBody,
): Promise<Result<User>> => request({ ...ctx, method: "PATCH", path: "/users/me", body });

/**
 * `GET /users/me/addresses` — an ARRAY.
 *
 * ⚠️ The API's own OpenAPI document declares this as a single `Address`, and it
 * is wrong: `listAddresses` in the users controller passes the array from the
 * service straight to `sendSuccess`. This is the same class of documentation bug
 * that `@rimalis/types` found three of in the catalogue endpoints — a generated
 * spec proves the *request* validation, never the response shape, because
 * nothing on that side compares a declared envelope to a real body.
 *
 * Not paginated, so there is no `meta`. Sorted with the default first.
 */
export const listAddresses = (ctx: RequestContext): Promise<Result<Address[]>> =>
  request({ ...ctx, path: "/users/me/addresses" });

/**
 * Adds an address.
 *
 * Passing `isDefault: true` clears the flag on every other address **in the same
 * transaction**. Do not follow this with a PATCH on the previous default to
 * "keep them in step" — that races with the write that already happened.
 */
export const createAddress = (
  ctx: RequestContext,
  body: CreateAddressBody,
): Promise<Result<Address>> =>
  request({ ...ctx, method: "POST", path: "/users/me/addresses", body });

export const updateAddress = (
  ctx: RequestContext,
  id: string,
  body: UpdateAddressBody,
): Promise<Result<Address>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/users/me/addresses/${encodeURIComponent(id)}`,
    body,
  });

/**
 * Deletes an address.
 *
 * ⚠️ Answers **204 No Content** — no envelope, no body. This is the only
 * endpoint in the API that does, and it is the reason `http.ts` special-cases
 * 204 before it parses: `res.json()` on an empty body rejects, which would have
 * been reported as a `malformed` failure on a delete that in fact succeeded.
 * `data` is therefore `undefined` here and the caller checks `ok` alone.
 *
 * An order that referenced this address keeps working: `Order.addressId` becomes
 * `null` and `OrderDetail.address` comes back absent, which is why the order
 * page renders "address no longer available" rather than assuming one exists.
 */
export const deleteAddress = (ctx: RequestContext, id: string): Promise<Result<unknown>> =>
  request({
    ...ctx,
    method: "DELETE",
    path: `/users/me/addresses/${encodeURIComponent(id)}`,
  });
