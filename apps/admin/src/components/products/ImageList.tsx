"use client";

import { useActionState } from "react";
import type { ProductImage } from "@rimalis/types";
import { Input } from "@/components/primitives";
import { FormBanner, SubmitButton } from "@/components/forms";
import { ConfirmAction } from "@/components/admin";
import { deleteProductImage, updateProductImage } from "@/lib/product-image-actions";
import type { FormState } from "@/lib/form-state";

/**
 * The images already on a product.
 *
 * ## A plain `<img>`, not `next/image`
 *
 * `images.unoptimized` is on for this app — `next/image` optimisation on Cloudflare
 * routes through Cloudflare Images, a separately billed product — so `next/image`
 * would add a wrapper and a layout pass for no benefit over a fixed-size `<img>`.
 * Same reasoning as the vendor app's Header. Explicit width and height so the row
 * does not reflow as thumbnails arrive.
 *
 * ## Deleting the last image is allowed, and warned about
 *
 * The API permits it and does NOT unpublish the product, which leaves an AVAILABLE
 * product that could not be published again if it were ever withdrawn. Worth saying
 * at the moment of the click rather than discovering later.
 */
export function ImageList({
  productId,
  images,
}: {
  productId: string;
  images: readonly ProductImage[];
}) {
  if (images.length === 0) {
    return (
      <p className="text-caption text-ink-muted">
        No images yet. Add one above — a product cannot be published without at least
        one.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {images.map((image) => (
        <ImageRow
          key={image.id}
          productId={productId}
          image={image}
          isOnly={images.length === 1}
        />
      ))}
    </ul>
  );
}

function ImageRow({
  productId,
  image,
  isOnly,
}: {
  productId: string;
  image: ProductImage;
  isOnly: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateProductImage,
    {},
  );

  return (
    <li className="flex flex-col gap-3 rounded-input border border-divider p-3">
      <div className="flex flex-wrap items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- see the header */}
        <img
          src={image.url}
          alt={image.altText ?? ""}
          width={72}
          height={72}
          className="size-[72px] shrink-0 rounded-input bg-canvas object-cover"
        />

        <form action={formAction} className="flex min-w-0 flex-1 flex-col gap-3">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="imageId" value={image.id} />

          {state.error && <FormBanner tone="error">{state.error}</FormBanner>}
          {state.message && <FormBanner tone="success">{state.message}</FormBanner>}

          <Input
            label="Alt text"
            name="altText"
            defaultValue={image.altText ?? ""}
            hint="Describes the photo for screen readers."
            error={state.fieldErrors?.["altText"]}
          />

          <label className="flex w-fit items-center gap-2 text-caption">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={image.isPrimary}
              className="size-4"
            />
            Primary image
            <span className="text-meta text-ink-subtle">
              — the one shown in lists and on cards
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="secondary">Save</SubmitButton>
            <ConfirmAction
              action={deleteProductImage}
              label="Remove"
              confirmLabel="Remove image"
              consequence={
                isOnly
                  ? "This is the only image. Removing it does not withdraw the product — it leaves a published product that could not be published again if it were ever withdrawn."
                  : "The file stays in storage; only the record is removed."
              }
              danger
              hidden={{ productId, imageId: image.id }}
            />
          </div>
        </form>
      </div>
    </li>
  );
}
