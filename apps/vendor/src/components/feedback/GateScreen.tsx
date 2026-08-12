import type { ReactNode } from "react";
import { Card } from "@/components/primitives";

/**
 * The shape every "you cannot use the dashboard yet" screen shares.
 *
 * ## Why these are four screens and not one 403
 *
 * A vendor blocked from trading has exactly one question, and it is different in
 * each case: *when will I be able to sell* (pending), *is my money safe and who
 * do I talk to* (suspended), *can I try again* (rejected), *how do I start*
 * (no record). A single "Forbidden" answers none of them, and a seller who cannot
 * tell "we haven't reviewed you yet" from "we've stopped you" will assume the
 * worse of the two.
 *
 * So the copy is the component's whole job. Each screen states the situation in
 * the first sentence, says what happens next in the second, and offers at most
 * one action — because in three of the four cases there is genuinely nothing the
 * vendor can do, and inventing a button to fill the space would imply otherwise.
 *
 * `status` is rendered as a plain word rather than a `Badge`: a pill reads as
 * metadata attached to something else, and here the status IS the subject.
 */
export interface GateScreenProps {
  /** A 24px lucide icon. Decorative — the heading carries the meaning. */
  icon: ReactNode;
  /** The situation, in the vendor's terms. Not a status code. */
  title: string;
  /** What it means and what happens next. Two or three sentences at most. */
  body: string;
  /** Facts worth showing — store name, applied-on date. Omitted when unknown. */
  details?: { label: string; value: string }[];
  /** The one action, if there is one. */
  action?: ReactNode;
  /** A quieter secondary line — a support address, a sign-out link. */
  footer?: ReactNode;
}

export function GateScreen({ icon, title, body, details, action, footer }: GateScreenProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card padding="lg" className="flex flex-col gap-5 text-center">
        <span
          className="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700"
          aria-hidden
        >
          {icon}
        </span>

        <div className="flex flex-col gap-2">
          <h1 className="text-section font-semibold tracking-tight">{title}</h1>
          <p className="text-body text-ink-muted">{body}</p>
        </div>

        {details && details.length > 0 && (
          <dl className="flex flex-col gap-2 rounded-input bg-canvas p-4 text-left">
            {details.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-caption text-ink-muted">{row.label}</dt>
                <dd className="text-caption font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {action}
      </Card>

      {footer && <div className="text-center text-caption text-ink-muted">{footer}</div>}
    </div>
  );
}
