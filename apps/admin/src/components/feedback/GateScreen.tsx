import type { ReactNode } from "react";
import { Card } from "@/components/primitives";

/**
 * The shape of a "you are signed in and still cannot be here" screen.
 *
 * ## Why this is a screen at its own URL and not an inline 403
 *
 * There is one of these in the admin console — `/not-authorised` — where the
 * vendor app has four. The reasoning is the same in both: a person who is
 * correctly signed in and still blocked has a specific question, and "Forbidden"
 * answers none of it. Here the question is *whose account is this and what should
 * I do with it*, because the overwhelmingly likely cause is a vendor or shopper
 * signing in at the wrong subdomain rather than anything sinister.
 *
 * It gets its own URL for two reasons: the admin shell must not render around it
 * (a nav bar whose every destination 403s is worse than no nav bar), and a
 * teammate can be linked straight to the explanation.
 *
 * So the copy is the component's whole job — state the situation, say what to do,
 * and offer at most one action.
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
