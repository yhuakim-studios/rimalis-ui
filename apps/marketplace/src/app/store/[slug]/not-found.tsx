import { StoreIcon } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState } from "@/components/feedback";

/**
 * No approved storefront at this slug.
 *
 * The copy deliberately does not say the store does not exist. The API answers 404
 * for an unknown slug AND for a vendor whose application is pending, rejected or
 * suspended — because the existence of an unapproved application is not public
 * information. Saying "no such store" would be a false statement in three of those
 * four cases, and a vendor who reads it while their suspension is under review
 * learns something the platform chose not to disclose.
 */

export default function NotFound() {
  return (
    <Container className="py-8 md:py-12">
      <EmptyState
        icon={<StoreIcon className="size-7" strokeWidth={1.5} />}
        title="This store isn't available"
        body="It may have closed, or the link may be out of date. There are plenty of other vendors on Digistore."
        action={{ label: "Browse all products", href: "/products" }}
      />
    </Container>
  );
}
