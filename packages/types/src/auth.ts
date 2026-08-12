import type { IsoDateTime, Uuid } from "./common";

/**
 * Accounts, sessions and addresses.
 *
 * ## The shape of a session, and where it may live
 *
 * `POST /auth/login` and `POST /auth/register` both return an `AuthTokens` — a
 * 15-minute access token, a 7-day **single-use** refresh token, and a small user
 * summary. Under the BFF (see the header of `@rimalis/api-client`) none of that
 * ever reaches the browser: the marketplace app encrypts the pair into its own
 * `httpOnly` cookie and the browser holds an opaque blob.
 *
 * Which is why there is no `Session` type here. A session is the *app's* concept
 * — cookie name, encryption, expiry padding — and each of the three apps scopes
 * its own to its own subdomain on purpose. Putting it in a shared package is the
 * first step toward a shared cookie, which is the one thing ADR-0003 forbids.
 *
 * ## Refresh is single-use, and replay is treated as theft
 *
 * `POST /auth/refresh` deletes the token it was given and issues a new pair. A
 * token presented twice does not fail politely: the API destroys **every**
 * session for that user and answers `REFRESH_REUSE`. So a client must replace
 * the pair wholesale on every refresh and must never issue two refreshes
 * concurrently — see the note on the marketplace's middleware, which is the one
 * place that calls it.
 */

export type UserRole = "ADMIN" | "VENDOR" | "CUSTOMER";

export type VendorStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "REJECTED";

/**
 * The user summary returned alongside a token pair.
 *
 * Deliberately smaller than `User`: no `isVerified`, no `phone`, no timestamps.
 * A screen that needs those — the account page, the checkout verification gate —
 * must call `GET /users/me` rather than reach for a field that is not on this
 * shape. Modelling it as its own type is what makes that a compile error.
 */
export interface AuthUser {
  id: Uuid;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  /** Present only for vendor accounts, and irrelevant to the marketplace app. */
  vendorStatus?: VendorStatus | null;
}

export interface AuthTokens {
  user: AuthUser;
  /** JWT, 15 minutes. Sent as `Authorization: Bearer <token>`. */
  accessToken: string;
  /** JWT, 7 days, **single use**. See the module header. */
  refreshToken: string;
}

/** `POST /auth/refresh`. Note: no `user` — the caller keeps the one it has. */
export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * `GET /auth/me` — the access token's own claims, with no database read.
 *
 * Cheap, and up to 15 minutes stale. It cannot tell you whether the email has
 * been verified or whether an admin has just suspended the account, because it
 * never looks. For anything a screen renders, use `GET /users/me`.
 */
export interface AuthIdentity {
  id: Uuid;
  email: string;
  role: UserRole;
  vendorId?: Uuid;
}

/** `{ message }`. Every endpoint whose only job is to have happened. */
export interface MessageResponse {
  message: string;
}

/** `GET /users/me` — the live profile. */
export interface User {
  id: Uuid;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: UserRole;
  /**
   * Whether the email address has been confirmed.
   *
   * **This gates checkout, not sign-in.** `POST /orders` answers `403
   * EMAIL_NOT_VERIFIED` for an unverified account, and registration
   * deliberately returns a usable token pair so a new shopper can browse and
   * fill a cart while the mail is in flight. So the honest place to surface it
   * is the checkout page, not a wall in front of the whole app.
   */
  isVerified: boolean;
  isActive: boolean;
  /**
   * When the last verification mail went out, or `null`.
   *
   * The API enforces a **60 second per-account cooldown** off this column, on
   * top of a per-IP rate limit. A resend button that ignores it earns a 429; one
   * that reads it can disable itself and say when it will be ready.
   */
  verificationSentAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Address {
  id: Uuid;
  userId: Uuid;
  /** A shopper-supplied name — "Home", "Office". Optional, and often absent. */
  label: string | null;
  street: string;
  city: string;
  state: string;
  /** ISO 3166-1 alpha-2. The API defaults it to `NG`. */
  country: string;
  postalCode: string | null;
  /**
   * Exactly one address per user has this set, and the API maintains that
   * invariant itself — creating or updating with `isDefault: true` clears the
   * flag on the others. A client must not try to keep it in step by issuing a
   * second PATCH; it will race with the first.
   */
  isDefault: boolean;
  createdAt: IsoDateTime;
}

export interface RegisterBody {
  firstName: string;
  lastName: string;
  email: string;
  /** ≥8 characters, with at least one uppercase letter and one digit. */
  password: string;
  phone?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface UpdateProfileBody {
  firstName?: string;
  lastName?: string;
  /** 7–20 characters. Not validated as a phone number — the API takes it as text. */
  phone?: string;
}

export interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

export interface CreateAddressBody {
  label?: string;
  street: string;
  city: string;
  state: string;
  /** Exactly 2 characters. Defaults to `NG` server-side if omitted. */
  country?: string;
  postalCode?: string;
  isDefault?: boolean;
}

export type UpdateAddressBody = Partial<CreateAddressBody>;
