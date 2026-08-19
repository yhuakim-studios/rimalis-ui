import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge, Card } from "@/components/primitives";
import { ErrorState } from "@/components/feedback";
import { ConfirmAction, productStatus } from "@/components/admin";
import {
  AttributeEditor,
  ImageList,
  ImageUploader,
  ProductMetaForm,
  StockAdjustForm,
} from "@/components/products";
import type { CategoryOption } from "@/components/products/ProductMetaForm";
import { admin, categories, ctxFor, requireAdmin } from "@/lib/auth";
import { isMissing } from "@/lib/errors";
import { absoluteDateTime, badgeTone } from "@/lib/format";
import { formatMoney, formatNaira, parseMoney, subtract } from "@/lib/money";
import { buildCategoryTree, flattenTree } from "@/lib/category-tree";
import {
  publishProduct,
  restoreProduct,
  softDeleteProduct,
  unpublishProduct,
} from "@/lib/product-actions";

export const metadata: Metadata = { title: "Product" };

/**
 * One pool product: everything an admin can change about it.
 *
 * ## The margin is stated, not left to be worked out
 *
 * Retail minus cost, and the commission note beside it. This is the screen that
 * decides vendor profitability — commission is charged on that gap, so a thin one
 * means carrying the product is not worth a vendor's money. Two prices in two fields
 * do not communicate that; the subtraction does.
 *
 * ## Publish states its preconditions BEFORE the click
 *
 * `PATCH /:id/publish` needs at least one image and a positive price, and returns
 * NO_IMAGES / NO_PRICE otherwise. Both are knowable from the data already on this
 * page, so the button is disabled with the reason rather than offered and refused.
 * The action still handles both codes as a backstop for a page that went stale.
 *
 * ## Unpublish does less than it sounds like
 *
 * It stops NEW listings. Vendors who already bought stock keep selling it — they paid
 * for those units. An admin expecting the product to vanish from the storefront needs
 * to be told, so the consequence copy says it.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const { session } = await requireAdmin(`/products/${productId}`);
  const ctx = ctxFor(session);

  const [result, categoryResult] = await Promise.all([
    admin.getProduct(ctx, productId),
    categories.listAll(ctx),
  ]);

  if (!result.ok) {
    if (isMissing(result.error)) notFound();
    return <ErrorState error={result.error} title="Couldn't load this product" />;
  }

  const product = result.data;
  const status = productStatus(product.status);
  const margin = subtract(parseMoney(product.retailPrice), parseMoney(product.costPrice));
  const isDeleted = product.deletedAt !== null;
  const hasImages = product.images.length > 0;
  const priceIsPositive = parseMoney(product.retailPrice) > 0;

  const categoryOptions: CategoryOption[] = categoryResult.ok
    ? flattenTree(buildCategoryTree(categoryResult.data).roots).map(
        ({ category, depth }) => ({
          id: category.id,
          // U+00A0 as an escape — ordinary spaces collapse inside an <option>.
          label: `${"   ".repeat(depth)}${category.name}`,
        }),
      )
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/products"
          prefetch={false}
          className="w-fit text-meta text-ink-muted underline decoration-divider-strong underline-offset-4 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          ← All products
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading font-semibold tracking-tight">{product.name}</h1>
          <Badge tone={badgeTone(status.tone)}>{status.label}</Badge>
          {isDeleted && <Badge tone="danger">Deleted</Badge>}
        </div>
        <p className="font-mono text-caption text-ink-muted">{product.sku}</p>
      </div>

      {isDeleted && (
        <Card tone="flat" className="border-danger/40 bg-danger-soft">
          <div className="flex gap-3">
            <AlertTriangle
              className="size-5 shrink-0 text-danger"
              strokeWidth={1.75}
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <p className="text-caption font-semibold text-ink">
                This product is deleted
              </p>
              <p className="text-caption text-ink-muted">
                It is hidden from the pool and cannot be listed. Order history and
                stock vendors already bought are unaffected. Restore it below if this
                was a mistake — the SKU stays reserved either way, which is why
                creating a replacement with the same SKU fails.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Cost to vendors" value={formatMoney(product.costPrice)} />
        <Figure label="Retail price" value={formatMoney(product.retailPrice)} />
        <Figure
          label="Vendor margin"
          value={formatNaira(margin)}
          note="Commission is charged on this, not on the sale price."
          tone={margin <= 0 ? "danger" : undefined}
        />
      </div>

      <Card>
        <h2 className="mb-4 text-section font-semibold">Details</h2>
        <ProductMetaForm product={product} categories={categoryOptions} />
      </Card>

      <Card>
        <h2 className="mb-1 text-section font-semibold">Pool stock</h2>
        <StockAdjustForm productId={product.id} currentStock={product.stock} />
      </Card>

      <Card>
        <h2 className="mb-1 text-section font-semibold">Images</h2>
        <p className="mb-4 text-meta text-ink-subtle">
          Uploaded straight to storage from your browser — the file never passes
          through this app.
        </p>
        <div className="flex flex-col gap-5">
          <ImageUploader productId={product.id} hasImages={hasImages} />
          <ImageList productId={product.id} images={product.images} />
        </div>
      </Card>

      <Card>
        <h2 className="mb-4 text-section font-semibold">Attributes</h2>
        <AttributeEditor productId={product.id} attributes={product.attributes} />
      </Card>

      <Card>
        <h2 className="mb-1 text-section font-semibold">Availability</h2>
        <p className="mb-4 text-caption text-ink-muted">
          A draft is invisible to vendors. Publishing puts it in the pool so vendors
          can buy stock; withdrawing it stops new listings but does not stop vendors
          selling units they already paid for.
        </p>

        <div className="flex flex-wrap gap-3">
          <ConfirmAction
            action={publishProduct}
            label="Publish to pool"
            confirmLabel="Publish"
            consequence="Vendors can buy stock of this product immediately, at the cost price above."
            hidden={{ productId: product.id }}
            {...(product.status === "AVAILABLE"
              ? { disabledReason: "Already in the pool." }
              : isDeleted
                ? { disabledReason: "Restore it first." }
                : !hasImages
                  ? {
                      // Stated before the click rather than after a 400.
                      disabledReason: "Add at least one image first.",
                    }
                  : !priceIsPositive
                    ? { disabledReason: "Set a positive retail price first." }
                    : {})}
          />

          <ConfirmAction
            action={unpublishProduct}
            label="Withdraw from pool"
            confirmLabel="Withdraw"
            consequence="No vendor can create a NEW listing for it. Vendors who already bought stock keep selling those units — they paid for them, so the product stays on the storefront until they run out."
            hidden={{ productId: product.id }}
            {...(product.status === "AVAILABLE"
              ? {}
              : { disabledReason: "Only a product in the pool can be withdrawn." })}
          />

          {isDeleted ? (
            <ConfirmAction
              action={restoreProduct}
              label="Restore"
              confirmLabel="Restore product"
              consequence="It becomes visible again with the status it had before."
              hidden={{ productId: product.id }}
            />
          ) : (
            <ConfirmAction
              action={softDeleteProduct}
              label="Delete"
              confirmLabel="Delete product"
              consequence="A soft delete — reversible, and order history plus stock vendors already bought are untouched. The SKU stays reserved, so a replacement cannot reuse it."
              danger
              hidden={{ productId: product.id }}
            />
          )}
        </div>
      </Card>

      <p className="text-meta text-ink-subtle">
        Created {absoluteDateTime(product.createdAt)} · updated{" "}
        {absoluteDateTime(product.updatedAt)}
        {product.lowStockAlertedAt !== null &&
          ` · low-stock alert last sent ${absoluteDateTime(product.lowStockAlertedAt)}`}
      </p>
    </div>
  );
}

function Figure({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "danger";
}) {
  return (
    <Card tone="flat" padding="sm">
      <p className="text-meta text-ink-subtle">{label}</p>
      <p
        className={`text-section font-semibold tabular-nums ${
          tone === "danger" ? "text-danger" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-1 text-meta text-ink-subtle">{note}</p>}
    </Card>
  );
}
