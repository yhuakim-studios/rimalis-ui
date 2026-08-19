import type { Metadata } from "next";
import { Percent } from "lucide-react";
import { Card } from "@/components/primitives";
import { EmptyState, ErrorState } from "@/components/feedback";
import { admin, ctxFor, requireAdmin } from "@/lib/auth";
import { CreateTierForm, TierRow } from "./TierForms";

export const metadata: Metadata = { title: "Commission" };

/**
 * The referral commission ladder.
 *
 * ## Read through `GET /commission-tiers`, not an admin route
 *
 * There is no `/admin/commission-tiers` list. That endpoint is mounted behind
 * `authenticate` alone — so a pending vendor can see what they could earn — and it
 * returns every rung including inactive ones, which is exactly what this screen
 * needs. Only the writes are admin-gated. The client re-exports it as
 * `listCommissionTiers` so the path literal lives in one place.
 *
 * ## Rate shown as a percentage AND as the stored fraction
 *
 * `8.5%` for the human, `(0.085)` in mono beside it. The second is not clutter: the
 * fraction is what appears in `OrderItem.commissionRate`, in the audit metadata for
 * a vendor override, and in the API's own responses. An admin reconciling a
 * commission figure against a database row needs to recognise the number they will
 * see there.
 *
 * ## What this screen cannot do, and says so
 *
 * Nothing here is retroactive. Every `OrderItem` snapshotted its rate at checkout
 * precisely so historical commission stays auditable — so editing a rung changes
 * future orders and nothing else. An admin who believes otherwise will edit a tier
 * to "fix" last month and watch nothing happen.
 */
export default async function CommissionTiersPage() {
  const { session } = await requireAdmin("/commission-tiers");
  const result = await admin.listCommissionTiers(ctxFor(session));

  if (!result.ok) {
    return <ErrorState error={result.error} title="Couldn't load the ladder" />;
  }

  // Sorted by level here rather than trusting the response order: `level` IS the
  // display order, and a ladder rendered out of order is unreadable in a way that
  // looks like a data problem.
  const tiers = [...result.data].sort((a, b) => a.level - b.level);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading font-semibold tracking-tight">
          Commission ladder
        </h1>
        <p className="text-body text-ink-muted">
          What vendors are charged, and what recruiting earns them. Commission is
          taken on a vendor&apos;s margin — retail minus what they paid for the
          stock — not on the sale price.
        </p>
      </div>

      <Card tone="flat">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-caption text-ink-muted">
          <li>
            <strong className="font-semibold text-ink">Never retroactive.</strong>{" "}
            Every order froze its commission rate at checkout, so a change here only
            affects future orders.
          </li>
          <li>
            <strong className="font-semibold text-ink">Must stay monotonic.</strong>{" "}
            More referrals can never cost more commission, and no two rungs may
            require the same number — the API validates the whole ladder on every
            write, so an edit can be refused because of its neighbours.
          </li>
          <li>
            A vendor with a{" "}
            <strong className="font-semibold text-ink">per-vendor override</strong>{" "}
            ignores this ladder entirely. Set on their own page.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 text-section font-semibold">Add a rung</h2>
        <CreateTierForm />
      </Card>

      {tiers.length === 0 ? (
        <EmptyState
          icon={<Percent className="size-6" strokeWidth={1.5} />}
          title="No rungs yet"
          body="With no ladder, every vendor without an override falls back to the platform's default commission rate. Add the entry rung above."
        />
      ) : (
        <Card padding="none">
          <ul className="divide-y divide-divider">
            {tiers.map((tier) => (
              <TierRow key={tier.id} tier={tier} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
