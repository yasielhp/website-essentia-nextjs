"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { Button } from "@components/ui/button";
import { Accordion } from "@components/ui/accordion";

gsap.registerPlugin(ScrollTrigger);

// ─── Icons ────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={15}
      height={15}
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0"
    >
      <path
        d="M3 8l3.5 3.5 6.5-7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMinus() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={15}
      height={15}
      fill="none"
      aria-hidden="true"
      className="mt-0.5 shrink-0 opacity-25"
    >
      <path
        d="M4 8h8"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Tier data ────────────────────────────────────────────────

const tiers = [
  {
    id: "essential",
    badge: "Entry",
    name: "Essential",
    tagline: "Access to the full space",
    description:
      "Full access to all wellness facilities, group sessions, and community events. The complete Essentia experience.",
    features: [
      "All wellness facilities",
      "Contrast therapy zone",
      "Red light therapy",
      "Group breathwork sessions",
      "Community events",
      "Essentia app access",
    ],
    highlight: false,
    ctaLabel: "Request information",
  },
  {
    id: "premium",
    badge: "Most popular",
    name: "Premium",
    tagline: "Depth and priority",
    description:
      "Everything in Essential, plus priority booking, personalized wellness protocols, and monthly medical consultations.",
    features: [
      "Everything in Essential",
      "Priority booking",
      "Personalized wellness protocol",
      "Monthly medical consultation",
      "IV therapy discount (20%)",
      "Guest privileges (2 per month)",
      "Exclusive member workshops",
    ],
    highlight: true,
    ctaLabel: "Request information",
  },
  {
    id: "founder",
    badge: "Exclusive",
    name: "Founder",
    tagline: "The full ecosystem",
    description:
      "Full ecosystem access with a dedicated health advisor, unlimited guest privileges, and founding member status.",
    features: [
      "Everything in Premium",
      "Dedicated health advisor",
      "Unlimited guest privileges",
      "Quarterly longevity panel",
      "Priority treatment access",
      "Founding member events",
      "Private lounge access",
    ],
    highlight: false,
    ctaLabel: "Request information",
  },
] as const;

// ─── Comparison data ──────────────────────────────────────────

const comparisonRows: {
  label: string;
  essential: string | boolean;
  premium: string | boolean;
  founder: string | boolean;
}[] = [
  { label: "Wellness facilities", essential: true, premium: true, founder: true },
  { label: "Group sessions", essential: true, premium: true, founder: true },
  { label: "Community events", essential: true, premium: true, founder: true },
  { label: "Priority booking", essential: false, premium: true, founder: true },
  { label: "Personalized protocol", essential: false, premium: true, founder: true },
  { label: "Medical consultations", essential: false, premium: "Monthly", founder: "Quarterly panel" },
  { label: "Guest privileges", essential: false, premium: "2 / month", founder: "Unlimited" },
  { label: "Health advisor", essential: false, premium: false, founder: true },
  { label: "Founding member events", essential: false, premium: false, founder: true },
  { label: "Private lounge access", essential: false, premium: false, founder: true },
];

// ─── FAQ data ─────────────────────────────────────────────────

const faqs = [
  {
    q: "How do I become a member?",
    a: "Start by getting in touch through our contact page or booking form. Our team will walk you through the tiers, answer your questions, and arrange a tour of the space before you commit.",
  },
  {
    q: "Can I try Essentia before joining?",
    a: "Yes. We offer introductory visits for prospective members. Contact us to schedule a guided tour and a complimentary session so you can experience the space first-hand.",
  },
  {
    q: "How does billing work?",
    a: "Memberships are billed monthly or annually. Annual members receive a preferred rate. You will choose your billing preference at sign-up.",
  },
  {
    q: "Can I cancel or pause my membership?",
    a: "Monthly memberships may be cancelled with 30 days written notice. Annual memberships run for the full term; exceptions may be considered in extraordinary circumstances. Pauses may be available — speak to our team.",
  },
  {
    q: "What is the difference between Essential and Premium in practice?",
    a: "Essential gives you full access to all shared facilities and group sessions. Premium adds the ability to book specific equipment slots ahead of time, a personalised wellness protocol reviewed monthly, and access to medical consultations with our clinical team.",
  },
  {
    q: "Who is the Founder membership for?",
    a: "Founder is designed for those who want a truly bespoke longevity experience. You get a dedicated health advisor who coordinates all your protocols, unlimited guest access, and seats at invitation-only events. It is limited to a small number of members.",
  },
];

// ─── TierCard ─────────────────────────────────────────────────

function TierCard({ tier }: { tier: (typeof tiers)[number] }) {
  return (
    <article
      className={[
        "relative flex flex-col gap-5 rounded-2xl p-7",
        tier.highlight
          ? "bg-sand-50 border-petroleum-700 border-2 shadow-lg"
          : "bg-petroleum-800 border-petroleum-500/40 border",
      ].join(" ")}
    >
      <span
        className={[
          "self-start rounded-full px-3 py-1 text-xs tracking-wider uppercase",
          tier.highlight
            ? "bg-petroleum-700 text-sand-50"
            : "bg-petroleum-500/20 text-sand-500",
        ].join(" ")}
      >
        {tier.badge}
      </span>

      <div className="mt-1">
        <h3
          className={[
            "font-display text-3xl",
            tier.highlight ? "text-petroleum-700" : "text-sand-50",
          ].join(" ")}
        >
          {tier.name}
        </h3>
        <p className="mt-1 text-xs tracking-widest uppercase text-petroleum-400">
          {tier.tagline}
        </p>
      </div>

      <p
        className={[
          "text-sm leading-relaxed",
          tier.highlight ? "text-petroleum-500" : "text-sand-500",
        ].join(" ")}
      >
        {tier.description}
      </p>

      <ul
        className="flex flex-col gap-2.5 border-t pt-5 mt-auto"
        style={{
          borderColor: tier.highlight
            ? "var(--color-petroleum-100)"
            : "var(--color-petroleum-600)",
        }}
      >
        {tier.features.map((feature) => (
          <li
            key={feature}
            className={[
              "flex items-start gap-2.5 text-sm",
              tier.highlight ? "text-petroleum-600" : "text-sand-500",
            ].join(" ")}
          >
            <IconCheck />
            {feature}
          </li>
        ))}
      </ul>

      <div className="pt-2">
        <Button
          variant={tier.highlight ? "solid" : "outline-white"}
          size="md"
          href="/contact"
          className="w-full"
        >
          {tier.ctaLabel}
        </Button>
      </div>
    </article>
  );
}

// ─── ComparisonCell ───────────────────────────────────────────

function ComparisonCell({ value }: { value: string | boolean }) {
  if (value === true)
    return (
      <td className="px-4 py-3 text-center">
        <span className="text-petroleum-700 inline-flex justify-center">
          <IconCheck />
        </span>
      </td>
    );
  if (value === false)
    return (
      <td className="px-4 py-3 text-center">
        <span className="text-petroleum-300 inline-flex justify-center">
          <IconMinus />
        </span>
      </td>
    );
  return (
    <td className="text-petroleum-500 px-4 py-3 text-center text-xs">
      {value}
    </td>
  );
}

// ─── MembershipsContent ───────────────────────────────────────

export function MembershipsContent() {
  // Hero
  const heroContentRef = useRef<HTMLDivElement>(null);
  // Tiers
  const tiersSectionRef = useRef<HTMLElement>(null);
  const tiersHeaderRef = useRef<HTMLDivElement>(null);
  const tiersGridRef = useRef<HTMLDivElement>(null);
  // Table
  const tableSectionRef = useRef<HTMLElement>(null);
  const tableHeaderRef = useRef<HTMLDivElement>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  // FAQ
  const faqSectionRef = useRef<HTMLElement>(null);
  const faqHeaderRef = useRef<HTMLDivElement>(null);
  const faqBodyRef = useRef<HTMLDivElement>(null);
  // CTA
  const ctaSectionRef = useRef<HTMLElement>(null);
  const ctaContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // ── Hero: animate on mount ──────────────────────────────
      if (heroContentRef.current) {
        gsap.from(Array.from(heroContentRef.current.children), {
          opacity: 0,
          y: 25,
          stagger: 0.12,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.1,
        });
      }

      // ── Helper: scroll-triggered section animation ──────────
      const animSection = (
        headerEl: HTMLElement | null,
        itemsEl: HTMLElement | null,
        trigger: HTMLElement | null,
      ) => {
        if (!trigger) return;
        const tl = gsap.timeline({
          scrollTrigger: { trigger, start: "top 78%", once: true },
        });
        if (headerEl) {
          tl.from(Array.from(headerEl.children), {
            opacity: 0,
            y: 30,
            stagger: 0.08,
            duration: 0.65,
            ease: "power3.out",
          });
        }
        if (itemsEl) {
          tl.from(Array.from(itemsEl.children), {
            opacity: 0,
            y: 28,
            stagger: 0.1,
            duration: 0.55,
            ease: "power2.out",
          }, "-=0.3");
        }
      };

      animSection(tiersHeaderRef.current, tiersGridRef.current, tiersSectionRef.current);
      animSection(tableHeaderRef.current, tableWrapperRef.current, tableSectionRef.current);
      animSection(faqHeaderRef.current, faqBodyRef.current, faqSectionRef.current);

      // CTA: animate inner children as a group
      if (ctaSectionRef.current && ctaContentRef.current) {
        gsap.from(Array.from(ctaContentRef.current.children), {
          opacity: 0,
          y: 25,
          stagger: 0.1,
          duration: 0.65,
          ease: "power3.out",
          scrollTrigger: { trigger: ctaSectionRef.current, start: "top 78%", once: true },
        });
      }
    });

    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* ── 1. Hero ─────────────────────────────────────────── */}
      <section className="bg-petroleum-700 flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <div ref={heroContentRef} className="mx-auto max-w-3xl">
          <h1 className="font-display text-sand-50 text-4xl leading-tight tracking-tight text-balance md:text-6xl">
            Membership
          </h1>
          <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
            Every membership includes full access to the Essentia space. What
            changes is the depth of your protocols, the priority of your
            booking, and the closeness of your care.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="white" size="md" href="#tiers">
              See memberships
            </Button>
            <Button variant="outline-white" size="md" href="/contact">
              Talk to us first
            </Button>
          </div>
        </div>
      </section>

      {/* ── 2. Tier Cards ───────────────────────────────────── */}
      <section ref={tiersSectionRef} id="tiers" className="bg-sand-50 px-5 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div ref={tiersHeaderRef} className="mb-14 text-center">
            <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
              Three tiers, one ecosystem.
            </h2>
            <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
              Whether you are beginning your wellness journey or looking for a
              fully integrated longevity partnership, there is a tier built for
              you.
            </p>
          </div>

          <div ref={tiersGridRef} className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {tiers.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Comparison table ─────────────────────────────── */}
      <section ref={tableSectionRef} className="bg-sand-100 px-5 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div ref={tableHeaderRef} className="mb-12 text-center">
            <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
              What&apos;s included.
            </h2>
            <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
              A clear look at what each tier gives you.
            </p>
          </div>

          <div ref={tableWrapperRef} className="overflow-x-auto rounded-2xl border border-petroleum-100">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="bg-sand-50 border-b border-petroleum-100">
                  <th className="text-petroleum-400 w-1/2 px-4 py-4 text-left font-medium text-xs tracking-wider uppercase">
                    Feature
                  </th>
                  {(["Essential", "Premium", "Founder"] as const).map((name) => (
                    <th
                      key={name}
                      className="text-petroleum-700 px-4 py-4 text-center font-display font-normal text-base"
                    >
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row, i) => (
                  <tr
                    key={row.label}
                    className={[
                      "border-b border-petroleum-100 last:border-0",
                      i % 2 === 0 ? "bg-white" : "bg-sand-50/50",
                    ].join(" ")}
                  >
                    <td className="text-petroleum-600 px-4 py-3 font-medium">
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
        </div>
      </section>

      {/* ── 4. FAQ ──────────────────────────────────────────── */}
      <section ref={faqSectionRef} className="bg-sand-50 px-5 py-24 md:py-32">
        <div className="mx-auto max-w-2xl">
          <div ref={faqHeaderRef} className="mb-12 text-center">
            <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
              Common questions.
            </h2>
          </div>

          <div ref={faqBodyRef}>
            <Accordion.Group className="divide-y divide-petroleum-100">
              {faqs.map((faq) => (
                <Accordion key={faq.q} className="py-1">
                  <Accordion.Header>
                    <span className="text-petroleum-700 text-left text-base font-medium">
                      {faq.q}
                    </span>
                  </Accordion.Header>
                  <Accordion.Content>
                    <p className="text-petroleum-500 pb-5 text-sm leading-7">
                      {faq.a}
                    </p>
                  </Accordion.Content>
                </Accordion>
              ))}
            </Accordion.Group>

            <p className="text-petroleum-400 mt-10 text-center text-sm">
              Still have questions?{" "}
              <Link
                href="/contact"
                className="text-petroleum-700 underline underline-offset-2 transition-opacity hover:opacity-70"
              >
                Get in touch
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── 5. Final CTA ────────────────────────────────────── */}
      <section ref={ctaSectionRef} className="bg-petroleum-700 px-5 py-24 text-center md:py-32">
        <div ref={ctaContentRef} className="mx-auto max-w-2xl">
          <h2 className="font-display text-sand-50 text-3xl text-balance md:text-4xl">
            Ready to begin?
          </h2>
          <p className="text-sand-500 mx-auto mt-5 max-w-md leading-relaxed">
            Our team will help you choose the right tier and answer any questions
            before you commit to anything.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="white" size="md" href="/contact">
              Get in touch
            </Button>
            <Button variant="outline-white" size="md" href="/booking">
              Book a visit
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
