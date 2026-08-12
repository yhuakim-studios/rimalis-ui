import type { ReactNode } from "react";
import { Container } from "@/components/layout";

/**
 * The frame around sign-in, registration and verification.
 *
 * A route **group** — `(auth)` in parentheses — so these three share a layout
 * without `/auth` appearing in any URL. `/login` is a URL people type, bookmark
 * and are sent to by the API's own emails; `/auth/login` would be a different
 * one, and the API hardcodes its links off `APP_URL`.
 *
 * Narrow measure and centred, which is not decoration: a form field that runs
 * the full 1320px page width is genuinely harder to fill in, because the label
 * and the far end of the input are a head-turn apart on a wide screen.
 */

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <Container className="py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </Container>
  );
}
