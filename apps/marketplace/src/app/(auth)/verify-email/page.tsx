import type { Metadata } from "next";
import { CheckCircle2, MailWarning } from "lucide-react";
import { ButtonLink } from "@/components/primitives";
import { authClient, getSession } from "@/lib/auth";
import { apiConfig } from "@/lib/env";
import { ResendVerificationForm } from "./ResendVerificationForm";

/**
 * Where the verification email lands.
 *
 * ## The URL is a shipped contract
 *
 * The API builds this link off its own `APP_URL` as `/verify-email?token=…`.
 * Links with that exact shape are already in people's inboxes, so **the path and
 * the parameter name cannot be changed here** — they can only be changed on both
 * sides at once, and the old ones keep arriving for 24 hours regardless (the
 * token's lifetime). Renaming either is the kind of change that looks free and
 * breaks every account created yesterday.
 *
 * ## Consuming the token during a GET render, deliberately
 *
 * A token in a URL is single-use state being mutated by a page load, which is
 * normally something to avoid. It is right here for one reason: the alternative
 * is asking someone who has just clicked a link in an email to click a second
 * button to confirm that they clicked it. Email clients that prefetch links will
 * consume the token early — which is exactly why `ALREADY_VERIFIED` is rendered
 * as success below rather than as an error.
 *
 * ## `ALREADY_VERIFIED` is a success
 *
 * It is what a shopper gets for clicking twice, for a prefetching mail client,
 * or for verifying on their phone and then on their laptop. Their email IS
 * verified; telling them something went wrong would be both alarming and false.
 */

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const session = await getSession();

  // No token: someone navigated here directly, or the link was truncated by a
  // mail client. Offer the resend rather than an error — there is nothing wrong
  // with their account, they just have no token in hand.
  if (!token) {
    return (
      <Shell
        icon={<MailWarning className="size-7" strokeWidth={1.5} />}
        title="Check your inbox"
        body="Open the link in the verification email we sent you. If it's expired or you can't find it, ask for a new one."
      >
        <ResendVerificationForm defaultEmail={session?.user.email ?? ""} />
      </Shell>
    );
  }

  const result = await authClient.verifyEmail({ config: apiConfig }, token);

  const verified = result.ok || result.error.code === "ALREADY_VERIFIED";

  if (verified) {
    return (
      <Shell
        icon={<CheckCircle2 className="size-7" strokeWidth={1.5} />}
        title="Your email is verified"
        body="That's the last thing standing between you and checkout. Your basket is where you left it."
      >
        <div className="flex flex-col gap-3">
          <ButtonLink href="/cart" size="lg" fullWidth>
            Go to your basket
          </ButtonLink>
          <ButtonLink href="/products" variant="secondary" fullWidth>
            Keep browsing
          </ButtonLink>
        </div>
      </Shell>
    );
  }

  // Everything else — expired, malformed, already consumed by something that
  // was not this shopper. All of them have the same remedy, so they get the
  // same screen with a resend rather than four variations of "no".
  return (
    <Shell
      icon={<MailWarning className="size-7" strokeWidth={1.5} />}
      title="That link didn't work"
      body="Verification links expire after 24 hours and can only be used once. Ask for a fresh one and it'll arrive in a moment."
    >
      <ResendVerificationForm defaultEmail={session?.user.email ?? ""} />
    </Shell>
  );
}

function Shell({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="grid size-16 place-items-center rounded-pill bg-canvas text-ink-subtle" aria-hidden>
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink">{title}</h1>
        <p className="text-body text-ink-muted">{body}</p>
      </div>
      <div className="w-full text-left">{children}</div>
    </div>
  );
}
