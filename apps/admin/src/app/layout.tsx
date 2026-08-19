import type { Metadata } from "next";
import "./globals.css";

/**
 * The root layout — tokens and document chrome only.
 *
 * Deliberately thin. The signed-in shell (header, nav) lives in
 * `(dashboard)/layout.tsx` instead, because the login page and
 * `/not-authorised` must NOT render it: a nav bar whose every destination 403s
 * is worse than no nav at all, and someone who is not an admin does not need a
 * "Vendors" tab to look at.
 */

export const metadata: Metadata = {
  title: {
    default: "Rimalis admin",
    template: "%s · Rimalis admin",
  },
  description: "Platform administration for Rimalis.",
  /**
   * This app is entirely behind an ADMIN login, so there is nothing here for a
   * crawler to index and no reason to let one try. Not a security control — the
   * auth guard is that — but an admin console has no business appearing in
   * search results at all.
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
