"use client";

import { Truck, RotateCcw, Lock, Headphones } from "lucide-react";

const FEATURES = [
  {
    icon: Truck,
    title: "Free Shipping",
    subtitle: "On orders over $50",
  },
  {
    icon: RotateCcw,
    title: "Easy Returns",
    subtitle: "Within 30 days",
  },
  {
    icon: Lock,
    title: "Secure Payments",
    subtitle: "100% protected",
  },
  {
    icon: Headphones,
    title: "24/7 Support",
    subtitle: "We're here to help",
  },
];

export function TrustBar() {
  return (
    <section className="py-8 my-4">
      <div className="rounded-[22px] border border-divider bg-surface p-6 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-divider/60">
          {FEATURES.map((item, idx) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.title}
                className={`flex items-center gap-4 ${idx !== 0 ? "sm:pl-6 pt-4 sm:pt-0" : ""}`}
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-canvas text-ink border border-divider/60 shadow-2xs">
                  <IconComp className="size-6 text-ink" strokeWidth={1.5} />
                </div>
                <div className="flex flex-col">
                  <h4 className="text-body font-bold text-ink leading-tight">
                    {item.title}
                  </h4>
                  <span className="text-caption text-ink-muted mt-0.5">
                    {item.subtitle}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
