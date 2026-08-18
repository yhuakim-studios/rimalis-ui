import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";
import type { VendorStatus } from "@rimalis/types";
import {
  Badge,
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
import { FilterBar, StatusTabs, vendorStatus } from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { badgeTone, absoluteDate } from "@/lib/format";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Vendors" };

const STATUSES = ["PENDING", "APPROVED", "SUSPENDED", "REJECTED"] as const;

/**
 * Every seller on the platform, and the approval queue.
 *
 * ## The one column that is not obvious: "Payouts"
 *
 * It reports whether `paystackSubaccountCode` is set, and its absence is a
 * `danger` badge rather than an empty cell — because a vendor with no subaccount
 * is **unsellable in a way nothing else on this screen reveals**. Checkout refuses
 * to build a Paystack split without it and returns 409, so every order containing
 * their items fails at payment. They look approved, they have active listings, and
 * nobody can buy from them.
 *
 * That is the single most valuable thing an admin can learn from a vendor list, so
 * it is a column rather than something to discover on the detail page.
 *
 * ## Commission shows the override, or says the ladder decides
 *
 * `commissionRateOverride` is `null` for most vendors and that does NOT mean the
 * platform default — it means the referral ladder resolves the rate, which differs
 * per vendor by how many recruits they have qualified. Printing "10%" here for a
 * null would be wrong for every vendor who has recruited anyone, so a null renders
 * as "Tier" and the detail screen explains it.
 */
export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = oneOf<VendorStatus>(params["status"], STATUSES);
  const search = optional(params["search"]);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/vendors");
  const result = await admin.listVendors(ctxFor(session), {
    ...(status !== undefined ? { status } : {}),
    ...(search !== undefined ? { search } : {}),
    page,
  });

  const urlParams = { status, search };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Vendors</h1>
        <p className="text-body text-ink-muted">
          Approve applications, and step in when a store needs stopping.
        </p>
      </div>

      <StatusTabs
        basePath="/vendors"
        param="status"
        current={status}
        params={urlParams}
        tabs={[
          { label: "All" },
          { value: "PENDING", label: "Awaiting review" },
          { value: "APPROVED", label: "Approved" },
          { value: "SUSPENDED", label: "Suspended" },
          { value: "REJECTED", label: "Rejected" },
        ]}
      />

      <FilterBar
        basePath="/vendors"
        active={status !== undefined || search !== undefined}
        fields={[
          {
            name: "search",
            label: "Search",
            value: search,
            grow: true,
            // Naming the email is the point: a support ticket arrives as an email
            // address, never as a store name.
            placeholder: "Store name, business name or owner's email",
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load vendors" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<Store className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered: status !== undefined || search !== undefined,
            total: result.meta?.total ?? 0,
            page,
            noun: "vendors",
            genuinelyEmpty:
              "Vendors appear here once someone applies from the seller app.",
          })}
        />
      ) : (
        <>
          <TableShell>
            <Table>
              <THead>
                <TR>
                  <TH>Store</TH>
                  <TH priority="secondary">Owner</TH>
                  <TH>Status</TH>
                  <TH>Payouts</TH>
                  <TH align="end" priority="secondary">
                    Commission
                  </TH>
                  <TH align="end" priority="secondary">
                    Joined
                  </TH>
                </TR>
              </THead>
              <TBody>
                {result.data.map((vendor) => {
                  const presentation = vendorStatus(vendor.status);
                  return (
                    <TR key={vendor.id}>
                      <TD>
                        <Link
                          href={`/vendors/${vendor.id}`}
                          prefetch={false}
                          className="flex flex-col rounded-input font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                        >
                          {vendor.storeName}
                          <span className="text-meta font-normal text-ink-subtle">
                            /{vendor.slug}
                          </span>
                        </Link>
                      </TD>
                      <TD priority="secondary">
                        <span className="text-ink-muted">{vendor.user.email}</span>
                      </TD>
                      <TD>
                        <Badge tone={badgeTone(presentation.tone)}>
                          {presentation.label}
                        </Badge>
                      </TD>
                      <TD>
                        {vendor.paystackSubaccountCode ? (
                          <span className="text-ink-muted">Configured</span>
                        ) : (
                          // Not an empty cell. See the header — this vendor cannot
                          // be bought from at all.
                          <Badge tone="danger">Not set up</Badge>
                        )}
                      </TD>
                      <TD align="end" priority="secondary">
                        {vendor.commissionRateOverride === null ? (
                          <span className="text-ink-subtle">Tier</span>
                        ) : (
                          `${String(Number((vendor.commissionRateOverride * 100).toFixed(2)))}%`
                        )}
                      </TD>
                      <TD align="end" priority="secondary">
                        <span className="text-ink-muted">
                          {absoluteDate(vendor.createdAt)}
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
              hrefForPage={(target) => hrefForPage("/vendors", urlParams, target)}
            />
          )}
        </>
      )}
    </div>
  );
}
