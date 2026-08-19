"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { categories, ctxFor, requireAdmin } from "./auth";
import { fieldErrorsOf, type FormState } from "./form-state";

/**
 * The taxonomy. Small, shared, and load-bearing.
 *
 * Every product hangs off a category and the storefront's filter panel is built
 * from this tree, so a rename is visible to every shopper immediately and a delete
 * is not reversible — there is no `deletedAt` on a category. That is why the API
 * refuses to delete one that anything depends on, and why those two 409s get
 * actionable copy rather than a generic banner.
 *
 * ## `parentId` has three states, not two
 *
 * Absent means "leave the parent alone". `null` means "make this a top-level
 * category". A form field cannot express both with one value, so the update action
 * reads a sentinel: the select's empty option submits `""`, which this maps to
 * `null`, and a form that omits the field entirely leaves the parent unchanged.
 * Sending `""` straight through would be a validation error, and treating absent as
 * `null` would silently promote a subcategory every time someone renamed it.
 */

const idSchema = z.object({ categoryId: z.uuid("That category id is not valid.") });

const nameSchema = z
  .string()
  .trim()
  .min(2, "A category name needs at least 2 characters.")
  .max(120, "Keep the name under 120 characters.");

const createSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(2000).optional(),
  parentId: z.uuid().optional(),
});

const updateSchema = idSchema.extend({
  name: nameSchema.optional(),
  description: z.string().trim().max(2000).optional(),
  // `null` promotes to the top level; `undefined` leaves it alone. See the header.
  parentId: z.union([z.uuid(), z.null()]).optional(),
});

/**
 * The category tree feeds the product filter and the product form, so a change
 * here has to invalidate more than its own page.
 */
function revalidateTaxonomy(): void {
  revalidatePath("/categories");
  revalidatePath("/products");
}

/** `""` from an empty `<select>` means "top level"; a missing field means "unchanged". */
function readParent(formData: FormData): string | null | undefined {
  if (!formData.has("parentId")) return undefined;
  const raw = String(formData.get("parentId") ?? "").trim();
  return raw === "" ? null : raw;
}

export async function createCategory(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parent = readParent(formData);
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: String(formData.get("description") ?? "").trim() || undefined,
    // On CREATE there is no "unchanged" — absent and empty both mean top level, so
    // `null` collapses to omitting the field.
    ...(typeof parent === "string" ? { parentId: parent } : {}),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/categories");
  const result = await categories.create(ctxFor(session), parsed.data);

  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidateTaxonomy();
  return { message: `Added ${parsed.data.name}.` };
}

export async function updateCategory(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: String(formData.get("name") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
    parentId: readParent(formData),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { categoryId, ...body } = parsed.data;

  const { session } = await requireAdmin("/categories");
  const result = await categories.update(ctxFor(session), categoryId, body);

  if (!result.ok) return { error: categoryErrorCopy(result.error) };

  revalidateTaxonomy();
  return { message: "Saved." };
}

export async function deleteCategory(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ categoryId: formData.get("categoryId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin("/categories");
  const result = await categories.remove(ctxFor(session), parsed.data.categoryId);

  if (!result.ok) return { error: categoryErrorCopy(result.error) };

  revalidateTaxonomy();
  return { message: "Deleted." };
}

/**
 * The two 409s and the cycle 400, as instructions rather than failures.
 *
 * "Conflict" tells an admin nothing. "Move or delete its products first" tells them
 * the next step, which is the difference between a dead end and a two-click task.
 */
function categoryErrorCopy(error: Parameters<typeof shopperMessage>[0]): string {
  if (error.kind === "http") {
    if (error.code === "CATEGORY_HAS_PRODUCTS") {
      return "This category still has products in it. Move them to another category first — deleting a category is not reversible.";
    }
    if (error.code === "CATEGORY_HAS_CHILDREN") {
      return "This category has subcategories. Delete or re-parent those first.";
    }
    if (error.code === "CATEGORY_CYCLE") {
      return "A category can't be moved inside one of its own subcategories.";
    }
  }
  return shopperMessage(error);
}
