import { PackageSearch } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { HeroSection } from "@/components/marketplace/HeroSection";
import { CategoryCircles } from "@/components/marketplace/CategoryCircles";
import { TrendingProducts } from "@/components/marketplace/TrendingProducts";
import { PromoBanners } from "@/components/marketplace/PromoBanners";
import { FeaturedCollections } from "@/components/marketplace/FeaturedCollections";
import { TrustBar } from "@/components/marketplace/TrustBar";
import { loadHomeData } from "@/lib/home";

/**
 * The home page.
 *
 * A Server Component that fetches once and passes props down. The six sections are
 * `"use client"` for their carousels and hover state, and under the BFF (ADR-0003)
 * a client component cannot call the API — `lib/api.ts` is `server-only`, so
 * trying is a build error rather than a production CORS failure. `loadHomeData()`
 * is where the shaping lives and where the reasoning is written down.
 *
 * ## Failure and emptiness are handled here, not per section
 *
 * One request feeds every data-driven section, so one failure affects all of them
 * together and belongs in one place. But the **static** sections still render: a
 * home page that goes blank because a Supabase query timed out is the worst
 * available first impression, and keeping the hero and the trust bar up costs one
 * `if`. The hero renders either way, with an empty sidebar if the catalogue is
 * unreachable.
 *
 * ## No `revalidate`, deliberately
 *
 * `open-next.config.ts` is `defineCloudflareConfig({})`, so the adapter's
 * `incrementalCache` defaults to `"dummy"` — any `revalidate` added now is a silent
 * no-op, which is worse than no caching because the next person would trust it.
 * Phase 8 creates the R2 bucket and adds it as one change that can be verified with
 * a cache HIT.
 */

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const home = await loadHomeData();

  return (
    <div className="bg-canvas min-h-screen pb-12">
      <Container width="shell">
        {/* 1. Hero Section (Category Sidebar + Main Banner) */}
        <HeroSection categories={home.categories} />

        {home.error ? (
          // Inline, between the static sections, so the page survives. `ErrorState`
          // picks its copy from `error.kind`, which is what keeps a timeout from
          // being reported as "nothing found" — see the note in that component.
          <ErrorState error={home.error} title="We couldn't load the catalogue" />
        ) : home.trending.length === 0 ? (
          <EmptyState
            icon={<PackageSearch className="size-7" strokeWidth={1.5} />}
            title="No products yet"
            body="Vendors are still setting up their stores. Check back shortly."
            action={{ label: "Browse the catalogue", href: "/products" }}
          />
        ) : (
          <>
            {/* 2. Browse By Categories */}
            <CategoryCircles categories={home.categories} />

            {/* 3. Trending Right Now ⚡ */}
            <TrendingProducts products={home.trending} />
          </>
        )}

        {/* 4. Dual Promotional Banners — static marketing, see the component */}
        <PromoBanners />

        {/* 5. Featured Stores (was "Collections" — see the component for why) */}
        {!home.error && <FeaturedCollections stores={home.stores} />}

        {/* 6. Trust & Security Bar */}
        <TrustBar />
      </Container>
    </div>
  );
}
