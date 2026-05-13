import type { Metadata } from "next";
import { Button } from "@components/ui/button";
import { MembershipsFaq } from "./faq";

export const metadata: Metadata = {
  title: "Memberships | Essentia Social Wellness Club",
  description:
    "Exclusive membership plans at Essentia giving you full access to our longevity center, wellness protocols, and community in Tenerife.",
};

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

// ─── MembershipsPage ──────────────────────────────────────────

export default function MembershipsPage() {
  return (
    <>
      {/* ── 1. Hero ─────────────────────────────────────────── */}
      <section className="bg-petroleum-700 flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <div className="mx-auto max-w-3xl">
          <span className="text-petroleum-400 mb-6 inline-block text-xs tracking-widest uppercase">
            Membership
          </span>
          <h1 className="font-display text-sand-50 text-4xl leading-tight tracking-tight text-balance md:text-6xl">
            Choose your
            <br />
            level of access.
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

        <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
          <div className="border-petroleum-500 flex h-9 w-5 items-start justify-center rounded-full border p-1.5">
            <div className="bg-petroleum-400 h-1.5 w-1 animate-bounce rounded-full" />
          </div>
        </div>
      </section>

      {/* ── 2. Tier Cards ───────────────────────────────────── */}
      <section id="tiers" className="bg-sand-50 px-5 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
              Three tiers, one ecosystem.
            </h2>
            <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
              Whether you are beginning your wellness journey or looking for a
              fully integrated longevity partnership, there is a tier built for
              you.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {tiers.map((tier) => (
              <TierCard key={tier.id} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. Comparison table ─────────────────────────────── */}
      <section className="bg-sand-100 px-5 py-24 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
              What&apos;s included.
            </h2>
            <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
              A clear look at what each tier gives you.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-petroleum-100">
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
      <MembershipsFaq />

      {/* ── 5. Final CTA ────────────────────────────────────── */}
      <section className="bg-petroleum-700 px-5 py-24 text-center md:py-32">
        <div className="mx-auto max-w-2xl">
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
