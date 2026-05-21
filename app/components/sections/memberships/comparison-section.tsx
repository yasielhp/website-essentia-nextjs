"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { insforge } from "@/lib/insforge";
import { TierId, tiers, pricing, featureRows } from "./data";
import { IconCheck, IconMinus } from "@/components/ui/icons";

gsap.registerPlugin(ScrollTrigger);

// ─── ComparisonCell ──────────────────────────────────────────

function ComparisonCell({ value }: { value: string | boolean }) {
  if (value === true)
    return (
      <td className="px-4 py-3 text-center">
        <span className="text-petroleum-700 inline-flex justify-center">
          <IconCheck className="mt-0.5 shrink-0" />
        </span>
      </td>
    );
  if (value === false)
    return (
      <td className="px-4 py-3 text-center">
        <span className="text-petroleum-300 inline-flex justify-center">
          <IconMinus className="mt-0.5 shrink-0 opacity-25" />
        </span>
      </td>
    );
  return (
    <td className="text-petroleum-500 px-4 py-3 text-center text-xs">
      {value}
    </td>
  );
}

// ─── ComparisonSection ───────────────────────────────────────

export default function ComparisonSection() {
  const [comparisonTier, setComparisonTier] = useState<TierId>("essential");
  const [dbPrices, setDbPrices] = useState<Record<string, number>>({});

  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadPrices() {
      const { data } = await insforge.database
        .from("membership_plans")
        .select("id, price_monthly")
        .eq("active", true);
      if (!data) return;
      const prices: Record<string, number> = {};
      for (const p of data as { id: string; price_monthly: number }[]) {
        prices[p.id] = p.price_monthly;
      }
      setDbPrices(prices);
    }
    void loadPrices();
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const body = bodyRef.current;
    if (!section || !inner || !body) return;

    const ctx = gsap.context(() => {
      const children = Array.from(body.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        gsap.set(children, { opacity: 0, y: 40 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(children[0], {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power3.out",
        });
        tl.to(
          children[1],
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: child,
                start: "top 88%",
                end: "top 35%",
                scrub: 0.7,
              },
            },
          );
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  const activeTier = tiers.find((t) => t.id === comparisonTier)!;

  return (
    <section ref={sectionRef} className="bg-sand-100 md:h-[320vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-10">
            {/* ── Header ── */}
            <div className="text-center">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                What&apos;s included.
              </h2>
              <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
                A clear look at what each tier gives you.
              </p>
            </div>

            {/* ── Content ── */}
            <div>
              {/* Desktop table */}
              <div className="border-petroleum-100 hidden overflow-x-auto rounded-2xl border md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-sand-50 border-petroleum-100 border-b">
                      <th className="text-petroleum-400 w-1/2 p-4 text-left text-xs font-medium tracking-wider uppercase">
                        Feature
                      </th>
                      {(["Essential", "Premium", "Founder"] as const).map(
                        (name) => (
                          <th
                            key={name}
                            className="text-petroleum-700 font-display p-4 text-center text-base font-normal"
                          >
                            {name}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-sand-50/80 border-petroleum-100 border-b">
                      <td className="text-petroleum-400 px-4 py-3 text-xs font-medium tracking-wider uppercase">
                        Monthly price
                      </td>
                      {(["essential", "premium", "founder"] as TierId[]).map(
                        (id) => (
                          <td
                            key={id}
                            className="text-petroleum-700 font-display px-4 py-3 text-center text-base font-normal"
                          >
                            €{dbPrices[id] ?? pricing[id]}/mo
                          </td>
                        ),
                      )}
                    </tr>
                    {featureRows.map((row, i) => (
                      <tr
                        key={row.label}
                        className={[
                          "border-petroleum-100 border-b last:border-0",
                          i % 2 === 0 ? "bg-white" : "bg-sand-50/50",
                        ].join(" ")}
                      >
                        <td className="text-petroleum-500 px-4 py-3 font-medium">
                          {row.label}
                        </td>
                        <ComparisonCell value={row.essential} />
                        <ComparisonCell value={row.premium} />
                        <ComparisonCell value={row.founder} />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile: switcher + single card */}
              <div className="md:hidden">
                <div className="bg-petroleum-100 mb-5 flex rounded-full p-1">
                  {tiers.map((tier) => (
                    <button
                      key={tier.id}
                      onClick={() => setComparisonTier(tier.id)}
                      className={[
                        "flex-1 rounded-full py-2 text-sm font-medium transition-all duration-200",
                        comparisonTier === tier.id
                          ? "bg-petroleum-700 text-sand-50 shadow-sm"
                          : "text-petroleum-500",
                      ].join(" ")}
                    >
                      {tier.name}
                    </button>
                  ))}
                </div>

                <div className="border-petroleum-100 overflow-hidden rounded-2xl border">
                  <div className="bg-sand-50 border-petroleum-100 flex items-center justify-between border-b px-5 py-4">
                    <div>
                      <span className="text-petroleum-400 text-xs font-medium tracking-wider uppercase">
                        {activeTier.badge}
                      </span>
                      <h3 className="font-display text-petroleum-700 mt-0.5 text-xl">
                        {activeTier.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="font-display text-petroleum-700 text-2xl">
                        €{dbPrices[activeTier.id] ?? pricing[activeTier.id]}
                      </span>
                      <span className="text-petroleum-400 block text-xs">
                        /month
                      </span>
                    </div>
                  </div>

                  <ul className="divide-petroleum-100 divide-y bg-white">
                    {featureRows.map((row) => {
                      const value = row[activeTier.id];
                      return (
                        <li
                          key={row.label}
                          className="flex items-center justify-between px-5 py-3"
                        >
                          <span className="text-petroleum-500 text-sm">
                            {row.label}
                          </span>
                          <span className="ml-3 shrink-0">
                            {value === true && (
                              <IconCheck className="text-petroleum-700 mt-0.5 shrink-0" />
                            )}
                            {value === false && (
                              <IconMinus className="mt-0.5 shrink-0 opacity-25" />
                            )}
                            {typeof value === "string" && (
                              <span className="text-petroleum-500 text-xs">
                                {value}
                              </span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
