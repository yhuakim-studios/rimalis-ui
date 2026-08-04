"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { 
  ShoppingBag, 
  Heart, 
  RefreshCw, 
  Search, 
  Headphones, 
  ChevronDown, 
  Menu,
  ShoppingCart,
  Sparkles
} from "lucide-react";
import { Container } from "./Container";
import { SearchBox } from "./SearchBox";

function SearchBoxFallback() {
  return (
    <div
      aria-hidden
      className="h-12 w-full rounded-pill border border-divider-strong bg-surface"
    />
  );
}

export function Header() {
  const [cartCount, setCartCount] = useState(2);
  const [wishlistCount, setWishlistCount] = useState(0);

  return (
    <header className="sticky top-0 z-30 bg-surface border-b border-divider shadow-sm">
      {/* Skip to content link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-button focus:bg-ink focus:px-4 focus:py-2 focus:text-caption focus:text-white"
      >
        Skip to content
      </a>

      {/* Main Top Header Bar */}
      <div className="border-b border-divider/60 py-3.5">
        <Container width="shell" className="flex items-center justify-between gap-4 md:gap-8">
          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-3 group"
            aria-label="Digistore home"
          >
            <div className="grid size-11 place-items-center rounded-2xl bg-ink text-white shadow-sm transition-transform duration-200 group-hover:scale-105">
              <ShoppingBag className="size-6" strokeWidth={2} />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-extrabold tracking-tight text-ink uppercase font-sans">
                {/* Written in mixed case and uppercased by CSS, so a screen
                    reader says "Digistore" rather than spelling out D-I-G-I. */}
                Digistore
              </span>
              <span className="text-[11px] font-medium text-ink-muted -mt-1 tracking-tight">
                Live Better. Every Day.
              </span>
            </div>
          </Link>

          {/* Search Box */}
          <div className="hidden min-w-0 flex-1 max-w-2xl md:block">
            <Suspense fallback={<SearchBoxFallback />}>
              <SearchBox size="lg" />
            </Suspense>
          </div>

          {/* Header Action Items */}
          <div className="flex items-center gap-6 sm:gap-8">
            {/* Wishlist */}
            <Link
              href="/wishlist"
              className="flex flex-col items-center gap-1 text-ink transition-colors duration-150 hover:text-brand-600 group"
            >
              <div className="relative">
                <Heart className="size-5 text-ink transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
                {wishlistCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex size-4 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </div>
              <span className="text-[12px] font-medium leading-none text-ink">Wishlist</span>
            </Link>

            {/* Compare */}
            <Link
              href="/compare"
              className="flex flex-col items-center gap-1 text-ink transition-colors duration-150 hover:text-brand-600 group"
            >
              <RefreshCw className="size-5 text-ink transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
              <span className="text-[12px] font-medium leading-none text-ink">Compare</span>
            </Link>

            {/* Cart */}
            <Link
              href="/cart"
              className="flex flex-col items-center gap-1 text-ink transition-colors duration-150 hover:text-brand-600 group"
            >
              <div className="relative">
                <ShoppingCart className="size-5 text-ink transition-transform duration-150 group-hover:scale-110" strokeWidth={1.75} />
                <span className="absolute -right-2.5 -top-2 flex size-4.5 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white shadow-xs">
                  {cartCount}
                </span>
              </div>
              <span className="text-[12px] font-medium leading-none text-ink">Cart</span>
            </Link>
          </div>
        </Container>
      </div>

      {/* Sub Header Navigation Bar */}
      <div className="hidden border-b border-divider/40 py-2.5 md:block bg-surface">
        <Container width="shell" className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            {/* Navigation Links */}
            <nav className="flex items-center gap-7">
              <Link href="/" className="text-caption font-semibold text-ink hover:text-brand-600 transition-colors">
                Shop
              </Link>
              <Link href="/products?sort=price_asc" className="text-caption font-semibold text-ink hover:text-brand-600 transition-colors">
                Deals
              </Link>
              <Link href="/products" className="text-caption font-semibold text-ink hover:text-brand-600 transition-colors">
                New Arrivals
              </Link>
              <Link href="/brands" className="text-caption font-semibold text-ink hover:text-brand-600 transition-colors">
                Brands
              </Link>
              <Link href="/inspiration" className="text-caption font-semibold text-ink hover:text-brand-600 transition-colors">
                Inspiration
              </Link>
            </nav>
          </div>

          {/* Support Phone / Help */}
          <div className="flex items-center gap-2 text-caption text-ink font-medium">
            <Headphones className="size-4 text-ink" strokeWidth={1.75} />
            <span>Support: <strong className="font-semibold text-ink">(123) 456-7890</strong></span>
          </div>
        </Container>
      </div>

      {/* Mobile Search bar */}
      <Container width="shell" className="py-2.5 md:hidden">
        <Suspense fallback={<SearchBoxFallback />}>
          <SearchBox size="md" />
        </Suspense>
      </Container>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-auto border-t border-divider bg-surface">
      <Container width="shell" className="py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-5">
          {/* Brand Info */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-ink text-white">
                <ShoppingBag className="size-5" strokeWidth={2} />
              </div>
              <span className="text-lg font-bold text-ink tracking-tight uppercase">Digistore</span>
            </div>
            <p className="text-caption text-ink-muted max-w-sm">
              Live Better. Every Day. Your premier marketplace for curated lifestyle, high-tech electronics, fashion and modern living.
            </p>
            <p className="text-meta text-ink-subtle">
              © 2026 Digistore Inc. All rights reserved.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-3">
            <h4 className="text-caption font-semibold text-ink uppercase tracking-wider">Shop</h4>
            <Link href="/products" className="text-caption text-ink-muted hover:text-ink">All Products</Link>
            <Link href="/products?sort=price_asc" className="text-caption text-ink-muted hover:text-ink">Today's Deals</Link>
            <Link href="/products" className="text-caption text-ink-muted hover:text-ink">New Arrivals</Link>
            <Link href="/brands" className="text-caption text-ink-muted hover:text-ink">Featured Brands</Link>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-caption font-semibold text-ink uppercase tracking-wider">Categories</h4>
            <Link href="/products?category=phones-tablets" className="text-caption text-ink-muted hover:text-ink">Phones &amp; Tablets</Link>
            <Link href="/products?category=audio" className="text-caption text-ink-muted hover:text-ink">Audio</Link>
            <Link href="/products?category=computing" className="text-caption text-ink-muted hover:text-ink">Computing</Link>
            <Link href="/products?category=electronics" className="text-caption text-ink-muted hover:text-ink">Electronics</Link>
          </div>

          <div className="flex flex-col gap-3">
            <h4 className="text-caption font-semibold text-ink uppercase tracking-wider">Customer Support</h4>
            <Link href="/contact" className="text-caption text-ink-muted hover:text-ink">Contact Us</Link>
            <Link href="/faq" className="text-caption text-ink-muted hover:text-ink">FAQs</Link>
            <Link href="/shipping" className="text-caption text-ink-muted hover:text-ink">Shipping & Returns</Link>
            <Link href="/support" className="text-caption font-medium text-ink flex items-center gap-1.5">
              <Headphones className="size-4 text-brand-600" />
              (123) 456-7890
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
