"use client";

import { useId, useState } from "react";
import { cn } from "@/components/primitives";
import { compactNaira, pluralise } from "@/lib/format";

/**
 * Daily sales for the last seven days.
 *
 * ## Form, and why it is one colour
 *
 * Magnitude over an ordered time axis, one measure — a column chart, single series.
 * Which settles most of the design by itself:
 *
 * - **No legend.** One series means one colour, so a legend box with a single swatch
 *   would restate the heading and spend space saying nothing.
 * - **Every bar is the same colour.** The reference design tints each bar by its
 *   height; that is a value-ramp on a time axis, and it double-encodes bar length as
 *   hue — burning the only free channel on information the bar already shows.
 * - **Today is emphasised, and that is emphasis, not encoding.** The current day
 *   carries the accent and the previous six a de-emphasis step of the *same* hue. It
 *   marks *which* bar is now, and does not vary with the value.
 *
 * This product has exactly one accent and it is near-black (`--color-brand-600`), so
 * there is no categorical palette here to validate — the only colour check that
 * applies is contrast against the surface, which a near-black fill passes trivially.
 *
 * ## Mark specs
 *
 * Bars capped at 24px and centred in their slot, 4px rounded top with a square
 * baseline, a 2px surface gap between neighbours, hairline solid gridlines one step
 * off the surface. Values are **not** printed on every bar — the peak is labelled,
 * the axis carries the rest, and the tooltip carries the exact figure.
 *
 * ## Why a Client Component
 *
 * The hover tooltip. An HTML chart that cannot be interrogated forces every reader
 * to estimate from the axis, and seven bars is exactly the size where the difference
 * between ₦42,000 and ₦48,000 matters and is invisible.
 *
 * Built from `div`s rather than SVG: seven rectangles and a baseline need no path
 * maths, and flexbox gets responsive slot widths for free where an SVG would need a
 * viewBox and a resize observer.
 */

export interface SalesChartDay {
  date: string;
  initial: string;
  weekday: string;
  /** Kobo. Integer minor units — see lib/money.ts. */
  revenue: number;
  units: number;
  orders: number;
  isToday: boolean;
}

export interface SalesChartProps {
  days: readonly SalesChartDay[];
  /** Y-axis ticks, low to high, in kobo. Empty hides the axis. */
  ticks: readonly number[];
}

/**
 * ## `compactNaira` is imported, not passed in
 *
 * It was a `format` prop at first, on the reasoning that the chart should hold no
 * money logic. That does not survive the Server/Client boundary: **a function
 * cannot cross it.** React refuses to serialize one, and the failure is not a
 * build error — the server threw "Functions cannot be passed directly to Client
 * Components" *during the render*, so the surrounding page streamed fine and only
 * this card came back empty. Silent in the terminal, invisible until you read the
 * RSC payload.
 *
 * `lib/format.ts` is a pure presentation module with no `server-only` marker and
 * no Node dependencies, so importing it here is free, and the boundary now carries
 * only plain data.
 */
export function SalesChart({ days, ticks }: SalesChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const tableId = useId();

  // The scale's top. Never zero — a flat week would divide by it, and every bar
  // would be `NaN%` tall.
  const peak = Math.max(...days.map((day) => day.revenue), 1);
  const peakDate = days.find((day) => day.revenue === peak && peak > 0)?.date;

  const active = days.find((day) => day.date === hovered);

  return (
    <figure className="flex flex-col gap-3">
      <div className="flex gap-3">
        {/*
          The y-axis. `tabular-nums` here and NOT on the stat tiles: these are a
          column of numbers whose digits must align vertically, which is exactly
          what tabular figures are for.
        */}
        {ticks.length > 0 && (
          <div
            className="flex w-12 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] tabular-nums text-ink-subtle"
            aria-hidden
          >
            {[...ticks].reverse().map((tick) => (
              <span key={tick}>{compactNaira(tick)}</span>
            ))}
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          {/*
            Gridlines: solid hairlines one step off the surface, never dashed —
            dashing reads as "projection" or "threshold" when it is just a grid.
          */}
          <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
            {ticks.map((tick) => (
              <span key={tick} className="h-px w-full bg-divider" />
            ))}
          </div>

          {/* `gap-0.5` is the 2px surface gap that separates neighbouring bars.
              No border is drawn around a bar — the gap is the mechanism. */}
          <div className="relative flex h-[180px] items-end gap-0.5">
            {days.map((day) => {
              // A visible floor for a non-zero day. Without it a small-but-real
              // ₦2,000 against a ₦500,000 peak rounds to nothing and reads as
              // "no sales", which is a different fact.
              const ratio = day.revenue / peak;
              const heightPercent = day.revenue === 0 ? 0 : Math.max(ratio * 100, 2);
              const isHovered = hovered === day.date;

              return (
                <div
                  key={day.date}
                  className="flex h-full min-w-0 flex-1 flex-col justify-end"
                  onMouseEnter={() => setHovered(day.date)}
                  onMouseLeave={() => setHovered(null)}
                  // Focusable so the figures are reachable without a mouse. The
                  // table below is the real accessible route; this is the
                  // convenience one.
                  onFocus={() => setHovered(day.date)}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  aria-label={`${day.weekday}: ${compactNaira(day.revenue)} from ${pluralise(day.orders, "order")}`}
                >
                  {/* The peak gets a direct label. One label, not seven — a value
                      on every bar is chaos and goes unread. */}
                  {day.date === peakDate && day.revenue > 0 && (
                    <span className="mb-1 truncate text-center text-[10px] font-medium text-ink-muted">
                      {compactNaira(day.revenue)}
                    </span>
                  )}

                  <div
                    className={cn(
                      // 24px cap, centred: the slot's leftover is air, not bar.
                      "mx-auto w-full max-w-[24px] rounded-t-[4px] transition-[background-color,opacity] duration-150",
                      day.isToday ? "bg-brand-600" : "bg-brand-100",
                      isHovered && "opacity-80",
                    )}
                    style={{ height: `${String(heightPercent)}%` }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* The x-axis, aligned to the plot by the same left offset as the bars. */}
      <div className={cn("flex gap-0.5", ticks.length > 0 && "ml-[60px]")}>
        {days.map((day) => (
          <span
            key={day.date}
            className={cn(
              "min-w-0 flex-1 text-center text-[11px]",
              day.isToday ? "font-semibold text-ink" : "text-ink-subtle",
            )}
          >
            {day.initial}
          </span>
        ))}
      </div>

      {/*
        The tooltip. A fixed row under the plot rather than a floating layer: it
        cannot be clipped by the card's `overflow-hidden`, it cannot escape a 360px
        viewport, and it does not shift the layout, because the row is always
        present and holds a resting caption when nothing is hovered.
      */}
      <figcaption
        className="flex min-h-[20px] items-center justify-center gap-2 text-meta"
        aria-live="polite"
      >
        {active ? (
          <>
            <span className="font-medium text-ink">{active.weekday}</span>
            <span className="text-ink-muted">
              {compactNaira(active.revenue)} · {active.units} sold ·{" "}
              {pluralise(active.orders, "order")}
            </span>
          </>
        ) : (
          <span className="text-ink-subtle">Hover a day for its exact figures</span>
        )}
      </figcaption>

      {/*
        The table view. Not a fallback — the accessible equivalent, so no figure in
        this chart is reachable only by looking at it. Collapsed by default because
        the chart is the primary read; `<details>` needs no JavaScript and is
        keyboard-operable for free.
      */}
      <details className="group">
        <summary className="cursor-pointer list-none text-meta text-ink-subtle underline decoration-divider-strong underline-offset-4 transition-colors hover:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <span className="group-open:hidden">Show as table</span>
          <span className="hidden group-open:inline">Hide table</span>
        </summary>

        <table id={tableId} className="mt-3 w-full text-meta">
          <caption className="sr-only">Sales for each of the last seven days</caption>
          <thead>
            <tr className="border-b border-divider text-left text-ink-muted">
              <th scope="col" className="py-1.5 font-medium">
                Day
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Sales
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Units
              </th>
              <th scope="col" className="py-1.5 text-right font-medium">
                Orders
              </th>
            </tr>
          </thead>
          <tbody>
            {days.map((day) => (
              <tr key={day.date} className="border-b border-divider last:border-0">
                <th scope="row" className="py-1.5 text-left font-normal text-ink-muted">
                  {day.weekday}
                </th>
                <td className="py-1.5 text-right tabular-nums">{compactNaira(day.revenue)}</td>
                <td className="py-1.5 text-right tabular-nums">{day.units}</td>
                <td className="py-1.5 text-right tabular-nums">{day.orders}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
