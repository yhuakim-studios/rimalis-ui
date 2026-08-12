import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { ErrorState } from "@/components/feedback";
import { Badge, Card } from "@/components/primitives";
import { account, ctxFor, requireSession } from "@/lib/auth";
import { AddressForm } from "./AddressForm";
import { AddressActions } from "./AddressActions";

/**
 * Saved delivery addresses.
 *
 * ## The list and the add form are on one page
 *
 * Not a list with an "Add" route behind it. Most accounts have one or two
 * addresses, and a separate route for adding the second one is a navigation for
 * a form that fits under the list. It also means the checkout flow can drop the
 * same `<AddressForm>` inline without a route to send anyone to.
 *
 * ## `next` in the query string
 *
 * Checkout links here as `?next=/checkout` so a shopper who came to add an
 * address can get straight back to paying rather than navigating the account
 * section to find their way out.
 */

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await requireSession("/account/addresses");
  const { next } = await searchParams;

  const addresses = await account.listAddresses(ctxFor(session));

  if (!addresses.ok) {
    return <ErrorState error={addresses.error} title="We couldn't load your addresses" />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-heading text-ink">Addresses</h1>
          <p className="text-body text-ink-muted">
            Where your orders go. The default is pre-selected at checkout.
          </p>
        </div>

        {next === "/checkout" && (
          <Link
            href="/checkout"
            className="text-caption font-medium text-ink underline underline-offset-4"
          >
            Back to checkout
          </Link>
        )}
      </div>

      {addresses.data.length === 0 ? (
        <Card tone="flat" padding="lg" className="flex flex-col items-center gap-3 text-center">
          <MapPin className="size-7 text-ink-subtle" strokeWidth={1.5} aria-hidden />
          <p className="text-body text-ink-muted">
            You haven&rsquo;t saved an address yet. Add one below.
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {addresses.data.map((address) => (
            <Card key={address.id} as="li" tone="flat" padding="md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-body font-medium text-ink">
                      {address.label ?? address.street}
                    </p>
                    {address.isDefault && <Badge tone="brand">Default</Badge>}
                  </div>
                  <p className="text-caption text-ink-muted">
                    {address.street}, {address.city}, {address.state}
                    {address.postalCode ? ` ${address.postalCode}` : ""} · {address.country}
                  </p>
                </div>

                <AddressActions address={address} />
              </div>
            </Card>
          ))}
        </ul>
      )}

      <section className="flex flex-col gap-4 border-t border-divider pt-8">
        <h2 className="text-section text-ink">Add an address</h2>
        <div className="max-w-xl">
          <AddressForm />
        </div>
      </section>
    </div>
  );
}
