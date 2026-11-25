import type { TierPickerOption } from "@/components/ui/tier-picker";
import type {
  DashboardLocation,
  LocationAddress,
} from "../_shared/location-options";
import { EMPTY_ADDRESS } from "../_shared/location-options";
import { EMPTY_PAYMENT, type PaymentValue } from "../_shared/payment-fields";
import {
  GENDER_UNSPECIFIED,
  GENDER_VALUES,
  type GenderValue,
} from "@/constants/gender";
import type { DeskContactOption } from "@/lib/bookings/desk-consents";

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
  /**
   * The client already on file the booking is for, picked in the client step;
   * null for a new client. Its address is then fixed (the booking is linked to
   * the contact by it).
   */
  contact: DeskContactOption | null;
  /**
   * "New client" was chosen in the client step: her fields are shown to be
   * typed. With neither this nor `contact`, the step shows only the search.
   */
  newClient: boolean;
  /** "News and offers" (email and WhatsApp). Off means "not asked", not "no". */
  marketing: boolean;
  /** "Appointment notices" on WhatsApp: on unless the desk turns it off. */
  appointmentNotices: boolean;
  /** Money already taken, for a booking made by phone or at the desk. */
  payment: PaymentValue;
  /** The desk turned off the bonus session offered for this booking. */
  bonusOptOut: boolean;
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
  | { type: "TOGGLE_MARKETING" }
  | { type: "TOGGLE_APPOINTMENT_NOTICES" }
  | { type: "SELECT_CONTACT"; value: DeskContactOption }
  | { type: "NEW_CLIENT" }
  | { type: "CLEAR_CONTACT" }
  | { type: "SET_PAYMENT"; value: PaymentValue }
  | { type: "TOGGLE_BONUS" }
  | {
      type: "PREFILL_CLIENT";
      value: {
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        gender: GenderValue;
        language: "en" | "es";
      };
    }
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
  contact: null,
  newClient: false,
  marketing: false,
  appointmentNotices: true,
  payment: EMPTY_PAYMENT,
  bonusOptOut: false,
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
    case "TOGGLE_MARKETING":
      return { ...state, marketing: !state.marketing };
    case "TOGGLE_APPOINTMENT_NOTICES":
      return { ...state, appointmentNotices: !state.appointmentNotices };
    case "SELECT_CONTACT":
      return { ...state, ...clientFromContact(action.value) };
    case "NEW_CLIENT":
      return { ...state, contact: null, newClient: true };
    case "CLEAR_CONTACT":
      return {
        ...state,
        contact: null,
        newClient: false,
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        gender: GENDER_UNSPECIFIED,
        language: "es",
        marketing: false,
        appointmentNotices: true,
      };
    case "SET_STAFF":
      return { ...state, staffId: action.value };
    case "TOGGLE_BONUS":
      return { ...state, bonusOptOut: !state.bonusOptOut };
    case "SET_PAYMENT":
      return { ...state, payment: action.value };
    case "PREFILL_CLIENT":
      // A contact the search could not offer (no address): her details are
      // shown to be completed, as a new client's.
      return { ...state, ...action.value, contact: null, newClient: true };
    default:
      return state;
  }
}

/**
 * A client on file as the client step starts from her: her details, and the
 * two switches as she stands. A consent she gave shows on (and stays, the
 * screen does not take it back); a STOP or an unsubscribe shows off, and the
 * desk cannot turn it on (her card can, asking first). With neither, the
 * appointment notices start on, as for a new client.
 */
export function clientFromContact(
  contact: DeskContactOption,
): Pick<
  FormState,
  | "contact"
  | "newClient"
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "gender"
  | "language"
  | "marketing"
  | "appointmentNotices"
> {
  const gender = GENDER_VALUES.find((value) => value === contact.gender);
  return {
    contact,
    newClient: false,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    gender: gender ?? GENDER_UNSPECIFIED,
    language: contact.language,
    marketing: contact.marketing === "on",
    appointmentNotices: contact.appointmentNotices !== "stopped",
  };
}
