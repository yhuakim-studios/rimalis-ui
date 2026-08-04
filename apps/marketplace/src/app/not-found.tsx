import { Compass } from "lucide-react";
import { Container } from "@/components/layout";
import { EmptyState } from "@/components/feedback";

/**
 * A URL that matches no route.
 *
 * Distinct from `products/[listingId]/not-found.tsx` and
 * `store/[slug]/not-found.tsx`, which are for a route that exists whose *resource*
 * does not — those can say something specific and useful ("it may have sold out",
 * "other vendors may carry it"). This one cannot, because it has no idea what was
 * being looked for.
 *
 * So the honest thing is to say the address is wrong and offer the two places
 * worth going. Served with a real HTTP 404 by Next, which keeps a mistyped URL out
 * of a search index rather than legitimising it with a 200.
 */

export default function NotFound() {
  return (
    <Container className="py-8 md:py-12">
      <EmptyState
        icon={<Compass className="size-7" strokeWidth={1.5} />}
        title="This page doesn't exist"
        body="The link may be broken or the address mistyped. The catalogue is the best place to pick things up."
        action={{ label: "Browse all products", href: "/products" }}
      />
    </Container>
  );
}
