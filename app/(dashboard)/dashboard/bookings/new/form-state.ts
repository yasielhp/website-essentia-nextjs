import type { TierPickerOption } from "@/components/ui/tier-picker";
import type { DashboardLocation, LocationAddress } from "../_shared/location";
import { EMPTY_ADDRESS } from "../_shared/location";
import { GENDER_UNSPECIFIED, type GenderValue } from "@/constants/gender";

/**
 * A booking being written, and everything the screen is waiting on.
 *
 * Two reducers: one for what the person has filled in, one for what the server
 * has answered with. Apart from the page because they are the only part of it
 * anybody reads without the markup in the way.
 */
export type Service = {
  id: string;
  title: string;
  image?: string;
  description?: string;
  category?: string;
};

export type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
  price_suite_eur: number | null;
  image_url: string | null;
  color: string | null;
};

export function resolvePrice(
  tier: Tier,
  location: DashboardLocation | "",
): number | null {
  if (location === "habitacion") {
    return tier.price_suite_eur ?? tier.price_center_eur ?? tier.price_eur;
  }
  return tier.price_center_eur ?? tier.price_eur;
}

export function toTierOption(
  tier: Tier,
  location: DashboardLocation | "",
): TierPickerOption {
  return {
    id: tier.id,
    label: tier.label,
    durationMinutes: tier.duration_minutes,
    price: resolvePrice(tier, location),
    imageUrl: tier.image_url,
    color: tier.color,
  };
}

export type AsyncState = {
  submitting: boolean;
  error: string | null;
  services: Service[];
  servicesLoading: boolean;
  tiers: Tier[];
  tiersLoading: boolean;
};

export type AsyncAction =
  | { type: "SERVICES_LOADING" }
  | { type: "SERVICES_LOADED"; payload: Service[] }
  | { type: "TIERS_LOADING" }
  | { type: "TIERS_LOADED"; payload: Tier[] }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_END" }
  | { type: "SET_ERROR"; payload: string | null };

export const asyncInitial: AsyncState = {
  submitting: false,
  error: null,
  services: [],
  servicesLoading: true,
  tiers: [],
  tiersLoading: false,
};

export function asyncReducer(
  state: AsyncState,
  action: AsyncAction,
): AsyncState {
  switch (action.type) {
    case "SERVICES_LOADING":
      return { ...state, servicesLoading: true };
    case "SERVICES_LOADED":
      return { ...state, services: action.payload, servicesLoading: false };
    case "TIERS_LOADING":
      return { ...state, tiersLoading: true };
    case "TIERS_LOADED":
      return { ...state, tiers: action.payload, tiersLoading: false };
    case "SUBMIT_START":
      return { ...state, submitting: true };
    case "SUBMIT_END":
      return { ...state, submitting: false };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export type FormState = {
  serviceId: string;
  tierId: string;
  location: DashboardLocation | "";
  roomNumber: string;
  reservationNumber: string;
  notes: string;
  address: LocationAddress;
  selectedDate: Date | null;
  selectedTime: string;
  calendarView: "date" | "time";
  firstName: string;
  /** Stored on the contact, not the booking: it describes the person. */
  gender: GenderValue;
  /** Which language to write to this client in, theirs rather than ours. */
  language: string;
  lastName: string;
  email: string;
  phone: string;
  staffId: string;
};

export type FormAction =
  | { type: "SET_SERVICE"; id: string }
  | { type: "SET_TIER"; id: string }
  | { type: "SET_LOCATION"; value: DashboardLocation }
  | { type: "SET_ROOM_NUMBER"; value: string }
  | { type: "SET_RESERVATION_NUMBER"; value: string }
  | { type: "SET_NOTES"; value: string }
  | { type: "SET_ADDRESS"; value: LocationAddress }
  | { type: "SET_DATE"; value: Date }
  | { type: "SET_TIME"; value: string }
  | { type: "SET_CALENDAR_VIEW"; value: "date" | "time" }
  | {
      type: "SET_FIELD";
      field:
        "firstName" | "lastName" | "email" | "phone" | "gender" | "language";
      value: string;
    }
  | { type: "SET_STAFF"; value: string }
  | { type: "RESET_TIERS" };

export const formInitial: FormState = {
  serviceId: "",
  tierId: "",
  location: "",
  roomNumber: "",
  reservationNumber: "",
  notes: "",
  address: EMPTY_ADDRESS,
  selectedDate: null,
  selectedTime: "",
  calendarView: "date",
  firstName: "",
  gender: GENDER_UNSPECIFIED,
  language: "es",
  lastName: "",
  email: "",
  phone: "",
  staffId: "",
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_SERVICE":
      return {
        ...state,
        serviceId: action.id,
        tierId: "",
        staffId: "",
      };
    case "SET_TIER":
      // Assignments are per session type: whoever was picked may not perform
      // the new one.
      return { ...state, tierId: action.id, staffId: "" };
    case "SET_LOCATION":
      return {
        ...state,
        location: action.value,
        roomNumber: "",
        reservationNumber: "",
        address: EMPTY_ADDRESS,
      };
    case "SET_ROOM_NUMBER":
      return { ...state, roomNumber: action.value };
    case "SET_RESERVATION_NUMBER":
      return { ...state, reservationNumber: action.value };
    case "SET_NOTES":
      return { ...state, notes: action.value };
    case "SET_ADDRESS":
      return { ...state, address: action.value };
    case "SET_DATE":
      return {
        ...state,
        selectedDate: action.value,
        selectedTime: "",
        calendarView: "time",
      };
    case "SET_TIME":
      return { ...state, selectedTime: action.value };
    case "SET_CALENDAR_VIEW":
      return { ...state, calendarView: action.value };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET_TIERS":
      return { ...state, tierId: "" };
    case "SET_STAFF":
      return { ...state, staffId: action.value };
    default:
      return state;
  }
}
