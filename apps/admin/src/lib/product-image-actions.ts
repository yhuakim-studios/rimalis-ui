"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { shopperMessage } from "@rimalis/api-client";
import type { ImageUploadTicket } from "@rimalis/types";
import { admin, ctxFor, requireAdmin } from "./auth";
import { fieldErrorsOf, type FormState } from "./form-state";

/**
 * Product images — a three-step flow, and step 2 is not here.
 *
 *   1. `requestImageUploadTicket()`  → a signed ticket from the API
 *   2. the BROWSER PUTs the bytes straight to Supabase Storage  ← not a Server Action
 *   3. `registerProductImage()`      → the database row
 *
 * ## Why the bytes do not pass through this app
 *
 * This is the API's own design and it is right: a Cloudflare Worker has a hard
 * request-body limit and a CPU budget, and proxying a 4MB photo through a Server
 * Action to spend both is pure cost for no benefit. So the API hands out a
 * short-lived ticket scoped to one server-generated object path, and the browser
 * uploads directly.
 *
 * The ticket is safe to hand the browser: it authorises writing exactly one path
 * the SERVER chose (`<productId>/<uuid>.<ext>` — never built from the filename) and
 * it expires.
 *
 * ## The two failure modes, and why only one needs a retry
 *
 * A failed step 2 leaves nothing: no object, no row. Harmless.
 *
 * A failed step 3 leaves an uploaded object with no database row — an orphan in the
 * bucket. Also harmless (the API's own comment: a stray file costs pennies), and
 * recoverable: the uploader offers "retry registering" with the SAME `publicUrl`
 * rather than re-uploading the bytes.
 */

const idSchema = z.object({ productId: z.uuid("That product id is not valid.") });

const CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

function revalidateProduct(productId: string): void {
  revalidatePath(`/products/${productId}`);
  // The list shows a "No image" badge and the primary thumbnail.
  revalidatePath("/products");
}

/**
 * Step 1. Returns the ticket to the client, which then PUTs to it.
 *
 * Not a `FormState` action — the client needs the ticket object, not a form result,
 * and this is called from an event handler rather than a `<form action>`.
 */
export async function requestImageUploadTicket(
  productId: string,
  fileName: string,
  contentType: string,
): Promise<
  { ok: true; ticket: ImageUploadTicket } | { ok: false; message: string }
> {
  const parsed = z
    .object({
      productId: z.uuid(),
      fileName: z.string().trim().min(1).max(255),
      // Narrowed here as well as in the browser: a Server Action is a public POST
      // endpoint, so the client-side check is a courtesy and this is the gate.
      contentType: z.enum(CONTENT_TYPES),
    })
    .safeParse({ productId, fileName, contentType });

  if (!parsed.success) {
    return {
      ok: false,
      message: "That file type isn't supported. Use a JPEG, PNG, WebP or AVIF.",
    };
  }

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.createImageUploadUrl(
    ctxFor(session),
    parsed.data.productId,
    { fileName: parsed.data.fileName, contentType: parsed.data.contentType },
  );

  if (!result.ok) {
    if (admin.isStorageUnavailable(result.error)) {
      // Infrastructure, not input. Worth distinguishing so the copy invites a retry
      // rather than sending the admin looking for a problem with their file.
      return {
        ok: false,
        message: "Storage is unreachable right now. Try again in a moment.",
      };
    }
    return { ok: false, message: shopperMessage(result.error) };
  }

  return { ok: true, ticket: result.data };
}

/** Step 3. Registers an object that is already in the bucket. */
export async function registerProductImage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema
    .extend({
      url: z.url("That is not a valid URL."),
      altText: z.string().trim().max(300).optional(),
      isPrimary: z.boolean(),
    })
    .safeParse({
      productId: formData.get("productId"),
      url: formData.get("url"),
      altText: String(formData.get("altText") ?? "").trim() || undefined,
      isPrimary: formData.has("isPrimary"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.addProductImage(ctxFor(session), parsed.data.productId, {
    url: parsed.data.url,
    ...(parsed.data.altText !== undefined ? { altText: parsed.data.altText } : {}),
    isPrimary: parsed.data.isPrimary,
  });

  if (!result.ok) {
    if (admin.isImageUrlNotOwned(result.error)) {
      return {
        error:
          "That URL is outside our own storage bucket, so the API refused it. Images have to be uploaded here rather than linked from another site.",
      };
    }
    return { error: shopperMessage(result.error) };
  }

  revalidateProduct(parsed.data.productId);
  return { message: "Image added." };
}

export async function updateProductImage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema
    .extend({
      imageId: z.uuid(),
      altText: z.string().trim().max(300).optional(),
      isPrimary: z.boolean(),
    })
    .safeParse({
      productId: formData.get("productId"),
      imageId: formData.get("imageId"),
      altText: String(formData.get("altText") ?? "").trim() || undefined,
      isPrimary: formData.has("isPrimary"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.updateProductImage(
    ctxFor(session),
    parsed.data.productId,
    parsed.data.imageId,
    {
      ...(parsed.data.altText !== undefined ? { altText: parsed.data.altText } : {}),
      isPrimary: parsed.data.isPrimary,
    },
  );

  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidateProduct(parsed.data.productId);
  return { message: "Saved." };
}

export async function deleteProductImage(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = idSchema
    .extend({ imageId: z.uuid() })
    .safeParse({
      productId: formData.get("productId"),
      imageId: formData.get("imageId"),
    });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

  const { session } = await requireAdmin(`/products/${parsed.data.productId}`);
  const result = await admin.deleteProductImage(
    ctxFor(session),
    parsed.data.productId,
    parsed.data.imageId,
  );

  if (!result.ok) return { error: shopperMessage(result.error) };

  revalidateProduct(parsed.data.productId);
  return {
    // Deleting the last image does not unpublish the product — it leaves an
    // AVAILABLE product that could not be published again if it were withdrawn.
    message: "Image removed.",
  };
}
