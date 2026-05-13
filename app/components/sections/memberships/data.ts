// ─── Types ────────────────────────────────────────────────────

export type TierId = "essential" | "premium" | "founder";

// ─── Constants ───────────────────────────────────────────────

export const VALID_TIERS: TierId[] = ["essential", "premium", "founder"];

// ─── Pricing ─────────────────────────────────────────────────

export const pricing: Record<TierId, number> = {
  essential: 199,
  premium: 349,
  founder: 699,
};

// ─── Tier data ───────────────────────────────────────────────

export const tiers = [
  {
    id: "essential" as TierId,
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
  },
  {
    id: "premium" as TierId,
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
  },
  {
    id: "founder" as TierId,
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
  },
] as const;

// ─── Comparison rows ─────────────────────────────────────────

export const featureRows: {
  label: string;
  essential: string | boolean;
  premium: string | boolean;
  founder: string | boolean;
}[] = [
  {
    label: "Wellness facilities",
    essential: true,
    premium: true,
    founder: true,
  },
  { label: "Group sessions", essential: true, premium: true, founder: true },
  { label: "Community events", essential: true, premium: true, founder: true },
  { label: "Priority booking", essential: false, premium: true, founder: true },
  {
    label: "Personalized protocol",
    essential: false,
    premium: true,
    founder: true,
  },
  {
    label: "Medical consultations",
    essential: false,
    premium: "Monthly",
    founder: "Quarterly panel",
  },
  {
    label: "Guest privileges",
    essential: false,
    premium: "2 / month",
    founder: "Unlimited",
  },
  { label: "Health advisor", essential: false, premium: false, founder: true },
  {
    label: "Founding member events",
    essential: false,
    premium: false,
    founder: true,
  },
  {
    label: "Private lounge access",
    essential: false,
    premium: false,
    founder: true,
  },
];

// ─── FAQ data ────────────────────────────────────────────────

export const faqs = [
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
