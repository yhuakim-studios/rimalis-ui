import type {
  Category,
  CreateCategoryBody,
  UpdateCategoryBody,
} from "@rimalis/types";
import { request, type RequestContext } from "./http";
import type { Result } from "./result";

/**
 * The catalogue's category tree, unfiltered.
 *
 * ## Why this exists alongside `marketplace.listCategories()`
 *
 * They look interchangeable and are not. `GET /marketplace/categories` returns
 * only categories with **at least one publicly visible listing** (plus every
 * ancestor of those), which is exactly right for a storefront filter panel: a
 * shopper offered a category that yields an empty grid has been lied to.
 *
 * It is exactly wrong for the vendor catalogue browser. A category whose products
 * no vendor carries yet would be absent — and those are precisely the products a
 * vendor looking for something new to sell wants to find. Filtering them out of
 * the control makes part of the pool unreachable.
 *
 * `GET /categories` is the raw list: every category, including empty ones. The
 * trade is the mirror image — a vendor may pick a category and get no results —
 * which is the recoverable half of the pair.
 *
 * The read routes on that module are public; only its writes are admin-guarded.
 * It is flat and unpaginated, and unlike the marketplace variant it makes **no
 * connectedness guarantee** about `parentId` — every category is present, so the
 * set is trivially connected, but do not read that as a promise the endpoint
 * makes.
 */
export const listAll = (ctx: RequestContext): Promise<Result<Category[]>> =>
  request({ ...ctx, path: "/categories" });

/** `GET /categories/:id`. Public, like the list. */
export const get = (
  ctx: RequestContext,
  id: string,
): Promise<Result<Category>> =>
  request({ ...ctx, path: `/categories/${encodeURIComponent(id)}` });

// ---------------------------------------------------------------------------
// ADMIN WRITES
//
// These need an ADMIN token; the reads above need nothing. They live here rather
// than in `admin.ts` because this module already owns `/categories` and the admin
// console needs its reads anyway — splitting one resource's calls across two
// modules to satisfy a naming rule would cost more than the rule is worth.
//
// The taxonomy is small, shared and load-bearing: every product hangs off it and
// the storefront's filter panel is built from it. There is no soft delete here,
// which is why the two 409s below exist instead.
// ---------------------------------------------------------------------------

/**
 * `POST /categories`.
 *
 * Omit `parentId` for a top-level category. The slug is generated from the name.
 */
export const create = (
  ctx: RequestContext,
  body: CreateCategoryBody,
): Promise<Result<Category>> =>
  request({ ...ctx, method: "POST", path: "/categories", body });

/**
 * `PATCH /categories/:id`.
 *
 * `parentId: null` promotes to the top level; OMITTING it leaves the parent
 * unchanged. An empty `<select>` must therefore send nothing rather than an empty
 * string — the two mean different things and only one of them is what the admin
 * clicked.
 *
 * 400 `CATEGORY_CYCLE` when re-parenting a category under its own descendant.
 */
export const update = (
  ctx: RequestContext,
  id: string,
  body: UpdateCategoryBody,
): Promise<Result<Category>> =>
  request({
    ...ctx,
    method: "PATCH",
    path: `/categories/${encodeURIComponent(id)}`,
    body,
  });

/**
 * `DELETE /categories/:id` — 204, and a HARD delete.
 *
 * There is no `deletedAt` on a category, so this is irreversible. The API refuses
 * when anything depends on it: 409 `CATEGORY_HAS_PRODUCTS` or
 * `CATEGORY_HAS_CHILDREN`. Render those as the instruction they are — "reassign
 * its products first" — rather than as a failure.
 */
export const remove = (
  ctx: RequestContext,
  id: string,
): Promise<Result<undefined>> =>
  request({
    ...ctx,
    method: "DELETE",
    path: `/categories/${encodeURIComponent(id)}`,
  });
