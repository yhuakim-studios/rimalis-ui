import { PackageX } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState } from "@/components/feedback";

/**
 * A listing that does not exist, or is not publicly visible.
 *
 * Reached by `notFound()` from the page, which Next serves with a **real HTTP
 * 404**. That status matters: a soft 404 — a "not found" message returned with a
 * 200 — teaches a search engine that the URL is a valid page, so it stays in the
 * index and keeps sending shoppers to it.
 *
 * ## Why the copy does not say the product was deleted
 *
 * The API returns 404 for several distinct situations that a shopper cannot
 * distinguish and does not need to: the listing was soft-deleted, the vendor was
 * suspended, the vendor deactivated the listing, or the pool product was marked
 * UNAVAILABLE. Naming a cause would be a guess, and the guess "this product was
 * removed" is wrong in the common case where the vendor is simply out.
 *
 * What is actionable is the same in every case: the product may exist under
 * another vendor. So the action goes to the catalogue rather than to the home page.
 */

export default function NotFound() {
  return (
    <Container className="py-8 md:py-12">
      <EmptyState
        icon={<PackageX className="size-7" strokeWidth={1.5} />}
        title="We couldn't find that product"
        body="It may have sold out, or the store may no longer be listing it. Other vendors might carry the same item."
        action={{ label: "Browse all products", href: "/products" }}
      />
    </Container>
  );
}
