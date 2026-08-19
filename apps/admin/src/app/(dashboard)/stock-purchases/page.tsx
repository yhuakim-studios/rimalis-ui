import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import type { StockPurchaseStatus } from "@rimalis/types";
import {
  Badge,
  Card,
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
import { FilterBar, StatusTabs, stockPurchaseStatus } from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { absoluteDate, badgeTone } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Stock purchases" };

const STATUSES = ["PENDING", "SUCCESS", "FAILED", "ABANDONED"] as const;

/**
 * What vendors have paid the platform for pool stock.
 *
 * ## This is the platform's actual revenue, and it had no screen at all
 *
 * Under the prepaid wholesale model a vendor BUYS inventory at `costPrice` and
 * resells it. So these rows are cash the platform received directly — usually much
 * larger in total than commission on retail sales, which is charged only on the
 * vendor's margin. Before the `/admin/stock-purchases` endpoint added for this
 * console, the only way to see an individual payment was to query the database.
 *
 * ## Why PENDING rows are shown rather than filtered out, and flagged
 *
 * A PENDING purchase is **holding a reservation against `Product.stock`**. The
 * units are already deducted from the pool while the vendor sits on the Paystack
 * page, so a product can look out of stock while showing units on hand. That is
 * the single most confusing state in the catalogue and this list is where it
 * becomes visible — which is why `stockPurchaseStatus` gives PENDING the filled
 * pill rather than a neutral one.
 *
 * ABANDONED rows are swept by a job that returns the reservation, so a PENDING row
 * older than the grace period is worth a look.
 *
 * ## Read-only, permanently
 *
 * A purchase is opened by the vendor and completed by the Paystack webhook. There
 * is no endpoint to mark one paid and there must not be: it would credit a vendor
 * with stock nobody paid for, and there is no way to undo that from here.
 */
export default async function StockPurchasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = oneOf<StockPurchaseStatus>(params["status"], STATUSES);
  const vendorId = optional(params["vendorId"]);
  const from = optional(params["from"]);
  const to = optional(params["to"]);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/stock-purchases");
  const result = await admin.listStockPurchases(ctxFor(session), {
    ...(status !== undefined ? { status } : {}),
    ...(vendorId !== undefined ? { vendorId } : {}),
    ...(from !== undefined ? { from } : {}),
    ...(to !== undefined ? { to } : {}),
    page,
  });

  const urlParams = { status, vendorId, from, to };
  const filtered = Object.values(urlParams).some((v) => v !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">
          Stock purchases
        </h1>
        <p className="text-body text-ink-muted">
          Vendors buying inventory from the pool — money paid directly to the
          platform.
        </p>
      </div>

      <Card tone="flat">
        <p className="text-caption text-ink-muted">
          An <strong className="font-semibold text-ink">awaiting payment</strong>{" "}
          row is holding its units out of the pool while the vendor is on the
          Paystack page, so a product can read as out of stock while units still
          show against it. Unfinished purchases are swept and the reservation
          returned.
        </p>
      </Card>

      <StatusTabs
        basePath="/stock-purchases"
        param="status"
        current={status}
        params={urlParams}
        tabs={[
          { label: "All" },
          { value: "SUCCESS", label: "Paid" },
          { value: "PENDING", label: "Awaiting payment" },
          { value: "FAILED", label: "Failed" },
          { value: "ABANDONED", label: "Not completed" },
        ]}
      />

      <FilterBar
        basePath="/stock-purchases"
        active={filtered}
        fields={[
          {
            name: "vendorId",
            label: "Vendor id",
            value: vendorId,
            grow: true,
            // A raw id rather than a store-name search, because the endpoint takes
            // a uuid. The route in is the "Stock purchases" link on a vendor's
            // detail screen, not typing a uuid from memory.
            placeholder: "Paste a vendor id, or come from a vendor page",
          },
          { name: "from", label: "From", value: from, placeholder: "2026-08-01" },
          { name: "to", label: "To", value: to, placeholder: "2026-08-31" },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load stock purchases" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered,
            total: result.meta?.total ?? 0,
            page,
            noun: "stock purchases",
            genuinelyEmpty:
              "These appear when a vendor buys stock from the pool in the seller app.",
          })}
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Product</TH>
                  <TH priority="secondary">Vendor</TH>
                  <TH align="end">Units</TH>
                  <TH align="end" priority="secondary">
                    Unit cost
                  </TH>
                  <TH align="end">Paid</TH>
                  <TH>Status</TH>
                  <TH align="end" priority="secondary">
                    Opened
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.data.map((purchase) => {
                  const presentation = stockPurchaseStatus(purchase.status);
                  return (
                    <TR key={purchase.id}>
                      <TD>
                        <Link
                          href={`/products/${purchase.product.id}`}
                          prefetch={false}
                          className="flex flex-col rounded-input font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {purchase.product.name}
                          <span className="font-mono text-meta font-normal text-ink-subtle">
                            {purchase.product.sku}
                          </span>
                        </Link>
                      </TD>
                      <TD priority="secondary">
                        <Link
                          href={`/vendors/${purchase.vendor.id}`}
                          prefetch={false}
                          className="rounded-input text-ink-muted hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {purchase.vendor.storeName}
                        </Link>
                      </TD>
                      <TD align="end">{purchase.quantity}</TD>
                      <TD align="end" priority="secondary">
                        {formatMoney(purchase.unitCost)}
                      </TD>
                      <TD align="end">{formatMoney(purchase.totalCost)}</TD>
                      <TD>
                        <Badge tone={badgeTone(presentation.tone)}>
                          {presentation.label}
                        </Badge>
                      </TD>
                      <TD align="end" priority="secondary">
                        <span className="text-ink-muted">
                          {absoluteDate(purchase.createdAt)}
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
              hrefForPage={(target) =>
                hrefForPage("/stock-purchases", urlParams, target)
              }
            />
          )}
        </>
      )}
    </div>
  );
}
