import type { Metadata } from "next";
import { Heart } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { ProductGrid } from "@/components/catalogue";
import { loadWishlist } from "@/lib/wishlist";
import { TidyWishlist } from "./TidyWishlist";

/**
 * Saved items.
 *
 * ## Kept on this device, and the page says so
 *
 * The API has no wishlist resource, so this is a cookie — see `lib/wishlist.ts`.
 * The honest thing is to tell the shopper, because the alternative is someone
 * signing in on a laptop and concluding their saved items were lost.
 *
 * ## Listings that have vanished are reported, not swept
 *
 * A saved product can be withdrawn. Those ids are surfaced with a "tidy up"
 * action rather than removed silently during the render — a Server Component
 * cannot write a cookie anyway, and a list that quietly shrinks is a list that
 * cannot be trusted.
 */

export const metadata: Metadata = {
  title: "Saved items",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const wishlist = await loadWishlist();

  return (
    <Container className="py-8 md:py-12">
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="text-heading text-ink">Saved items</h1>
        <p className="text-body text-ink-muted">
          Saved on this device — they&rsquo;ll be here next time you visit from this
          browser.
        </p>
      </div>

      {wishlist.error ? (
        <ErrorState error={wishlist.error} title="We couldn't load your saved items" />
      ) : wishlist.items.length === 0 && wishlist.missing.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-7" strokeWidth={1.5} />}
          title="Nothing saved yet"
          body="Tap the heart on any product to keep it here while you decide."
          action={{ label: "Browse the catalogue", href: "/products" }}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {wishlist.missing.length > 0 && <TidyWishlist ids={wishlist.missing} />}
          {wishlist.items.length > 0 && <ProductGrid listings={wishlist.items} />}
        </div>
      )}
    </Container>
  );
}
