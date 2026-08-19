"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, Card } from "@/components/primitives";

/**
 * The code a vendor shares to recruit other sellers.
 *
 * ## Why this is a Client Component when the code itself is static
 *
 * Only for the copy affordance. A code that has to be transcribed by hand off a
 * screen and into WhatsApp is a code that gets one character wrong, and the whole
 * point of the Crockford alphabet upstream is that a mistyped code fails *visibly*
 * rather than crediting the wrong vendor — but "visibly failed" is still a lost
 * referral. One tap removes the transcription step entirely.
 *
 * The code is also rendered as selectable text, at a size that can be read aloud
 * over a phone call. `navigator.clipboard` needs a secure context and can be
 * refused by permissions policy, so the visible code is the fallback rather than
 * the button being the only route to it.
 */

export interface ReferralCodeCardProps {
  code: string;
}

export function ReferralCodeCard({ code }: ReferralCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  // Cleared on unmount: a vendor who taps copy and navigates away in the same
  // second would otherwise leave a timer to fire against a gone component.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setFailed(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard denied, or no secure context. Say so instead of showing a
      // success flash for something that did not happen — the vendor can still
      // select the code above, which is why it is text and not an image.
      setFailed(true);
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-meta text-ink-muted">Your referral code</span>
        <div className="flex flex-wrap items-center gap-3">
          {/* Tabular figures and wide tracking: this gets read out loud and typed
              by someone else, so character boundaries matter more than density. */}
          <span className="text-heading font-semibold tracking-wider tabular-nums select-all">
            {code}
          </span>
          {/* No `size` — this app's Button has only the two touch sizes (48px
              and 56px), by design. A compact 32px variant would be a new size
              introduced for one button. */}
          <Button variant="secondary" onClick={copy} aria-live="polite">
            {copied ? (
              <>
                <Check className="size-4" strokeWidth={2} aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="size-4" strokeWidth={1.75} aria-hidden />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-meta text-ink-muted">
        {failed
          ? "We couldn't reach your clipboard — select the code above and copy it manually."
          : "Give this to a seller you're bringing on. They enter it when they apply, and it can't be added afterwards."}
      </p>
    </Card>
  );
}
