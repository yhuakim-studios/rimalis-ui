import type { Category } from "@rimalis/types";
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
