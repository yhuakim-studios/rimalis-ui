"use client";

import { useActionState } from "react";
import type { UserRole } from "@rimalis/types";
import { Select } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { setUserRole } from "@/lib/user-actions";
import type { FormState } from "@/lib/form-state";

/**
 * Change a user's role.
 *
 * Rendered only when the target is NOT the signed-in admin — the caller decides,
 * because the alternative to omitting it is a disabled control an admin has to
 * click to understand. See the header of lib/user-actions.ts on why the
 * self-protection guard is enforced in three places.
 *
 * No confirmation step, unlike suspension. A role change is reversible in one
 * click by anyone with the console open, and a two-step confirm on a reversible
 * action trains people to click through confirmations that matter.
 */
export function RoleForm({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: UserRole;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(setUserRole, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="userId" value={userId} />

      {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
      {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Select
            label="Role"
            name="role"
            defaultValue={currentRole}
            error={state.fieldErrors?.["role"]}
          >
            <option value="CUSTOMER">Customer</option>
            <option value="VENDOR">Vendor</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
        <SubmitButton variant="secondary">Update role</SubmitButton>
      </div>

      <p className="text-meta text-ink-subtle">
        Promoting someone to Vendor does not create a store — they still apply from
        the seller app. Making someone an Admin gives them everything you can do,
        including suspending vendors and repricing the catalogue.
      </p>
    </form>
  );
}
