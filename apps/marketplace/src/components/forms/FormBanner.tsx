import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/components/primitives";

/**
 * The message above a form: what went wrong, or what just happened.
 *
 * ## Why this is not `<ErrorState>`
 *
 * `<ErrorState>` replaces a section that failed to load and takes an `ApiError`.
 * This sits *inside* a form that is still perfectly usable and takes a sentence
 * an action already chose. Using the former here would throw away the shopper's
 * typed input to render a full-page apology for a wrong password.
 *
 * ## `role` differs by tone, and it matters
 *
 * `alert` for an error: it interrupts, which is right when a submit just failed
 * and the shopper is waiting to find out why. `status` for a success: it is
 * announced politely at the next opportunity, without cutting across whatever a
 * screen reader was saying. Using `alert` for both makes the app feel like it is
 * shouting; using `status` for both means a failed sign-in is announced only if
 * the shopper happens to navigate to it.
 */

export interface FormBannerProps {
  tone: "error" | "success";
  children: ReactNode;
}

export function FormBanner({ tone, children }: FormBannerProps) {
  const isError = tone === "error";

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-input border p-4 text-caption",
        isError
          ? "border-danger/20 bg-danger-soft text-danger"
          : "border-brand-100 bg-brand-50 text-brand-700",
      )}
    >
      {isError ? (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      ) : (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" strokeWidth={1.75} aria-hidden />
      )}
      <p className="min-w-0">{children}</p>
    </div>
  );
}
