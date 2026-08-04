import type { ProductAttribute } from "@digistore/types";

/**
 * Product specifications.
 *
 * A `<dl>` because that is what this is — name/value pairs — and it is announced
 * as a description list with a count. A grid of divs looks identical and tells a
 * screen-reader user nothing about the structure.
 *
 * Returns `null` on an empty array rather than an empty-state block. An absent
 * specification table is not a state worth explaining to a shopper: it is a
 * product whose vendor did not fill one in, and a box saying "No specifications"
 * is noise where silence is correct. This is the exception to "every surface gets
 * an empty state" — the rule is about surfaces a shopper navigated *to*, not
 * about optional sections within one.
 *
 * ⚠️ Only available on `GET /marketplace/products/:id`. `attributes` is **absent**
 * from browse rows, which is why the DTO is a separate `MarketplaceListingDetail`
 * type — passing a grid row's product here is a compile error rather than an
 * empty table.
 */

export function AttributeList({ attributes }: { attributes: readonly ProductAttribute[] }) {
  if (attributes.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-caption font-semibold text-ink">Specifications</h2>
      <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {attributes.map((attribute) => (
          // The wrapper keeps each pair together when the grid wraps; without it
          // a two-column layout can put a name in one column and its value in
          // the other.
          <div
            key={attribute.id}
            className="flex justify-between gap-4 border-b border-divider py-3"
          >
            <dt className="text-body text-ink-muted">{attribute.name}</dt>
            <dd className="text-right text-body text-ink">{attribute.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
