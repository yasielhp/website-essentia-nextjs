export type Role = "admin" | "staff" | "partner" | "calendar" | "member" | "contact" | null;

export type DetailsState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  notes?: string;
};

export type Step = { id: string; label: string };

export type Benefit = { title: string; description: string };

export type SessionDetail = {
  number: string;
  title: string;
  description: string;
};
