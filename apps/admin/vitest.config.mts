import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Why this app has a vitest config and the marketplace does not.
 *
 * `lib/dashboard.ts` starts with `import "server-only"` — the guard that turns "this
 * module leaked into a client bundle" from a runtime surprise into a build error.
 * That package has two entries: `empty.js` behind the `react-server` export
 * condition, and an `index.js` that throws unconditionally behind `default`. A test
 * runner gets `default`, so importing the module fails before a single assertion.
 *
 * The alias points at the package's **own** `empty.js` — the exact file Next
 * resolves inside a Server Component. Not a stub of our own, and not a hack: it is
 * the published artefact for this case.
 *
 * `resolve.conditions: ["react-server"]` is the tidier-looking version and does not
 * work here. Vite honours conditions for what it resolves itself, but a bare import
 * from a transformed file is externalised and handed to Node, which knows nothing
 * about them and picks `main`. Inlining the package under `server.deps.inline` does
 * not change the outcome either. Both were tried; this is what actually resolves.
 *
 * The alternatives were worse. Dropping `server-only` from `dashboard.ts` would
 * trade a real safety net for test convenience on a module that reads order history
 * and must never reach a browser. Copying the maths into the test would test a copy,
 * and a copy of money arithmetic is precisely the thing that drifts.
 *
 * The `@/` alias mirrors the one in tsconfig.json, which vitest does not read.
 */
export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
