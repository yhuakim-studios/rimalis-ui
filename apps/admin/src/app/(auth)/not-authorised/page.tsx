import type { Metadata } from "next";
import { ShieldOff } from "lucide-react";
import { GateScreen } from "@/components/feedback";
import { SignOutButton } from "@/components/SignOutButton";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Not authorised" };

/**
 * Signed in, correctly, and still not an admin.
 *
 * ## Why this is a page and not a 403
 *
 * The overwhelmingly likely cause is mundane: a vendor or a shopper signed in at
 * the admin subdomain, because all three apps take the same credentials and the
 * URLs differ by one word. Those people are not intruders and the copy should not
 * treat them as such — it should tell them where they actually meant to go.
 *
 * It has its own URL so the admin shell is not rendered around it (a nav bar whose
 * every destination 403s is worse than no nav bar) and so a teammate can be sent
 * straight to the explanation.
 *
 * ## Why it does not offer a link to the other apps
 *
 * There is no `MARKETPLACE_URL` or `VENDOR_URL` in this app's environment, and
 * adding one to render a convenience link would give those origins a second source
 * of truth for the sake of an anchor tag. Naming the apps in prose costs nothing
 * and cannot drift.
 *
 * Reads the cookie only — `getSessionUser()`, not `requireAdmin()`. Guarding this
 * page with the gate that redirects here is an infinite loop.
 */
export default async function NotAuthorisedPage() {
  const user = await getSessionUser();

  return (
    <GateScreen
      icon={<ShieldOff className="size-6" strokeWidth={1.75} />}
      title="This account isn't an admin"
      body="You're signed in, but this console is for platform staff. If you sell on Rimalis, the seller dashboard is a different app; if you shop, the storefront is."
      details={
        user
          ? [
              { label: "Signed in as", value: user.email },
              // The role is worth showing precisely because it is usually the
              // whole explanation — "VENDOR" answers the question before the
              // prose does.
              { label: "Role", value: user.role },
            ]
          : undefined
      }
      action={<SignOutButton className="text-caption font-medium underline underline-offset-4" />}
      footer="An existing admin can grant access by changing your role."
    />
  );
}
