import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, Store } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState, ErrorState } from "@/components/feedback";
import { Card } from "@/components/primitives";
import { loadHomeData } from "@/lib/home";

/**
 * Every store with something for sale.
 *
 * ## Derived from the catalogue, because the API has no vendor index
 *
 * There is no public "list vendors" endpoint — only `GET /store/:slug` for one
 * storefront. So the set of visible stores is exactly the set of vendors
 * appearing in the catalogue, which is what `loadHomeData()` already derives for
 * the home page. Reusing it means one implementation of "which stores exist and
 * how many products does each have", and one place to fix when a vendor endpoint
 * appears.
 *
 * The known limit is inherited and stated rather than hidden: the derivation
 * reads one page of up to 100 listings, so once the catalogue outgrows that, the
 * counts here understate. `HomeData.truncated` is how that surfaces — see the
 * note below the grid.
 */

export const metadata: Metadata = {
  title: "Stores",
  description:
    "Every vetted seller on Rimalis, with what they currently have in stock.",
};

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const { stores, error, truncated } = await loadHomeData();

  return (
    <Container className="py-8 md:py-12">
      <div className="flex flex-col gap-2 pb-8">
        <h1 className="text-heading text-ink">Stores</h1>
        <p className="text-body text-ink-muted">
          Every seller with products available right now.
        </p>
      </div>

      {error ? (
        <ErrorState error={error} title="We couldn't load the stores" />
      ) : stores.length === 0 ? (
        <EmptyState
          icon={<Store className="size-7" strokeWidth={1.5} />}
          title="No stores are open yet"
          body="Sellers are still setting up. The catalogue is the best place to check back."
          action={{ label: "Browse the catalogue", href: "/products" }}
        />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stores.map((store) => (
              <Card key={store.slug} as="li" padding="none" interactive>
                <Link
                  href={`/store/${encodeURIComponent(store.slug)}`}
                  className="flex h-full flex-col"
                >
                  <div className="relative aspect-[16/9] w-full bg-canvas">
                    {store.imageUrl ? (
                      <Image
                        src={store.imageUrl}
                        // Decorative here, and deliberately so: the store name
                        // is right below in text, so describing the borrowed
                        // product photo would announce a product this card is
                        // not about.
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="grid h-full place-items-center text-ink-subtle" aria-hidden>
                        <ImageOff className="size-8" strokeWidth={1.5} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col gap-1 p-4">
                    <h2 className="text-body font-medium text-ink">{store.storeName}</h2>
                    <p className="text-meta text-ink-muted">
                      {store.productCount}{" "}
                      {store.productCount === 1 ? "product" : "products"} available
                    </p>
                  </div>
                </Link>
              </Card>
            ))}
          </ul>

          {truncated && (
            <p className="pt-8 text-caption text-ink-muted">
              {/* Said out loud rather than silently truncating. A count that is
                  quietly wrong reads as a bug in the marketplace; a count that
                  says it is partial reads as a marketplace that outgrew a page. */}
              The catalogue is larger than one page, so these product counts show what we
              could read in a single request.
            </p>
          )}
        </>
      )}
    </Container>
  );
}
