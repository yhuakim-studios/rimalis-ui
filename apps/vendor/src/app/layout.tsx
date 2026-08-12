import type { Metadata } from "next";
import "./globals.css";

/**
 * The root layout — tokens and document chrome only.
 *
 * Deliberately thin. The signed-in shell (header, nav, store name) lives in
 * `(dashboard)/layout.tsx` instead, because the login page and the four status
 * gates must NOT render it: a bottom nav whose every destination 403s is worse
 * than no nav at all, and a suspended vendor does not need a "Products" tab.
 */

export const metadata: Metadata = {
  title: {
    default: "Rimalis for sellers",
    template: "%s · Rimalis for sellers",
  },
  description: "Manage your listings, orders and settlements on Rimalis.",
  /**
   * This app is entirely behind a login, so there is nothing here for a crawler
   * to index and no reason to let one try. Not a security control — the auth
   * guard is that — but it keeps a vendor's storefront tooling out of search
   * results, which is where it belongs.
   */
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/*
        `bg-canvas`, not `bg-white`: the warm off-white is what lets a
        `bg-surface` card read as a card without needing a border. See the four
        rules at the top of packages/config/tailwind/theme.css.

        `text-body` rather than a bare size, so the 1.5 line-height comes with
        it — the type scale is size/leading/weight triples on purpose.
      */}
      <body className="min-h-screen bg-canvas font-sans text-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
