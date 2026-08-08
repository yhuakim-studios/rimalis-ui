import type { Metadata } from "next";
import { Footer, Header } from "@/components/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Rimalis — Nigeria's multi-vendor marketplace",
    // Every page sets its own `title`; this frames it without each one repeating
    // the brand.
    template: "%s · Rimalis",
  },
  description:
    "Shop electronics, audio and computing from vetted Nigerian vendors. One basket across every store.",
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

        `text-body` rather than a bare size so the 1.5 line-height comes with
        it — the type scale is size/leading/weight triples on purpose.

        `flex-col` + `min-h-screen` with `mt-auto` on the footer, so the footer
        sits at the bottom of the viewport on a short page (an empty state, a
        404) instead of floating halfway up.
      */}
      <body className="flex min-h-screen flex-col bg-canvas font-sans text-body text-ink antialiased">
        <Header />
        {/* `id="main"` is the skip link's target — see the link in Header. */}
        <main id="main" className="flex-1">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
