import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digistore Admin",
  description: "Platform administration",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white font-sans text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
