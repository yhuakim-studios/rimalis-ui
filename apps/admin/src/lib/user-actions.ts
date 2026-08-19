"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { admin, ctxFor, requireAdmin } from "./auth";
import { fieldErrorsOf, type FormState } from "./form-state";

/**
 * Account administration: roles, suspension, reactivation.
 *
 * ## The self-protection guard, and why it is checked twice
 *
 * The API returns 400 when an admin tries to change their OWN role. That guard is
 * the only thing standing between this console and a platform with no admins: one
 * person demoting themselves by accident locks out every remaining path to the
 * role, because promoting someone requires being an admin.
 *
 * So it is enforced in three places, deliberately:
 *
 *   1. The API refuses it. The real boundary.
 *   2. This action refuses it before calling, so the failure is a sentence rather
 *      than a bare 400 that the client's narrowing helper has to guess at.
 *   3. The detail screen does not render the control at all on your own row, and
 *      says why — because a disabled control an admin has to click to understand
 *      is a worse explanation than a paragraph.
 *
 * Belt and braces on a one-way door. `requireAdmin()` inside each action also
 * re-checks the caller, so a demoted admin cannot act from a tab left open.
 */

const idSchema = z.object({ userId: z.uuid("That user id is not valid.") });

const roleSchema = idSchema.extend({
  role: z.enum(["ADMIN", "VENDOR", "CUSTOMER"], {
    message: "Pick a role.",
  }),
});

const suspendSchema = idSchema.extend({
  reason: z.string().trim().max(500, "Keep the reason under 500 characters.").optional(),
});

function revalidateUser(userId: string): void {
  revalidatePath("/users");
  revalidatePath(`/users/${userId}`);
  // The dashboard counts users by role.
  revalidatePath("/");
}

/**
 * Change a user's role.
 *
 * Promoting to VENDOR does NOT create a vendor record — they still have to apply
 * from the seller app — and demoting a vendor does not delete theirs. Worth saying
 * on the success state, because "I made them a vendor and they have no store" is
 * otherwise a bug report.
 */
export async function setUserRole(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/users");

  // Check 2 of 3 — see the header. Refused here so the message is a sentence.
  if (parsed.data.userId === session.user.id) {
    return {
      error:
        "You can't change your own role. Ask another admin — that guard is what stops the last admin locking everyone out.",
    };
  }

  const result = await admin.setUserRole(ctxFor(session), parsed.data.userId, {
    role: parsed.data.role,
  });

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That account no longer exists." };
    if (admin.isSelfRoleChange(result.error)) {
      // Reachable only if the id check above is somehow bypassed. Keep the same
      // wording so the two paths cannot diverge into two different explanations.
      return {
        error:
          "You can't change your own role. Ask another admin — that guard is what stops the last admin locking everyone out.",
      };
    }
    return { error: shopperMessage(result.error) };
  }

  revalidateUser(parsed.data.userId);
  return {
    message:
      parsed.data.role === "VENDOR"
        ? "Role updated. They still have to apply from the seller app before they have a store."
        : "Role updated.",
  };
}

/**
 * Suspend an account.
 *
 * ⚠️ Not instant, unlike suspending a VENDOR. `isActive: false` blocks a new login
 * and blocks refresh, but an access token already issued keeps working until it
 * expires — up to 15 minutes. The vendor guard re-reads status from the database on
 * every request, so vendor suspension bites immediately; this one does not, and the
 * copy says so. "I suspended them and they were still ordering" is otherwise a bug
 * report about a system working as designed.
 */
export async function suspendUser(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = suspendSchema.safeParse({
    userId: formData.get("userId"),
    reason: String(formData.get("reason") ?? "").trim() || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/users");

  // Not an API rule, a sanity one: suspending yourself signs you out mid-action
  // and needs another admin to undo.
  if (parsed.data.userId === session.user.id) {
    return { error: "You can't suspend your own account." };
  }

  const result = await admin.suspendUser(ctxFor(session), parsed.data.userId, {
    ...(parsed.data.reason !== undefined ? { reason: parsed.data.reason } : {}),
  });

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That account no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateUser(parsed.data.userId);
  return {
    message:
      "Suspended. They can't sign in again, but a token already issued works for up to 15 more minutes.",
  };
}

export async function reactivateUser(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/users");
  const result = await admin.reactivateUser(ctxFor(session), parsed.data.userId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That account no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateUser(parsed.data.userId);
  return { message: "Reactivated. They can sign in again." };
}
