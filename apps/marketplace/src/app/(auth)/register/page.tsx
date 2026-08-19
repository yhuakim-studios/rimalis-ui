import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession, safeNext } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

/**
 * Create an account.
 *
 * Registration returns a usable token pair immediately: the shopper lands signed
 * in and browsing, with the verification mail still in flight. Verification
 * gates **checkout**, not sign-in, and putting a wall here instead would cost the
 * account at the one moment someone was willing to create one.
 */

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);

  if (await getSession()) redirect(next);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-heading text-ink">Create an account</h1>
        <p className="text-body text-ink-muted">
          One account, every store on Rimalis — with a single basket across all of them.
        </p>
      </div>

      <RegisterForm next={next} />
    </div>
  );
}
