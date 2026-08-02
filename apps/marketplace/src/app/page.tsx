/**
 * Placeholder. Public storefront.
 *
 * Part B is the scaffold: buildable empty shells that prove the workspace,
 * the shared config and the Cloudflare deploy path all work, with ZERO API
 * coupling. Features are Part C.
 *
 * Browse, product detail, cart, checkout — built first, end to end.
 */
export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <div>
        <p className="text-sm font-medium text-brand-600">Public storefront</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight">Digistore</h1>
      </div>

      <p className="text-zinc-600">
        Scaffold only — no features yet. This shell exists to prove the
        workspace builds and deploys before any API contract is consumed.
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">Dev port</dt>
        <dd className="font-mono">3000</dd>
        <dt className="text-zinc-500">Deploys to</dt>
        <dd className="font-mono">shop.example.com</dd>
      </dl>
    </main>
  );
}
