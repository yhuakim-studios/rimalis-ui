import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { Card } from "./Card";
import { cn } from "./cn";

/**
 * A real `<table>` — the one place this app departs from the vendor app's list
 * pattern, deliberately.
 *
 * ## Why not the row-list the other two apps use
 *
 * `apps/vendor` renders lists as `<Card padding="none">` wrapping
 * `<ul className="divide-y divide-divider">` with a bespoke Row component, and
 * that is right there: each row is a **narrative**. `OrderRow` reads as a
 * sentence — monogram, reference, destination, when, one badge, one amount — and
 * a shopper or seller scans it top to bottom, one row at a time.
 *
 * Admin lists are **matrices**. Products are thumbnail / SKU / name / status /
 * cost / retail / pool stock; users are name / email / role / verified / active /
 * joined; payouts are store / amount / status / period / date. Eight list screens,
 * around six mostly-numeric columns each, and the questions asked of them are
 * comparative: which product has the thinnest margin, which vendor has no payout
 * details, which day was worst. That is reading DOWN a column, and it needs the
 * columns to line up.
 *
 * A `<ul>` of flex rows cannot line them up — each row sizes independently — and
 * `tabular-nums`, which `StatTile` reserves for "the table view, where alignment
 * is the point", has nowhere to live. A `<table>` also brings semantics the div
 * version has to fake: `<th scope="col">` gives a screen reader a column name for
 * every cell, and `aria-sort` has somewhere to go when sorting arrives.
 *
 * So: matrices here, and the row-list stays for the two places in this app that
 * genuinely are narratives — the audit timeline and the pending-vendor queue.
 *
 * ## Presentational only
 *
 * No state, no client JS, no `"use client"`. Sorting and filtering live in the
 * URL and are handled by `FilterBar` and plain links, so this stays a Server
 * Component and ships zero bytes of JavaScript.
 */

/**
 * The card wrapper, with horizontal scroll contained.
 *
 * `overflow-x-auto` is on THIS element rather than anywhere higher for a specific
 * reason: a wide table must scroll inside its own card, never make the page body
 * scroll sideways. A horizontally scrolling document is the single most common way
 * a responsive layout breaks, and once the body scrolls, the sticky nav slides
 * off with it.
 *
 * `min-w-0` on the flex/grid parent is the other half of this — see the note in
 * `(dashboard)/layout.tsx`. Without it a flex child refuses to shrink below its
 * content's intrinsic width and the overflow never engages here at all.
 */
export function TableShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padding="none" className={className}>
      <div className="min-w-0 overflow-x-auto">{children}</div>
    </Card>
  );
}

export function Table({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <table
      className={cn(
        // `w-full` plus `auto` layout: columns size to content, which is what a
        // heterogeneous admin table wants. `table-fixed` would divide the width
        // evenly and give a 6-character SKU the same room as a product name.
        "w-full border-collapse text-left",
        className,
      )}
    >
      {children}
    </table>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    // `bg-canvas`, not `bg-surface`: the header needs to separate from the rows
    // without a border, and the warm off-white against white is exactly the
    // device the card itself uses against the page.
    <thead className="border-b border-divider bg-canvas">{children}</thead>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-divider">{children}</tbody>;
}

export function TR({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={cn("align-middle", className)}>{children}</tr>;
}

/**
 * How much a column matters when space runs out.
 *
 * `secondary` columns are DROPPED below `md` rather than scrolled to. That is the
 * important half: on a phone, a table with nine columns scrolled sideways is
 * unusable in a way that a table with four columns is not, and the admin looking
 * at their phone wants the identity and the status, not the created-at timestamp.
 *
 * One rendering, not a mobile variant and a desktop variant. Two renderings of the
 * same data drift, and the one that drifts is the one nobody is looking at.
 */
export type ColumnPriority = "primary" | "secondary";

const PRIORITY: Record<ColumnPriority, string> = {
  primary: "",
  secondary: "hidden md:table-cell",
};

// `Omit<…, "align">` because HTML has its own deprecated `align` attribute on
// table cells, typed as "left" | "center" | "right" | …. Ours means start/end so
// it stays correct under RTL, and the two cannot coexist on one interface.
export interface THProps
  extends Omit<ThHTMLAttributes<HTMLTableCellElement>, "align"> {
  /** `end` right-aligns — for money and counts, matching the `TD`. */
  align?: "start" | "end";
  priority?: ColumnPriority;
}

export function TH({
  align = "start",
  priority = "primary",
  className,
  children,
  ...rest
}: THProps) {
  return (
    <th
      // `scope="col"` is not optional decoration: without it a screen reader
      // reads a data cell as a bare value with no indication of which column it
      // belongs to, which on a six-column money table is unusable.
      scope="col"
      className={cn(
        "px-4 py-3 text-meta font-medium uppercase tracking-wide text-ink-muted",
        align === "end" && "text-right",
        PRIORITY[priority],
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  );
}

/** See `THProps` on why the HTML `align` attribute is omitted. */
export interface TDProps
  extends Omit<TdHTMLAttributes<HTMLTableCellElement>, "align"> {
  /**
   * `end` right-aligns and switches on `tabular-nums`.
   *
   * Both, together, always — for money and counts. Right alignment lines up the
   * decimal point so magnitudes are comparable at a glance, and tabular figures
   * stop the digits themselves from shifting width between rows. Either one alone
   * still leaves a column of numbers that does not scan.
   */
  align?: "start" | "end";
  priority?: ColumnPriority;
}

export function TD({
  align = "start",
  priority = "primary",
  className,
  children,
  ...rest
}: TDProps) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-caption",
        align === "end" && "text-right tabular-nums",
        PRIORITY[priority],
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
