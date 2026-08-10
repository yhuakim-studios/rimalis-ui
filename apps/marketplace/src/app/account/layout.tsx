import type { ReactNode } from "react";
import { Container } from "@/components/layout";
import { AccountNav } from "./AccountNav";

/**
 * The account section's frame.
 *
 * Deliberately does NOT call `requireSession()`. A layout runs for every route
 * beneath it, and a redirect from here would fire on routes that have their own
 * reasons to handle a missing session — and, more importantly, a layout is
 * cached and re-used across navigations in ways a page is not, so an auth gate
 * there is the classic place for a stale "signed in" decision to persist. Each
 * page calls `requireSession()` itself, with its own `next` path, so a shopper
 * bounced to sign-in returns to the page they wanted rather than to the section.
 */

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <Container className="py-8 md:py-12">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr] lg:gap-12">
        <AccountNav />
        <div className="min-w-0">{children}</div>
      </div>
    </Container>
  );
}
