export type Tab = "services";

export type TierRow = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
  price_suite_eur: number | null;
  color: string | null;
  image_url: string | null;
  active: boolean;
  sort_order: number;
};

export type PlanRow = {
  id: string;
  label: string;
  price_monthly: number | null;
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

/**
 * What the session-type form sends to be saved: the fields of its modal and
 * nothing else. The server refuses any other key (`saveSessionType`).
 */
export type SessionTypeInput = {
  duration_minutes: number | null;
  /** What the public booking flow charges. */
  price_eur: number | null;
  price_center_eur: number | null;
  price_suite_eur: number | null;
  color: string | null;
  active: boolean;
  /**
   * Who performs it, in the order the booking form lists them. `null` means
   * "leave the assignments as they are": the modal sends it when it never got
   * to read them, because an empty list would unassign everybody.
   */
  staffIds: string[] | null;
};

/** Why a session type was not saved. Keys of `dashboard.settings.tiers.errors`. */
export type SessionTypeSaveError =
  | "unauthenticated"
  | "forbidden"
  | "invalid"
  | "notFound"
  | "colorTaken"
  | "failed"
  /** The session type itself was saved; its staff assignments were not. */
  | "staff"
  /** No answer in time: it may or may not have been saved. */
  | "timeout";

export type SessionTypeSaveResult =
  { ok: true } | { ok: false; error: SessionTypeSaveError };
