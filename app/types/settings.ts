export type Tab = "services" | "plans" | "staff" | "appearance" | "payment";

export type TierRow = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  color: string | null;
  active: boolean;
  sort_order: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

export type PlanRow = {
  id: string;
  label: string;
  price_monthly: number | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
};

export type StaffRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export type ModalState = {
  serviceId: string;
  tier?: TierRow;
};
