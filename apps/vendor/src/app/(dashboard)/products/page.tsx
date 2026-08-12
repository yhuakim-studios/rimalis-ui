import type { Metadata } from "next";
import Link from "next/link";
import { PackageOpen, Plus } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/feedback";
import { ListingCard } from "@/components/products";
import { ButtonLink, Card, Pagination, cn } from "@/components/primitives";
import { ctxFor, requireApprovedVendor, vendor as vendorApi } from "@/lib/auth";
import { pluralise } from "@/lib/format";

export const metadata: Metadata = { title: "Products" };

const PAGE_SIZE = 20;

/**
 * This vendor's listings.
 *
 * ## Three views, one endpoint
 *
 * `GET /vendor/products` takes `isActive` and `includeDeleted`, which gives:
 *
 *   Live         isActive=true                on the marketplace now
 *   Off          isActive=false               kept, but hidden from shoppers
 *   Removed      includeDeleted=true          soft-deleted, restorable
 *
 * "Removed" is the one that matters: without `includeDeleted` a soft-deleted listing
 * simply vanishes and the vendor has no way to get it back from the UI, even though
 * `PATCH /:id/restore` exists. A delete that cannot be undone through the interface
 * is an irreversible delete in practice.
 *
 * ⚠️ `includeDeleted=true` returns **both** deleted and live rows, not only deleted
 * ones — so the Removed view filters client-side for `deletedAt !== null`. That is not
 * a preference: there is no `deletedOnly` parameter, and rendering the raw response
 * would show every live listing under a heading that says Removed.
 *
 * ## "Add a product" adds a LISTING, and the copy has to keep saying so
 *
 * `POST /vendor/products` needs a `productId` from the **admin-managed pool** — a
 * vendor cannot create a product, only carry one that exists. So the button goes to
 * `/products/add`, which browses that pool via
 * `GET /vendor/products/catalogue`; it is not a product form and must never grow
 * into one. Until that endpoint existed there was no vendor-readable view of the
 * catalogue at all, which is why this page previously carried a note instead of a
 * button.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string }>;
}) {
  const { view, page: pageParam } = await searchParams;
  const { session } = await requireApprovedVendor("/products");

  const parsed = Number.parseInt(pageParam ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;

  const filters =
    view === "off"
      ? { isActive: false }
      : view === "removed"
        ? { includeDeleted: true }
        : { isActive: true };

  const result = await vendorApi.listListings(ctxFor(session), {
    page,
    limit: PAGE_SIZE,
    ...filters,
  });

  // See the header: `includeDeleted` widens the result rather than narrowing it.
  const listings = result.ok
    ? view === "removed"
      ? result.data.filter((listing) => listing.deletedAt !== null)
      : result.data
    : [];

  const VIEWS = [
    { key: undefined, label: "Live" },
    { key: "off", label: "Switched off" },
    { key: "removed", label: "Removed" },
  ] as const;

  const hrefForPage = (target: number) => {
    const query = new URLSearchParams();
    if (view) query.set("view", view);
    if (target > 1) query.set("page", String(target));
    const suffix = query.toString();
    return suffix ? `/products?${suffix}` : "/products";
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading font-semibold tracking-tight">Products</h1>
          <p className="text-caption text-ink-muted">
            Your price and stock cap for each product you carry.
          </p>
        </div>
        <ButtonLink
          href="/products/add"
          icon={<Plus className="size-5" strokeWidth={2} aria-hidden />}
        >
          Add a product
        </ButtonLink>
      </div>

      <nav aria-label="Filter listings" className="flex gap-1 border-b border-divider">
        {VIEWS.map((item) => {
          const isActive = (view ?? undefined) === item.key;
          return (
            <Link
              key={item.label}
              href={item.key ? `/products?view=${item.key}` : "/products"}
              prefetch={false}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2.5 text-caption transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                isActive
                  ? "border-brand-600 font-semibold text-ink"
                  : "border-transparent text-ink-muted hover:border-divider-strong hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {!result.ok ? (
        <Card padding="lg">
          <ErrorState error={result.error} title="We couldn't load your listings" />
        </Card>
      ) : listings.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<PackageOpen className="size-6" strokeWidth={1.5} />}
            title={
              view === "removed"
                ? "Nothing removed"
                : view === "off"
                  ? "Nothing switched off"
                  : "No live listings"
            }
            body={
              view
                ? "Your live listings are on the first tab."
                : "Listings come from the Rimalis product catalogue — you choose which products to carry and set your own price and stock cap for each."
            }
            action={
              view
                ? { label: "See live listings", href: "/products" }
                : { label: "Browse the catalogue", href: "/products/add" }
            }
          />
        </Card>
      ) : (
        <>
          <p className="text-meta text-ink-subtle">
            {view === "removed"
              ? pluralise(listings.length, "removed listing")
              : pluralise(result.meta.total, "listing")}
          </p>

          <ul className="flex flex-col gap-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </ul>

          {/*
            Hidden on the Removed view. Its rows were filtered client-side, so
            `meta.total` counts rows this page did not show — a pager built on it would
            offer page 2 of a set that does not exist in this shape. See the header.
          */}
          {view !== "removed" && (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              hrefForPage={hrefForPage}
            />
          )}
        </>
      )}
    </div>
  );
}
