import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card, cn } from "@/components/primitives";

/**
 * A single figure, with an optional comparison.
 *
 * The stat-tile contract: **label** (sentence case, no trailing colon) · **value**
 * (semibold, already compacted by the caller) · **delta** (signed, against a named
 * period).
 *
 * ## Two decisions worth not undoing
 *
 * **The value uses proportional figures, not `tabular-nums`.** Tabular gives every
 * digit the width of a `0`, which is right in a column of numbers that must align
 * and wrong at display size — `₦121,000` looks gappy and unset. Tabular is reserved
 * for the table view and the axis ticks, where alignment is the point.
 *
 * **A delta's colour is direction × whether up is good**, which is why
 * `higherIsBetter` exists rather than the component assuming a rise is green. It is
 * not always: a rise in unfulfilled orders is bad news. Getting this backwards
 * paints a problem in the reassuring colour, so the caller has to state it.
 *
 * Colour is never the only carrier — the arrow icon and the signed number say the
 * same thing, so this survives greyscale and colour-blindness.
 */
export interface StatTileProps {
  label: string;
  /** Pre-formatted. This component does not know whether it is money or a count. */
  value: string;
  /** A quieter line under the value — "vs last week", "8 still to pack". */
  caption?: string;
  /** Percentage change. `null` renders no delta at all — see the note below. */
  deltaPercent?: number | null;
  /** What the delta compares against, named. Required whenever there is a delta. */
  deltaLabel?: string;
  /** `false` for figures where a rise is bad (backlog, cancellations). */
  higherIsBetter?: boolean;
  /** A 16px lucide icon, decorative. */
  icon?: ReactNode;
}

export function StatTile({
  label,
  value,
  caption,
  deltaPercent,
  deltaLabel,
  higherIsBetter = true,
  icon,
}: StatTileProps) {
  // `null` and `undefined` both mean "no comparison", and that is deliberate:
  // `deriveStats` returns `null` when the previous period was zero, because going
  // from ₦0 to ₦50,000 is a first sale rather than "+100%", and a percentage there
  // is arithmetic dressed up as insight.
  const hasDelta = deltaPercent !== null && deltaPercent !== undefined && deltaPercent !== 0;
  const rising = (deltaPercent ?? 0) > 0;
  const good = rising === higherIsBetter;

  return (
    <Card padding="sm" tone="flat" className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-ink-muted">
        {icon && <span aria-hidden>{icon}</span>}
        <span className="text-meta">{label}</span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-section font-semibold tracking-tight">{value}</span>

        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-meta font-medium",
              good ? "text-brand-700" : "text-danger",
            )}
          >
            {rising ? (
              <ArrowUpRight className="size-3.5" strokeWidth={2} aria-hidden />
            ) : (
              <ArrowDownRight className="size-3.5" strokeWidth={2} aria-hidden />
            )}
            {/* The sign is written out so the number is unambiguous without the
                icon — screen readers announce this, not the arrow. */}
            {rising ? "+" : "−"}
            {Math.abs(deltaPercent ?? 0)}%{deltaLabel && <span className="sr-only"> {deltaLabel}</span>}
          </span>
        )}
      </div>

      {(caption ?? (hasDelta && deltaLabel)) && (
        <p className="text-meta text-ink-subtle">{caption ?? deltaLabel}</p>
      )}
    </Card>
  );
}
