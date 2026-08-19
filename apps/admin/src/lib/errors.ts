import type { ApiError } from "@rimalis/api-client";

/**
 * "This resource is missing" versus "something went wrong".
 *
 * ## The bug this exists for
 *
 * `admin.isNotFound()` checks for a 404, which is right for an id that is
 * well-formed and absent. But a **malformed** id — `/vendors/not-a-uuid`, which is
 * what a truncated paste or a hand-edited URL produces — is rejected by the API's
 * Zod param schema as a **400 "Validation failed"**. That is not a 404, so the
 * detail screen fell through to `ErrorState` and told the admin something had gone
 * wrong on our side.
 *
 * It had not. An id that cannot exist is an id that does not exist, and the honest
 * answer is the same not-found screen. The distinction `ErrorState` exists to
 * protect — a transport failure must never borrow a 404's copy — cuts the other way
 * here: a 404's cause must not borrow a transport failure's copy either, because
 * "something went wrong, try again" invites an admin to retry a URL that will
 * never work.
 *
 * ## Why a 400 is safe to read this way on a detail route, and only there
 *
 * A detail page sends exactly one piece of input: the id in the path. So a 400
 * from `GET /vendors/:id` can only be about that id. On a LIST route the same
 * status could mean a bad filter, a bad page number or a bad date, and collapsing
 * those into "not found" would hide a fixable mistake — which is why this helper is
 * named for detail routes and must not be reached for on a list.
 */
export function isMissing(error: ApiError): boolean {
  if (error.kind !== "http") return false;
  // 404: well-formed id, no such row.
  // 400: the id itself is not a valid id, so no such row can exist.
  return error.status === 404 || error.status === 400;
}
