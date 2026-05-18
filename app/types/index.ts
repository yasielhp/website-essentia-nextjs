export type Role = "admin" | "staff" | "partner" | "member" | "contact" | null;

export type DetailsState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
};

export type Step = { id: string; label: string };

export type Benefit = { title: string; description: string };

export type SessionDetail = {
  number: string;
  title: string;
  description: string;
};
