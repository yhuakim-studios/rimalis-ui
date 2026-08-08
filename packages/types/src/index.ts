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
 * ## What is deliberately absent
 *
 * The `auth`, `user`, `order` and `payment` DTOs land with the phases that use
 * them (2, 4, 5, 6). Writing them now would mean guessing nullability for
 * endpoints nothing calls yet, and a wrong guess is worse than an absence: an
 * absence is a compile error today, a wrong `| null` is a crash in production
 * months from now.
 */

export * from "./common";
export * from "./catalog";
