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

// ─── Tier IDs (display content lives in messages/{locale}/memberships.json) ──

export const tierIds: TierId[] = ["essential", "premium", "founder"];

// ─── Comparison rows ─────────────────────────────────────────
// Each row references a label key in messages/{locale}/memberships.json
// (comparison.rows). Boolean/string values can also be label keys for
// translation; primitive booleans are rendered as check/minus icons.

export type FeatureRow = {
  labelKey: string;
  essential: boolean | string;
  premium: boolean | string;
  founder: boolean | string;
};

export const featureRows: FeatureRow[] = [
  {
    labelKey: "wellnessFacilities",
    essential: true,
    premium: true,
    founder: true,
  },
  { labelKey: "groupSessions", essential: true, premium: true, founder: true },
  {
    labelKey: "communityEvents",
    essential: true,
    premium: true,
    founder: true,
  },
  {
    labelKey: "priorityBooking",
    essential: false,
    premium: true,
    founder: true,
  },
  {
    labelKey: "personalizedProtocol",
    essential: false,
    premium: true,
    founder: true,
  },
  {
    labelKey: "medicalConsultations",
    essential: false,
    premium: "monthly",
    founder: "quarterlyPanel",
  },
  {
    labelKey: "guestPrivileges",
    essential: false,
    premium: "guestPerMonth",
    founder: "unlimited",
  },
  {
    labelKey: "healthAdvisor",
    essential: false,
    premium: false,
    founder: true,
  },
  {
    labelKey: "founderEvents",
    essential: false,
    premium: false,
    founder: true,
  },
  {
    labelKey: "privateLounge",
    essential: false,
    premium: false,
    founder: true,
  },
];
