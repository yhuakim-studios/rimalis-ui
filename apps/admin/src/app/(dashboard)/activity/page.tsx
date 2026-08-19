import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Card, Pagination } from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import { FilterBar, StatusTabs } from "@/components/admin";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { absoluteDateTime, relativeTime } from "@/lib/format";
import { actorName, describeAction, targetHref, targetName } from "@/lib/audit";
import { emptyCopy, hrefForPage, oneOf, optional, pageParam } from "@/lib/admin-params";

export const metadata: Metadata = { title: "Activity" };

const TARGET_TYPES = ["USER", "VENDOR", "PRODUCT", "ORDER", "STOCK_PURCHASE"] as const;

/**
 * The audit trail: who did what, to what, when, and why.
 *
 * ## A timeline, not a table — the one list in this app that stays a row-list
 *
 * Every other admin list is a matrix, which is why `Table.tsx` exists. This one is
 * a sequence of sentences: "Platform Admin suspended the vendor Kano Deals · 43m
 * ago · verification review". There is nothing to compare down a column, and
 * forcing it into six columns would break the sentence into fragments that read
 * worse than the sentence does.
 *
 * ## The action vocabulary is OPEN, and this page must not assume otherwise
 *
 * `AuditLog.action` is a String column, not a Postgres enum, specifically so the
 * API can add an audited action without a migration. So `describeAction()` derives
 * a readable phrase from the action string when it does not recognise one — a new
 * action shipped by the API appears here immediately, imperfectly phrased and
 * completely legible, rather than as a blank cell. Adding it to the map is then an
 * improvement, not a bug fix.
 *
 * The `action` filter is a free-text field for the same reason. A `<select>` would
 * go stale the day a new action ships, and the API returns an empty page rather
 * than a 400 for a value it does not know.
 *
 * ## Target links are allowed to 404, and that is by design
 *
 * `targetType`/`targetId` carry no foreign key precisely so the log outlives what
 * it describes. A row about a deleted product still tells you a deletion happened;
 * clicking through to a not-found screen is the honest outcome, and the not-found
 * pages say so rather than presenting it as a fault.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const targetType = oneOf(params["targetType"], TARGET_TYPES);
  const action = optional(params["action"]);
  const targetId = optional(params["targetId"]);
  const page = pageParam(params["page"]);

  const { session } = await requireAdmin("/activity");
  const result = await admin.listAuditLogs(ctxFor(session), {
    ...(targetType !== undefined ? { targetType } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(targetId !== undefined ? { targetId } : {}),
    page,
  });

  const urlParams = { targetType, action, targetId };
  const filtered = Object.values(urlParams).some((v) => v !== undefined);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">Activity</h1>
        <p className="text-body text-ink-muted">
          Every audited change, newest first. Append-only — nothing here can be
          edited, including by an admin.
        </p>
      </div>

      <StatusTabs
        basePath="/activity"
        param="targetType"
        current={targetType}
        params={urlParams}
        tabs={[
          { label: "Everything" },
          { value: "VENDOR", label: "Vendors" },
          { value: "USER", label: "Users" },
          { value: "PRODUCT", label: "Products" },
          { value: "STOCK_PURCHASE", label: "Stock" },
          { value: "ORDER", label: "Orders" },
        ]}
      />

      <FilterBar
        basePath="/activity"
        active={filtered}
        fields={[
          {
            name: "action",
            label: "Action",
            value: action,
            grow: true,
            // Free text, not a select — the vocabulary is open. An unknown value
            // returns an empty page rather than a 400.
            placeholder: "Exact action, e.g. vendor.suspended",
          },
          {
            name: "targetId",
            label: "Target id",
            value: targetId,
            placeholder: "Everything done to one thing",
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState error={result.error} title="Couldn't load the activity log" />
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" strokeWidth={1.5} />}
          {...emptyCopy({
            filtered,
            total: result.meta?.total ?? 0,
            page,
            noun: "entries",
            genuinelyEmpty:
              "Approvals, suspensions, role changes and stock adjustments are recorded here as they happen.",
          })}
        />
      ) : (
        <>
          <Card padding="none">
            <ul className="divide-y divide-divider">
              {result.data.map((entry) => {
                const href = targetHref(entry);
                const subject = targetName(entry);
                return (
                  <li key={entry.id} className="flex flex-col gap-1.5 px-5 py-4">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
                      <span className="text-caption font-medium">
                        {actorName(entry)}
                      </span>
                      <span className="text-caption text-ink-muted">
                        {describeAction(entry.action)}
                      </span>
                      {subject !== undefined &&
                        (href === undefined ? (
                          <span className="text-caption font-medium">{subject}</span>
                        ) : (
                          <Link
                            href={href}
                            prefetch={false}
                            className="rounded-input text-caption font-medium underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                          >
                            {subject}
                          </Link>
                        ))}
                      <span
                        className="ml-auto shrink-0 text-meta text-ink-subtle"
                        title={absoluteDateTime(entry.createdAt)}
                      >
                        {relativeTime(entry.createdAt)}
                      </span>
                    </div>

                    {entry.reason !== null && entry.reason !== "" && (
                      // The reason is the point of this table existing. Three
                      // endpoints used to validate one and then throw it away.
                      <p className="text-caption text-ink-muted">
                        {/* One expression. Putting the quote entities on their own
                            lines makes JSX insert a space inside them, rendering
                            “ reason ”. */}
                        {`\u201C${entry.reason}\u201D`}
                      </p>
                    )}

                    <div className="flex flex-wrap items-baseline gap-x-3 text-meta text-ink-subtle">
                      <span className="font-mono">{entry.action}</span>
                      <span>{entry.actor.email}</span>
                      {hasKeys(entry.metadata) && (
                        <details>
                          <summary className="cursor-pointer">Details</summary>
                          <pre className="mt-2 overflow-x-auto rounded-input bg-canvas p-3 font-mono">
                            {JSON.stringify(entry.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {result.meta && (
            <Pagination
              page={result.meta.page}
              totalPages={result.meta.totalPages}
              hrefForPage={(target) => hrefForPage("/activity", urlParams, target)}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Whether `metadata` has anything worth a disclosure control.
 *
 * `metadata` is `unknown` by design — its shape varies per action and the API makes
 * no promise about it — so this narrows rather than casting. An empty object would
 * otherwise render a "Details" toggle that opens onto `{}`.
 */
function hasKeys(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    Object.keys(metadata as Record<string, unknown>).length > 0
  );
}
