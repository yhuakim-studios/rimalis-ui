"use client";

import { Button, Card } from "@/components/primitives";

/**
 * The last resort for anything thrown inside the dashboard.
 *
 * Most failures never reach here: the API client returns a `Result` rather than
 * throwing, so a 404 becomes `notFound()` and a 500 becomes an inline `ErrorState`
 * next to the thing that failed. What lands here is a genuine exception — a bug, or
 * the deliberate throw in `requireApprovedVendor()` when the profile itself is
 * unreadable.
 *
 * That throw is why the copy avoids naming a cause. It fires when the API is
 * unreachable, and telling a vendor their account has a problem because Railway was
 * mid-deploy is the single most alarming thing this app could get wrong.
 */
export default function DashboardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-section font-semibold tracking-tight">
          We couldn&apos;t load your store just now
        </h1>
        <p className="text-caption text-ink-muted">
          Nothing has changed on your store or your orders. This is usually temporary.
        </p>
      </div>
      {/* `reset()` re-renders the segment without a full page load, so a transient
          failure costs one click rather than a reload. */}
      <Button onClick={reset}>Try again</Button>
    </Card>
  );
}
