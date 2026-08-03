import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digistore",
  description: "Multi-vendor marketplace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/*
        `bg-canvas`, not `bg-white`: the warm off-white is what lets a
        `bg-surface` card read as a card without needing a border. See the
        four rules at the top of packages/config/tailwind/theme.css.

        `text-body` rather than a bare size so the 1.5 line-height comes with
        it — the type scale is size/leading/weight triples on purpose.
      */}
      <body className="min-h-screen bg-canvas font-sans text-body text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
