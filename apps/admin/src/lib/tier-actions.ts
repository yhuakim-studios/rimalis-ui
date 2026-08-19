"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { admin, ctxFor, requireAdmin } from "./auth";
import { fieldErrorsOf, type FormState } from "./form-state";

/**
 * The referral commission ladder — the rungs a vendor climbs by recruiting.
 *
 * ## Never retroactive, and the copy has to say so
 *
 * `OrderItem.commissionRate` is snapshotted at checkout precisely so historical
 * commission stays auditable after a rate changes. So editing a rung changes what
 * vendors on it pay on FUTURE orders and nothing else. An admin who believes
 * otherwise will "fix" a past month by editing a tier and watch nothing happen.
 *
 * ## Monotonic, or the API refuses
 *
 * More qualified referrals must never cost MORE commission, and no two rungs may
 * sit at the same `minReferrals`. The API validates the whole ladder on every
 * write, so a single-rung edit can be rejected because of its neighbours — which is
 * confusing unless the message says which rule broke. Hence `ladderErrorCopy`.
 *
 * ## Percent in, fraction out
 *
 * Same conversion as the vendor override, same reason it lives in exactly one place
 * per module: `0.08` is 8%, and a factor-of-100 slip here changes what every vendor
 * on that rung pays.
 */

const idSchema = z.object({ tierId: z.uuid("That tier id is not valid.") });

const percent = z
  .string()
  .trim()
  .min(1, "Enter a percentage.")
  .transform((raw) => Number(raw))
  .refine((n) => Number.isFinite(n), { message: "That is not a number." })
  .refine((n) => n >= 0 && n < 100, { message: "Must be between 0 and 99.99 percent." });

const createSchema = z.object({
  // Zero is valid: the seeded entry rung IS level 0, and rejecting it would refuse
  // to create a peer of a rung that already exists. `level` is a display ordinal,
  // not a count.
  level: z.coerce.number().int().min(0, "Level cannot be negative."),
  name: z.string().trim().min(2, "Give the rung a name.").max(120),
  minReferrals: z.coerce
    .number()
    .int()
    .min(0, "Cannot be negative — 0 is the entry rung."),
  percent,
  isActive: z.boolean(),
});

const updateSchema = idSchema.extend({
  level: z.coerce.number().int().min(0).optional(),
  name: z.string().trim().min(2).max(120).optional(),
  minReferrals: z.coerce.number().int().min(0).optional(),
  percent: percent.optional(),
  isActive: z.boolean().optional(),
});

/** The ladder decides every vendor's rate, so a change touches the vendor screens. */
function revalidateLadder(): void {
  revalidatePath("/commission-tiers");
  revalidatePath("/vendors");
}

/** A checkbox is absent from FormData when unchecked, not `"false"`. */
const readFlag = (formData: FormData, name: string): boolean => formData.has(name);

/** Fraction, rounded so a binary-float tail never reaches the database. */
const toFraction = (value: number): number => Number((value / 100).toFixed(6));

export async function createTier(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = createSchema.safeParse({
    level: formData.get("level"),
    name: formData.get("name"),
    minReferrals: formData.get("minReferrals"),
    percent: formData.get("percent"),
    isActive: readFlag(formData, "isActive"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/commission-tiers");
  const result = await admin.createCommissionTier(ctxFor(session), {
    level: parsed.data.level,
    name: parsed.data.name,
    minReferrals: parsed.data.minReferrals,
    rate: toFraction(parsed.data.percent),
    isActive: parsed.data.isActive,
  });

  if (!result.ok) return { error: ladderErrorCopy(result.error) };

  revalidateLadder();
  return { message: `Added ${parsed.data.name}. Future orders only.` };
}

export async function updateTier(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateSchema.safeParse({
    tierId: formData.get("tierId"),
    level: String(formData.get("level") ?? "").trim() || undefined,
    name: String(formData.get("name") ?? "").trim() || undefined,
    minReferrals: String(formData.get("minReferrals") ?? "").trim() || undefined,
    percent: String(formData.get("percent") ?? "").trim() || undefined,
    isActive: readFlag(formData, "isActive"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { tierId, percent: pct, ...rest } = parsed.data;

  const { session } = await requireAdmin("/commission-tiers");
  const result = await admin.updateCommissionTier(ctxFor(session), tierId, {
    ...rest,
    ...(pct !== undefined ? { rate: toFraction(pct) } : {}),
  });

  if (!result.ok) return { error: ladderErrorCopy(result.error) };

  revalidateLadder();
  return { message: "Saved. Applies to future orders only." };
}

/**
 * Deactivate rather than delete.
 *
 * A separate action from `updateTier` so the button can be one click with a clear
 * label, rather than an admin hunting for a checkbox. Preferred over deletion
 * because the row stays readable for anyone auditing a historical rate — and because
 * the API refuses to delete the last active rung anyway.
 */
export async function setTierActive(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema
    .extend({ isActive: z.enum(["true", "false"]) })
    .safeParse({
      tierId: formData.get("tierId"),
      isActive: formData.get("isActive"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const isActive = parsed.data.isActive === "true";

  const { session } = await requireAdmin("/commission-tiers");
  const result = await admin.updateCommissionTier(ctxFor(session), parsed.data.tierId, {
    isActive,
  });

  if (!result.ok) return { error: ladderErrorCopy(result.error) };

  revalidateLadder();
  return {
    message: isActive
      ? "Rung is live again."
      : "Rung deactivated. Vendors on it fall to the next one they qualify for.",
  };
}

export async function deleteTier(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ tierId: formData.get("tierId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/commission-tiers");
  const result = await admin.deleteCommissionTier(ctxFor(session), parsed.data.tierId);

  if (!result.ok) return { error: ladderErrorCopy(result.error) };

  revalidateLadder();
  return { message: "Deleted." };
}

/**
 * The ladder's own rules, as sentences.
 *
 * A single-rung edit can be rejected because of its NEIGHBOURS — the API validates
 * the whole ladder on every write — so "Conflict" or a bare 400 leaves an admin
 * staring at a form that looks correct. Naming the rule is the difference.
 */
function ladderErrorCopy(error: Parameters<typeof shopperMessage>[0]): string {
  if (error.kind === "http") {
    switch (error.code) {
      case "NON_MONOTONIC_COMMISSION_LADDER":
        return "That would make the ladder charge MORE commission for more referrals. Every rung must cost the same or less than the one below it.";
      case "AMBIGUOUS_COMMISSION_LADDER":
        return "Two rungs would require the same number of referrals, so there would be no way to say which one applies.";
      case "COMMISSION_TIER_LEVEL_TAKEN":
        return "Another rung already uses that level. Levels are the display order and have to be unique.";
      case "COMMISSION_LADDER_WOULD_BE_EMPTY":
        return "This is the last active rung — removing it would leave no ladder at all. Add a replacement first.";
      default:
        break;
    }
  }
  return shopperMessage(error);
}
