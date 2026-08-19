"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import { admin, ctxFor, requireAdmin } from "./auth";
import { fieldErrorsOf, type FormState } from "./form-state";
import { readInteger, readMoney } from "./money-input";

/**
 * The product pool — the screen that decides whether carrying a product is
 * profitable for a vendor at all.
 *
 * ## Why `costPrice < retailPrice` is checked here as well as on the API
 *
 * The API refuses it, and the refusal arrives as a Zod `refine` message attached to
 * a body rather than to a field. Checking first turns that into an error under the
 * cost input, next to the number that is wrong. It also lets the message say WHY:
 * commission is charged on the vendor's margin, so a product where cost meets retail
 * leaves a vendor paying commission on a sale that made them nothing.
 *
 * ## `sku` is never sent, and cannot be updated
 *
 * The API generates it from the name. Nothing here parses a `sku` field, because
 * the create form no longer renders one: the value is `@unique`, immutable, and
 * snapshotted onto every order line, so a typo is permanent and an admin has no way
 * to know which SKUs are taken before submitting. `OrderItem.productSkuSnapshot`
 * exists precisely so history survives — which also means editing a SKU would not
 * correct a single historical record.
 *
 * A consequence worth stating: `admin.isSkuTaken` is unreachable from this file.
 * That branch only fires for a caller that supplied its own SKU, and none here does.
 *
 * ## `stock` cannot be updated either
 *
 * Stock moves only through `adjustStock`, which demands a reason and writes an audit
 * entry, so there is no path here that changes a quantity without saying why.
 */

const idSchema = z.object({ productId: z.uuid("That product id is not valid.") });

const nameSchema = z
  .string()
  .trim()
  .min(2, "A product name needs at least 2 characters.")
  .max(200, "Keep the name under 200 characters.");

function revalidateProduct(productId?: string): void {
  revalidatePath("/products");
  if (productId !== undefined) revalidatePath(`/products/${productId}`);
  // The dashboard counts products by status and reports low stock.
  revalidatePath("/");
}

/**
 * Reads and validates the money and quantity fields shared by create and update.
 *
 * One function so the cost-below-retail rule and the parsing rules cannot diverge
 * between the two forms — which is exactly the kind of thing that drifts, and the
 * drift would be a wrong price rather than a crash.
 */
function readPricing(
  formData: FormData,
  opts: { requireCost: boolean },
):
  | { ok: true; retailPrice?: number; costPrice?: number }
  | { ok: false; fieldErrors: Record<string, string> } {
  const fieldErrors: Record<string, string> = {};
  const rawRetail = String(formData.get("retailPrice") ?? "").trim();
  const rawCost = String(formData.get("costPrice") ?? "").trim();

  // On UPDATE an omitted field means "leave it alone", so blank is allowed there
  // and not on create.
  const wantRetail = opts.requireCost || rawRetail !== "";
  const wantCost = opts.requireCost || rawCost !== "";

  let retailPrice: number | undefined;
  let costPrice: number | undefined;

  if (wantRetail) {
    const parsed = readMoney(rawRetail, "Retail price");
    if (!parsed.ok) fieldErrors["retailPrice"] = parsed.message;
    else retailPrice = parsed.value;
  }
  if (wantCost) {
    const parsed = readMoney(rawCost, "Cost price");
    if (!parsed.ok) fieldErrors["costPrice"] = parsed.message;
    else costPrice = parsed.value;
  }

  // Only checkable when both are in hand. On a partial update that changes one of
  // them, the API is the backstop — it validates against the stored value, which
  // this action does not have.
  if (
    retailPrice !== undefined &&
    costPrice !== undefined &&
    costPrice >= retailPrice
  ) {
    fieldErrors["costPrice"] =
      "Cost must be below retail. Commission is charged on the vendor's margin, so a product where the two meet leaves them paying commission on a sale that made them nothing.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    ...(retailPrice !== undefined ? { retailPrice } : {}),
    ...(costPrice !== undefined ? { costPrice } : {}),
  };
}

export async function createProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const basics = z
    .object({
      name: nameSchema,
      description: z.string().trim().max(4000).optional(),
      categoryId: z.uuid().optional(),
    })
    .safeParse({
      name: formData.get("name"),
      description: String(formData.get("description") ?? "").trim() || undefined,
      categoryId: String(formData.get("categoryId") ?? "").trim() || undefined,
    });
  if (!basics.success) return { fieldErrors: fieldErrorsOf(basics.error) };

  const pricing = readPricing(formData, { requireCost: true });
  if (!pricing.ok) return { fieldErrors: pricing.fieldErrors };

  const fieldErrors: Record<string, string> = {};
  const rawStock = String(formData.get("stock") ?? "").trim();
  let stock: number | undefined;
  if (rawStock !== "") {
    const parsed = readInteger(rawStock, "Opening stock", { min: 0 });
    if (!parsed.ok) fieldErrors["stock"] = parsed.message;
    else stock = parsed.value;
  }
  const rawLowStock = String(formData.get("lowStockAt") ?? "").trim();
  let lowStockAt: number | undefined;
  if (rawLowStock !== "") {
    const parsed = readInteger(rawLowStock, "Low stock threshold", { min: 0 });
    if (!parsed.ok) fieldErrors["lowStockAt"] = parsed.message;
    else lowStockAt = parsed.value;
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { session } = await requireAdmin("/products/new");
  const result = await admin.createProduct(ctxFor(session), {
    name: basics.data.name,
    ...(basics.data.description !== undefined
      ? { description: basics.data.description }
      : {}),
    ...(basics.data.categoryId !== undefined
      ? { categoryId: basics.data.categoryId }
      : {}),
    retailPrice: pricing.retailPrice!,
    costPrice: pricing.costPrice!,
    ...(stock !== undefined ? { stock } : {}),
    ...(lowStockAt !== undefined ? { lowStockAt } : {}),
  });

  // No `isSkuTaken` branch: nothing above sends a `sku`, so the API generates one
  // and settles its own collisions. See the module header.
  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidateProduct(result.data.id);
  // Straight to the edit page: a new product is DRAFT with no images, and cannot be
  // published until it has one. Landing back on the list would hide the next step.
  redirect(`/products/${result.data.id}`);
}

export async function updateProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const basics = z
    .object({
      productId: z.uuid(),
      name: nameSchema.optional(),
      description: z.string().trim().max(4000).optional(),
      weightGrams: z.coerce.number().int().min(0).optional(),
      // Editable here, unlike `stock`. This is the ALERT THRESHOLD, not a quantity —
      // changing it moves no inventory, so it needs no reason and no audit entry.
      // It was on the form before it was parsed here, which meant editing it saved
      // silently and did nothing.
      lowStockAt: z.coerce.number().int().min(0).optional(),
    })
    .safeParse({
      productId: formData.get("productId"),
      name: String(formData.get("name") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || undefined,
      weightGrams: String(formData.get("weightGrams") ?? "").trim() || undefined,
      lowStockAt: String(formData.get("lowStockAt") ?? "").trim() || undefined,
    });
  if (!basics.success) return { fieldErrors: fieldErrorsOf(basics.error) };

  const pricing = readPricing(formData, { requireCost: false });
  if (!pricing.ok) return { fieldErrors: pricing.fieldErrors };

  // `""` clears the category (the API accepts null); a missing field leaves it.
  const rawCategory = formData.has("categoryId")
    ? String(formData.get("categoryId") ?? "").trim()
    : undefined;

  const { productId, ...rest } = basics.data;

  const { session } = await requireAdmin(`/products/${productId}`);
  const result = await admin.updateProduct(ctxFor(session), productId, {
    ...rest,
    ...(pricing.retailPrice !== undefined
      ? { retailPrice: pricing.retailPrice }
      : {}),
    ...(pricing.costPrice !== undefined ? { costPrice: pricing.costPrice } : {}),
    ...(rawCategory !== undefined
      ? { categoryId: rawCategory === "" ? null : rawCategory }
      : {}),
  });

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That product no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(productId);
  return { message: "Saved." };
}

/**
 * Move the platform pool by a signed delta.
 *
 * A delta rather than "set stock to N" because two admins reading the same stale
 * page and both setting 100 lose one of the adjustments silently, whereas two deltas
 * of +50 both land. The reason is required and lands in the audit trail — it is what
 * answers "why is there 40 less stock than the purchase orders say" six months later.
 */
export async function adjustStock(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse({ productId: formData.get("productId") });
  if (!id.success) return { fieldErrors: fieldErrorsOf(id.error) };

  const fieldErrors: Record<string, string> = {};

  const delta = readInteger(formData.get("delta"), "Adjustment", {
    allowNegative: true,
  });
  if (!delta.ok) fieldErrors["delta"] = delta.message;
  else if (delta.value === 0) {
    fieldErrors["delta"] = "Enter a non-zero adjustment — the API rejects 0.";
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (reason === "") {
    fieldErrors["reason"] = "A reason is required, and is recorded in the activity log.";
  } else if (reason.length > 500) {
    fieldErrors["reason"] = "Keep the reason under 500 characters.";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const { session } = await requireAdmin(`/products/${id.data.productId}`);
  const result = await admin.adjustStock(ctxFor(session), id.data.productId, {
    delta: (delta as { ok: true; value: number }).value,
    reason,
  });

  if (!result.ok) {
    if (admin.isInsufficientStock(result.error)) {
      return {
        fieldErrors: {
          delta:
            "That would take the pool below zero. Only unsold units can be removed — stock a vendor has already bought is theirs.",
        },
      };
    }
    if (admin.isNotFound(result.error)) return { error: "That product no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(id.data.productId);
  return { message: `Pool stock is now ${String(result.data.stock)}.` };
}

/** DRAFT → AVAILABLE. Needs at least one image and a positive price. */
export async function publishProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.publishProduct(ctxFor(session), parsed.data.productId);

  if (!result.ok) {
    if (admin.isPublishBlocked(result.error)) {
      // The precondition is stated on the screen before the click too; this is the
      // backstop for a page that went stale between render and submit.
      return {
        error:
          result.error.code === "NO_IMAGES"
            ? "Add at least one image first — a product with no photo cannot go into the pool."
            : "Set a positive retail price first.",
      };
    }
    if (admin.isNotFound(result.error)) return { error: "That product no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(parsed.data.productId);
  return { message: "Published. Vendors can now buy stock of this product." };
}

export async function unpublishProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.unpublishProduct(ctxFor(session), parsed.data.productId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That product no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(parsed.data.productId);
  return {
    // The thing an admin will otherwise expect and not get.
    message:
      "Withdrawn from the pool. Vendors who already bought stock keep selling it — they paid for those units.",
  };
}

export async function softDeleteProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.deleteProduct(ctxFor(session), parsed.data.productId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That product no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(parsed.data.productId);
  return { message: "Deleted. Order history and existing vendor stock are unaffected." };
}

export async function restoreProduct(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema.safeParse({ productId: formData.get("productId") });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.restoreProduct(ctxFor(session), parsed.data.productId);

  if (!result.ok) {
    if (admin.isNotFound(result.error)) return { error: "That product no longer exists." };
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(parsed.data.productId);
  return { message: "Restored." };
}

export async function addAttribute(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema
    .extend({
      name: z.string().trim().min(1, "Name the attribute.").max(80),
      value: z.string().trim().min(1, "Give it a value.").max(200),
    })
    .safeParse({
      productId: formData.get("productId"),
      name: formData.get("name"),
      value: formData.get("value"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.addProductAttribute(ctxFor(session), parsed.data.productId, {
    name: parsed.data.name,
    value: parsed.data.value,
  });

  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidateProduct(parsed.data.productId);
  return { message: "Added." };
}

export async function removeAttribute(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema
    .extend({ attributeId: z.uuid() })
    .safeParse({
      productId: formData.get("productId"),
      attributeId: formData.get("attributeId"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.deleteProductAttribute(
    ctxFor(session),
    parsed.data.productId,
    parsed.data.attributeId,
  );

  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidateProduct(parsed.data.productId);
  return { message: "Removed." };
}
