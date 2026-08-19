import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";
import type { ProductStatus } from "@rimalis/types";
import {
  Badge,
  ButtonLink,
  Pagination,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableShell,
} from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import { FilterBar, StatusTabs, productStatus } from "@/components/admin";
import { admin, categories, ctxFor, requireAdmin } from "@/lib/auth";
import { badgeTone, relativeTime } from "@/lib/format";
import { formatMoney, formatNaira, parseMoney, subtract } from "@/lib/money";
import { buildCategoryTree, flattenTree } from "@/lib/category-tree";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Products" };

const STATUSES = ["DRAFT", "AVAILABLE", "UNAVAILABLE"] as const;

/**
 * The central product pool.
 *
 * ## The margin column is the point of this screen
 *
 * Retail minus cost is what a vendor earns before commission, and commission is
 * charged on it — so this column, set by an admin, decides whether carrying a
 * product is worth a vendor's money at all. It is computed here rather than shown as
 * two prices to compare, because comparing two currency-formatted numbers down a
 * table is exactly the arithmetic a screen should do for you.
 *
 * Summed with the branded kobo helpers, never `parseFloat`: a `Money` is a decimal
 * string with trailing zeros stripped, so `"175000"` and `"175000.00"` are the same
 * amount and `!==`.
 *
 * ## `stock` here is the PLATFORM's pool
 *
 * Not what any vendor can sell. It moves only on a stock purchase or an admin
 * adjustment, and a sale never touches it. The column is labelled "Pool" for that
 * reason — "Stock" would read as availability.
 *
 * Tinted `danger` at or below the product's OWN `lowStockAt`, which is per-product
 * rather than a global five.
 *
 * ## Two calls, one guard
 *
 * The category filter needs the taxonomy, so the list and `categories.listAll` run
 * under one `Promise.all` behind a single `requireAdmin`.
 */
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = oneOf<ProductStatus>(params["status"], STATUSES);
  const search = optional(params["search"]);
  const categoryId = optional(params["categoryId"]);
  const includeDeleted = oneOf(params["includeDeleted"], ["true"] as const);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/products");
  const ctx = ctxFor(session);

  const [result, categoryResult] = await Promise.all([
    admin.listProducts(ctx, {
      ...(status !== undefined ? { status } : {}),
      ...(search !== undefined ? { search } : {}),
      ...(categoryId !== undefined ? { categoryId } : {}),
      ...(includeDeleted !== undefined ? { includeDeleted: true } : {}),
      page,
    }),
    categories.listAll(ctx),
  ]);

  const categoryOptions = categoryResult.ok
    ? flattenTree(buildCategoryTree(categoryResult.data).roots).map(
        ({ category, depth }) => ({
          value: category.id,
          // U+00A0 as an ESCAPE, not a literal: an ordinary run of spaces collapses
          // to one inside an <option>, and a literal non-breaking space in source is
          // invisible to a reader and easily destroyed by a reformat.
          label: `${"\u00A0\u00A0\u00A0".repeat(depth)}${category.name}`,
        }),
      )
    : [];

  const urlParams = { status, search, categoryId, includeDeleted };
  const filtered = Object.values(urlParams).some((v) => v !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading font-semibold tracking-tight">Products</h1>
          <p className="text-body text-ink-muted">
            The pool vendors buy from. One retail price per product, shared by every
            store that carries it.
          </p>
        </div>
        <ButtonLink href="/products/new">New product</ButtonLink>
      </div>

      <StatusTabs
        basePath="/products"
        param="status"
        current={status}
        params={urlParams}
        tabs={[
          { label: "All" },
          { value: "DRAFT", label: "Draft" },
          { value: "AVAILABLE", label: "In pool" },
          { value: "UNAVAILABLE", label: "Withdrawn" },
        ]}
      />

      <FilterBar
        basePath="/products"
        active={filtered}
        fields={[
          {
            name: "search",
            label: "Search",
            value: search,
            grow: true,
            placeholder: "Name or SKU",
          },
          {
            name: "categoryId",
            label: "Category",
            value: categoryId,
            options: categoryOptions,
          },
          {
            name: "includeDeleted",
            label: "Deleted",
            value: includeDeleted,
            // Only one option plus the empty "any": the API's flag is
            // include-or-not, so "exclude deleted" is the absence of the parameter
            // rather than a second value.
            options: [{ value: "true", label: "Include deleted" }],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load products" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<Package className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered,
            total: result.meta?.total ?? 0,
            page,
            noun: "products",
            genuinelyEmpty:
              "Add the first product above. Vendors cannot create products — they buy stock of what is in this pool.",
          })}
          {...(filtered ? {} : { action: { label: "New product", href: "/products/new" } })}
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH>Status</TH>
                  <TH align="end" priority="secondary">
                    Cost
                  </TH>
                  <TH align="end" priority="secondary">
                    Retail
                  </TH>
                  <TH align="end">Margin</TH>
                  <TH align="end">Pool</TH>
                  <TH align="end" priority="secondary">
                    Updated
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.data.map((product) => {
                  const presentation = productStatus(product.status);
                  const margin = subtract(
                    parseMoney(product.retailPrice),
                    parseMoney(product.costPrice),
                  );
                  const low = product.stock <= product.lowStockAt;
                  return (
                    <TR key={product.id}>
                      <TD>
                        <Link
                          href={`/products/${product.id}`}
                          prefetch={false}
                          className="flex flex-col rounded-input font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {product.name}
                          <span className="font-mono text-meta font-normal text-ink-subtle">
                            {product.sku}
                            {product.category !== null && ` · ${product.category.name}`}
                          </span>
                        </Link>
                      </TD>
                      <TD>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge tone={badgeTone(presentation.tone)}>
                            {presentation.label}
                          </Badge>
                          {product.deletedAt !== null && (
                            <Badge tone="danger">Deleted</Badge>
                          )}
                          {product.images.length === 0 && (
                            // Cannot be published without one, so it is worth
                            // seeing before opening the product.
                            <Badge tone="neutral">No image</Badge>
                          )}
                        </span>
                      </TD>
                      <TD align="end" priority="secondary">
                        {formatMoney(product.costPrice)}
                      </TD>
                      <TD align="end" priority="secondary">
                        {formatMoney(product.retailPrice)}
                      </TD>
                      <TD align="end">
                        {/* A kobo integer from `subtract`, so `formatNaira` — the
                            branded Minor type makes reaching for formatMoney here a
                            compile error rather than a figure out by 100. */}
                        {formatNaira(margin)}
                      </TD>
                      <TD align="end" className={low ? "text-danger" : undefined}>
                        {product.stock}
                        {low && (
                          <span className="ml-1 text-meta">
                            {`≤${String(product.lowStockAt)}`}
                          </span>
                        )}
                      </TD>
                      <TD align="end" priority="secondary">
                        <span className="text-ink-muted">
                          {relativeTime(product.updatedAt)}
                        </span>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </TableShell>

          {result.meta && (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              hrefForPage={(target) => hrefForPage("/products", urlParams, target)}
            />
          )}
        </>
      )}
    </div>
  );
}
