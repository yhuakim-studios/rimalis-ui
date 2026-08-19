"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@/components/primitives";
import { FormBanner } from "@/components/forms";
import { requestImageUploadTicket } from "@/lib/product-image-actions";

/**
 * The three-step image upload, from the browser's side.
 *
 *   1. ask a Server Action for a signed ticket
 *   2. PUT the bytes straight to Supabase Storage — cross-origin, from here
 *   3. ask a Server Action to register the resulting URL
 *
 * Step 2 is why this is a Client Component at all: the bytes must not pass through
 * the Worker. See the header of lib/product-image-actions.ts.
 *
 * ## The retry is specific, not generic
 *
 * If step 2 succeeds and step 3 fails, the object is in the bucket with no database
 * row. Re-running the whole flow would upload the same bytes again and leave a second
 * orphan. So a failure after upload keeps the `publicUrl` and offers "register it" —
 * the cheap half — rather than "try again".
 *
 * ## Content types are checked here AND in the action
 *
 * Here so the admin gets an immediate answer without a round trip; there because a
 * Server Action is a public POST endpoint and a client-side check is a courtesy
 * rather than a gate. SVG is excluded deliberately — it is a script container served
 * from our own origin.
 */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

type Phase =
  | { kind: "idle" }
  | { kind: "uploading" }
  /** Bytes are in the bucket; only the database row is missing. */
  | { kind: "registering"; publicUrl: string }
  | { kind: "orphaned"; publicUrl: string; message: string }
  | { kind: "error"; message: string };

export function ImageUploader({
  productId,
  hasImages,
}: {
  productId: string;
  /** Drives the copy: the first image is a precondition for publishing. */
  hasImages: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  // Controlled state rather than a ref, because `Input` does not forward one — and
  // adding ref forwarding to a primitive that is byte-identical in three apps for
  // the sake of one uploader is a worse trade than holding a string here.
  const [altText, setAltText] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  /** Step 3, on its own so the orphan retry can call it without re-uploading. */
  async function register(publicUrl: string): Promise<void> {
    setPhase({ kind: "registering", publicUrl });

    const body = new FormData();
    body.set("productId", productId);
    body.set("url", publicUrl);
    const alt = altText.trim();
    if (alt !== "") body.set("altText", alt);
    // The first image becomes the primary one automatically — a product whose only
    // image is not primary renders no thumbnail anywhere.
    if (!hasImages) body.set("isPrimary", "on");

    const { registerProductImage } = await import("@/lib/product-image-actions");
    const result = await registerProductImage({}, body);

    if (result.error !== undefined) {
      setPhase({ kind: "orphaned", publicUrl, message: result.error });
      return;
    }

    setPhase({ kind: "idle" });
    if (fileRef.current) fileRef.current.value = "";
    setAltText("");
  }

  async function onUpload(): Promise<void> {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setPhase({ kind: "error", message: "Choose a file first." });
      return;
    }
    if (!(ACCEPTED as readonly string[]).includes(file.type)) {
      setPhase({
        kind: "error",
        message: "Use a JPEG, PNG, WebP or AVIF. SVG is not accepted.",
      });
      return;
    }

    setPhase({ kind: "uploading" });

    const ticketResult = await requestImageUploadTicket(productId, file.name, file.type);
    if (!ticketResult.ok) {
      setPhase({ kind: "error", message: ticketResult.message });
      return;
    }

    const { ticket } = ticketResult;

    try {
      // Straight to Supabase Storage. `content-type` must match what the ticket was
      // signed for, or Storage rejects the PUT.
      const response = await fetch(ticket.uploadUrl, {
        method: "PUT",
        headers: { "content-type": ticket.contentType },
        body: file,
      });
      if (!response.ok) {
        setPhase({
          kind: "error",
          message: `Upload failed (${String(response.status)}). Nothing was saved — try again.`,
        });
        return;
      }
    } catch {
      // A network failure here leaves NO object and no row, so a plain retry is
      // safe and there is nothing to clean up.
      setPhase({
        kind: "error",
        message: "Upload failed before it reached storage. Nothing was saved — try again.",
      });
      return;
    }

    await register(ticket.publicUrl);
  }

  const busy = phase.kind === "uploading" || phase.kind === "registering";

  return (
    <div className="flex flex-col gap-3">
      {!hasImages && (
        <p className="text-caption text-ink-muted">
          This product has no image, so it cannot be published. The first one you add
          becomes the primary.
        </p>
      )}

      {phase.kind === "error" && <FormBanner tone="error">{phase.message}</FormBanner>}

      {phase.kind === "orphaned" && (
        <FormBanner tone="error">
          {phase.message} The file uploaded fine — only the record is missing, so
          there is no need to upload it again.
        </FormBanner>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-caption font-medium">Image file</span>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPTED.join(",")}
            disabled={busy}
            className="text-caption file:mr-3 file:rounded-input file:border-0 file:bg-canvas file:px-3 file:py-2 file:text-caption"
          />
        </label>

        <div className="min-w-[200px] flex-1">
          <Input
            label="Alt text"
            name="altText"
            value={altText}
            onChange={(event) => setAltText(event.target.value)}
            disabled={busy}
            hint="Describes the photo for screen readers. Falls back to the product name."
          />
        </div>

        {phase.kind === "orphaned" ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => void register(phase.publicUrl)}
          >
            Register it
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            loading={busy}
            onClick={() => void onUpload()}
          >
            {phase.kind === "registering" ? "Saving" : "Upload"}
          </Button>
        )}
      </div>
    </div>
  );
}
