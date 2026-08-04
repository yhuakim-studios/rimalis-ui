"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buildCatalogueQuery, parseCatalogueParams } from "@/lib/search-params";

export function SearchBox({ size = "md" }: { size?: "md" | "lg" }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = parseCatalogueParams(Object.fromEntries(searchParams.entries()));
  const [value, setValue] = useState(current.q ?? "");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = value.trim();
    router.push(
      `/products${buildCatalogueQuery({
        ...current,
        ...(q ? { q } : { q: undefined }),
        page: undefined,
      })}`,
    );
  };

  return (
    <form onSubmit={onSubmit} role="search" className="w-full">
      <div className="relative flex items-center w-full">
        <Search className="absolute left-4 size-4.5 text-ink-muted pointer-events-none" strokeWidth={2} />
        <input
          type="search"
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search for products, brands and more..."
          autoComplete="off"
          className={`w-full rounded-full border border-divider-strong bg-canvas/60 pl-11 pr-14 text-caption text-ink placeholder:text-ink-muted/80 focus:border-ink focus:bg-surface focus:outline-none transition-all duration-150 ${
            size === "lg" ? "h-12 text-body" : "h-10"
          }`}
        />
        <button
          type="submit"
          aria-label="Search"
          className={`absolute right-1.5 flex place-items-center justify-center rounded-2xl bg-ink text-white transition-transform duration-150 active:scale-95 hover:bg-black/90 ${
            size === "lg" ? "size-9" : "size-8"
          }`}
        >
          <Search className="size-4" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  );
}
