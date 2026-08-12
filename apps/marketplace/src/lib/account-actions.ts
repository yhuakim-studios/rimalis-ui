"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { account, getSession } from "./auth";
import { apiConfig } from "./env";
import type { FormState } from "./auth-actions";

/**
 * Profile and address mutations.
 *
 * ## Why every action re-reads the session instead of taking a token
 *
 * A Server Action is a public HTTP endpoint. Its arguments come from the
 * browser, so an access token passed *in* would be a token an attacker could
 * substitute. Reading it from the cookie — which is `httpOnly` and encrypted —
 * means the action can only ever act as whoever holds this browser's session.
 *
 * ## No `requireSession()` here
 *
 * That helper redirects, which is right for a page and wrong for an action:
 * `useActionState` would receive a redirect where it expected a form state. An
 * action with no session redirects to sign-in explicitly, which is the same
 * outcome by a route the client understands.
 */

const addressSchema = z.object({
  label: z.string().trim().max(50).optional(),
  street: z.string().trim().min(1, "Enter the street address.").max(255),
  city: z.string().trim().min(1, "Enter the city.").max(100),
  state: z.string().trim().min(1, "Enter the state.").max(100),
  // Two characters, ISO 3166-1 alpha-2. Not a free-text country name: the API
  // stores exactly two characters and "Nigeria" is a 400 that reads as though
  // the field were rejected for being wrong rather than for being long.
  country: z.string().trim().length(2, "Use a 2-letter country code, e.g. NG.").default("NG"),
  postalCode: z.string().trim().max(20).optional(),
  isDefault: z.boolean().default(false),
});

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(100),
  lastName: z.string().trim().min(1, "Enter your last name.").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "A phone number is at least 7 characters.")
    .max(20)
    .optional()
    .or(z.literal("")),
});

function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && errors[key] === undefined) errors[key] = issue.message;
  }
  return errors;
}

export async function updateProfile(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount");

  const parsed = profileSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { phone, ...names } = parsed.data;
  const result = await account.updateProfile(
    { config: apiConfig, accessToken: session.accessToken },
    // An empty phone field is omitted rather than sent as `""`. The API's
    // minimum length is 7, so `""` is a validation error — which would tell a
    // shopper who cleared an optional field that they had filled it in wrongly.
    { ...names, ...(phone ? { phone } : {}) },
  );

  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidatePath("/account");
  return { message: "Your details have been saved." };
}

export async function createAddress(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Faddresses");

  const parsed = addressSchema.safeParse(readAddress(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await account.createAddress(
    { config: apiConfig, accessToken: session.accessToken },
    compactAddress(parsed.data),
  );
  if (!result.ok) return { error: shopperMessage(result.error) };

  // Checkout reads the address list too, and a shopper who adds an address
  // mid-checkout must see it in the picker without a hard reload.
  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { message: "Address saved." };
}

export async function updateAddress(
  id: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Faddresses");

  const parsed = addressSchema.safeParse(readAddress(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const result = await account.updateAddress(
    { config: apiConfig, accessToken: session.accessToken },
    id,
    compactAddress(parsed.data),
  );
  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
  return { message: "Address updated." };
}

export async function deleteAddress(id: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Faddresses");

  await account.deleteAddress(
    { config: apiConfig, accessToken: session.accessToken },
    id,
  );

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}

/**
 * Makes an address the default.
 *
 * One PATCH, not two. The API clears the flag on the others inside the same
 * transaction, so a client that also "unset" the previous default would be
 * racing a write that has already happened — and would leave the account with no
 * default at all if the second call failed.
 */
export async function setDefaultAddress(id: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login?next=%2Faccount%2Faddresses");

  await account.updateAddress(
    { config: apiConfig, accessToken: session.accessToken },
    id,
    { isDefault: true },
  );

  revalidatePath("/account/addresses");
  revalidatePath("/checkout");
}

const readAddress = (formData: FormData) => ({
  label: String(formData.get("label") ?? "").trim() || undefined,
  street: String(formData.get("street") ?? ""),
  city: String(formData.get("city") ?? ""),
  state: String(formData.get("state") ?? ""),
  country: String(formData.get("country") ?? "NG").toUpperCase(),
  postalCode: String(formData.get("postalCode") ?? "").trim() || undefined,
  // An unchecked checkbox sends nothing at all, so absence is `false` — the one
  // FormData quirk that silently inverts a boolean if you read it as a string.
  isDefault: formData.get("isDefault") !== null,
});

/** Drops `undefined` optionals so `exactOptionalPropertyTypes` stays satisfied. */
const compactAddress = (input: z.infer<typeof addressSchema>) => ({
  street: input.street,
  city: input.city,
  state: input.state,
  country: input.country,
  isDefault: input.isDefault,
  ...(input.label ? { label: input.label } : {}),
  ...(input.postalCode ? { postalCode: input.postalCode } : {}),
});
