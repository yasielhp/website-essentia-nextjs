import type { Gender } from "@/types/person";

/** A resolved role. Use this wherever the absence of a role is not meaningful. */
export type UserRole = "admin" | "staff" | "partner" | "member" | "contact";

/** A role that may still be loading or absent. */
export type Role = UserRole | null;

export type DetailsState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  /** Empty string means the visitor left it unanswered. */
  gender?: Gender | "";
  consent: boolean;
  /** Opt-in to news and offers. Unticked means "do not touch", never "no". */
  newsletter?: boolean;
  notes?: string;
};

export type Step = { id: string; label: string };

export type Benefit = { title: string; description: string };

export type SessionDetail = {
  number: string;
  title: string;
  description: string;
};
