"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/primitives";

/**
 * A submit button that knows when its own form is in flight.
 *
 * `useFormStatus` reads the status of the **nearest enclosing form**, which is
 * why this has to be its own component rather than a hook call in the page: the
 * hook returns `pending: false` when called from the component that renders the
 * `<form>` itself. That is the single most common way a loading state silently
 * never appears.
 *
 * The pending state disables the button, which matters more here than it looks:
 * a double-submitted sign-in is harmless, but a double-submitted *checkout* is
 * the double-order that the idempotency key exists to catch — and catching it
 * with a disabled button is better than catching it with a key, because nothing
 * has to be reconciled afterwards.
 */

export interface SubmitButtonProps extends Omit<ButtonProps, "type" | "loading"> {
  children: React.ReactNode;
}

export function SubmitButton({ children, disabled, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} disabled={disabled} {...rest}>
      {children}
    </Button>
  );
}
