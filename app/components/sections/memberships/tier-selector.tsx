"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import { insforge } from "@/lib/insforge";
import {
  PaymentOverlay,
  type RedsysFormData,
} from "@/components/sections/booking/steps/payment-overlay";
import { TierId, VALID_TIERS, tierIds, pricing } from "./data";
import { IconCheck } from "@/components/ui/icons";

gsap.registerPlugin(ScrollTrigger);

// ─── TierTabs ────────────────────────────────────────────────

function TierTabs({
  selected,
  onChange,
}: {
  selected: TierId;
  onChange: (id: TierId) => void;
}) {
  const t = useTranslations("memberships.tiers");
  return (
    <div className="bg-petroleum-100 inline-flex rounded-full p-1">
      {tierIds.map((id) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
            selected === id
              ? "bg-petroleum-700 text-sand-50 shadow-sm"
              : "text-petroleum-500 hover:text-petroleum-700",
          ].join(" ")}
        >
          {t(`${id}.name`)}
        </button>
      ))}
    </div>
  );
}

// ─── TierDisplay ─────────────────────────────────────────────

function TierDisplay({
  tierId,
  price,
  features,
  displayRef,
  onBecomeMember,
  loading,
}: {
  tierId: TierId;
  price: number;
  features: readonly string[];
  displayRef: React.RefObject<HTMLDivElement | null>;
  onBecomeMember: () => void;
  loading: boolean;
}) {
  const t = useTranslations("memberships.tiers");
  const ts = useTranslations("memberships.selector");
  return (
    <div
      ref={displayRef}
      className="bg-sand-100 mx-auto rounded-3xl p-8 md:max-w-2xl md:p-12"
    >
      {/* ── Top row ── */}
      <div className="flex flex-col gap-10 md:flex-row md:items-stretch md:gap-0">
        {/* Left: name + price (+ description + button on mobile only) */}
        <div className="flex flex-col md:w-1/2 md:pr-12">
          <span className="bg-petroleum-100 text-petroleum-500 self-start rounded-full px-3 py-1 text-xs tracking-wider uppercase">
            {t(`${tierId}.badge`)}
          </span>

          <h3 className="font-display text-petroleum-700 mt-4 text-5xl md:text-6xl">
            {t(`${tierId}.name`)}
          </h3>
          <p className="text-petroleum-400 mt-1 text-xs tracking-widest uppercase">
            {t(`${tierId}.tagline`)}
          </p>

          <div className="mt-7 flex items-end gap-1.5">
            <span className="font-display text-petroleum-700 text-5xl leading-none">
              €{price}
            </span>
            <span className="text-petroleum-400 mb-1 text-sm">
              {ts("perMonth")}
            </span>
          </div>

          {/* Mobile-only: description + button */}
          <p className="text-petroleum-500 mt-5 text-sm leading-relaxed md:hidden">
            {t(`${tierId}.description`)}
          </p>
          <div className="mt-auto pt-7 md:hidden">
            <Button
              variant="solid"
              size="md"
              onClick={onBecomeMember}
              disabled={loading}
              className="w-full"
            >
              {loading ? ts("loading") : ts("becomeMember")}
            </Button>
          </div>
        </div>

        {/* Right: features */}
        <div className="border-sand-500 flex flex-col border-t pt-8 md:w-1/2 md:border-t-0 md:border-l md:pt-0 md:pl-12">
          <ul className="flex flex-col gap-3.5 md:min-h-[224px]">
            {features.map((feature) => (
              <li
                key={feature}
                className="text-petroleum-500 flex items-start gap-3 text-sm"
              >
                <IconCheck className="mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Desktop-only bottom: description + button full width ── */}
      <div className="hidden pt-8 md:block">
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {t(`${tierId}.description`)}
        </p>
        <div className="mt-6">
          <Button
            variant="solid"
            size="md"
            onClick={onBecomeMember}
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading ? ts("loading") : ts("becomeMember")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Success Banner ───────────────────────────────────────────

function SuccessBanner() {
  const t = useTranslations("memberships.selector");
  return (
    <div className="mx-auto max-w-2xl rounded-2xl bg-green-50 px-8 py-10 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-green-100">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M5 13l4 4L19 7"
            stroke="#16a34a"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="text-petroleum-700 font-display text-2xl">
        {t("successHeading")}
      </h3>
      <p className="text-petroleum-500 mt-2 text-sm leading-relaxed">
        {t("successBody")}
      </p>
    </div>
  );
}

// ─── TierSelector ─────────────────────────────────────────────

function TierSelectorInner() {
  const t = useTranslations("memberships.selector");
  const tt = useTranslations("memberships.tiers");
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const paramValue = get("tier") as TierId | null;
  const paymentSuccess = get("payment") === "success";
  const initialTier: TierId =
    paramValue && VALID_TIERS.includes(paramValue) ? paramValue : "essential";
  const hasTierParam = useRef(false);

  const [tierState, setTierState] = useState<{
    selectedTier: TierId;
    dbPrices: Record<string, number>;
    dbFeaturesList: Record<string, string[]>;
    redsysForm: RedsysFormData | null;
    checkoutLoading: boolean;
  }>({
    selectedTier: initialTier,
    dbPrices: {},
    dbFeaturesList: {},
    redsysForm: null,
    checkoutLoading: false,
  });
  const {
    selectedTier,
    dbPrices,
    dbFeaturesList,
    redsysForm,
    checkoutLoading,
  } = tierState;
  const selectedTierRef = useRef<TierId>(initialTier);

  function setSelectedTier(v: TierId) {
    setTierState((s) => ({ ...s, selectedTier: v }));
  }
  function setDbPrices(v: Record<string, number>) {
    setTierState((s) => ({ ...s, dbPrices: v }));
  }
  function setDbFeaturesList(v: Record<string, string[]>) {
    setTierState((s) => ({ ...s, dbFeaturesList: v }));
  }
  function setRedsysForm(v: RedsysFormData | null) {
    setTierState((s) => ({ ...s, redsysForm: v }));
  }
  function setCheckoutLoading(v: boolean) {
    setTierState((s) => ({ ...s, checkoutLoading: v }));
  }

  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadPlans() {
      const { data } = await insforge.database
        .from("membership_plans")
        .select("id, price_monthly, features")
        .eq("active", true);
      if (!data) return;
      const prices: Record<string, number> = {};
      const features: Record<string, string[]> = {};
      for (const p of data as {
        id: string;
        price_monthly: number;
        features: string | string[] | null;
      }[]) {
        prices[p.id] = p.price_monthly;
        if (p.features) {
          features[p.id] = Array.isArray(p.features)
            ? p.features
            : p.features.split(",").map((f) => f.trim());
        }
      }
      setDbPrices(prices);
      setDbFeaturesList(features);
    }
    void loadPlans();
  }, []);

  useEffect(() => {
    const urlParam = new URLSearchParams(window.location.search).get("tier");
    hasTierParam.current =
      !!urlParam && VALID_TIERS.includes(urlParam as TierId);

    const skipEntrance =
      hasTierParam.current || window.location.hash === "#tiers";

    if (hasTierParam.current) {
      const el = document.getElementById("tiers");
      if (el) {
        setTimeout(() => {
          const top = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top, behavior: "smooth" });
        }, 80);
      }
    }

    const revealAll = () => {
      if (!bodyRef.current) return;
      gsap.to(Array.from(bodyRef.current.children), {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        overwrite: true,
      });
    };
    window.addEventListener("reveal-tiers", revealAll);

    const ctx = gsap.context(() => {
      if (!sectionRef.current || !innerRef.current || !bodyRef.current) return;

      const section = sectionRef.current;
      const inner = innerRef.current;
      const children = Array.from(bodyRef.current.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        if (!skipEntrance) gsap.set(children, { opacity: 0, y: 40 });
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
          { opacity: 1, y: 0, duration: 0.2, ease: "power3.out" },
          "-=0.05",
        );
        tl.to(
          children[2],
          { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        if (skipEntrance) return;
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
    });

    return () => {
      ctx.revert();
      window.removeEventListener("reveal-tiers", revealAll);
    };
  }, []);

  // Animate card on tier change
  useEffect(() => {
    const prev = selectedTierRef.current;
    selectedTierRef.current = selectedTier;
    if (prev === selectedTier) return;
    if (displayRef.current) {
      gsap.fromTo(
        displayRef.current,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
          overwrite: true,
        },
      );
    }
  }, [selectedTier]);

  async function handleBecomeMember() {
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/checkout/membership-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedTier }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      const form = (await res.json()) as RedsysFormData;
      setRedsysForm(form);
    } catch {
      // silently fail — user can retry
    } finally {
      setCheckoutLoading(false);
    }
  }

  const activePrice = dbPrices[selectedTier] ?? pricing[selectedTier];
  const translatedFeatures = tt.raw(`${selectedTier}.features`) as string[];
  const activeFeatures = dbFeaturesList[selectedTier] ?? translatedFeatures;

  return (
    <>
      <section ref={sectionRef} id="tiers" className="bg-sand-50 md:h-[280vh]">
        <div ref={innerRef} className="overflow-hidden md:h-screen">
          <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
            <div ref={bodyRef} className="flex flex-col gap-8">
              <div className="text-center">
                <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                  {t("heading")}
                </h2>
                <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
                  {t("subheading")}
                </p>
              </div>

              <div className="flex justify-center">
                <TierTabs selected={selectedTier} onChange={setSelectedTier} />
              </div>

              {paymentSuccess ? (
                <SuccessBanner />
              ) : (
                <TierDisplay
                  tierId={selectedTier}
                  price={activePrice}
                  features={activeFeatures}
                  displayRef={displayRef}
                  onBecomeMember={() => void handleBecomeMember()}
                  loading={checkoutLoading}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {redsysForm && (
        <PaymentOverlay
          formData={redsysForm}
          onClose={() => setRedsysForm(null)}
        />
      )}
    </>
  );
}

export default function TierSelector() {
  return (
    <Suspense fallback={null}>
      <TierSelectorInner />
    </Suspense>
  );
}
