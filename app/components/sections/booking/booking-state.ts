import type { DetailsState } from "@/types";
import { readStorage } from "@/storage/booking-storage";
import { bookableServices, type BookableService } from "@/data/services-data";

/**
 * A booking as the public form fills it in, and how it starts.
 *
 * Its own file so the step renderer and the navigation can read the shape
 * without importing the screen that arranges them.
 */
const EMPTY_DETAILS: DetailsState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consent: false,
  notes: "",
};

export type BookingState = {
  step: number;
  selectedService: BookableService | null;
  selectedTierId: string | null;
  selectedTierLabel: string | null;
  selectedTierPrice: number | null;
  /** The same session type's online price, when it differs. */
  selectedTierPriceOnline: number | null;
  selectedDuration: string | null;
  staffId: string | null;
  staffName: string | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  details: DetailsState;
  submitted: boolean;
  loading: boolean;
};

export type BookingAction =
  | { type: "SELECT_SERVICE"; service: BookableService | null }
  | {
      type: "SELECT_TIER";
      priceOnline: number | null;
      tierId: string;
      label: string | null;
      duration: string | null;
      price: number | null;
    }
  | { type: "SELECT_STAFF"; staffId: string; staffName: string }
  | { type: "SELECT_DATE"; date: Date | null }
  | { type: "SELECT_TIME"; time: string }
  | { type: "SET_STEP"; step: number }
  | { type: "SET_DETAILS"; details: DetailsState }
  | { type: "CONFIRM_START" }
  | { type: "CONFIRM_SUCCESS" };

export function bookingReducer(
  state: BookingState,
  action: BookingAction,
): BookingState {
  switch (action.type) {
    case "SELECT_SERVICE":
      return {
        ...state,
        selectedService: action.service,
        selectedTierId: null,
        selectedTierPrice: null,
        selectedTierPriceOnline: null,
        selectedDuration: null,
        staffId: null,
        staffName: null,
      };
    case "SELECT_TIER":
      return {
        ...state,
        selectedTierId: action.tierId,
        selectedTierLabel: action.label,
        selectedTierPrice: action.price,
        selectedTierPriceOnline: action.priceOnline,
        selectedDuration: action.duration,
        // Assignments are per session type, so a different tier can mean a
        // different set of people: whoever was picked may not be among them.
        ...(action.tierId !== state.selectedTierId
          ? { staffId: null, staffName: null }
          : {}),
      };
    case "SELECT_STAFF":
      return { ...state, staffId: action.staffId, staffName: action.staffName };
    case "SELECT_DATE":
      return { ...state, selectedDate: action.date };
    case "SELECT_TIME":
      return { ...state, selectedTime: action.time };
    case "SET_STEP":
      return { ...state, step: action.step };
    case "SET_DETAILS":
      return { ...state, details: action.details };
    case "CONFIRM_START":
      return { ...state, loading: true };
    case "CONFIRM_SUCCESS":
      return { ...state, loading: false };
  }
}

export type InitArg = { slug: string | null; startStep: number };

export function initState({ slug, startStep }: InitArg): BookingState {
  const saved = readStorage();
  if (slug) {
    const service = bookableServices.find((s) => s.id === slug) ?? null;
    return {
      step: startStep,
      selectedService: service,
      selectedTierId: null,
      selectedTierLabel: null,
      selectedTierPrice: null,
      selectedTierPriceOnline: null,
      selectedDuration: null,
      staffId: null,
      staffName: null,
      selectedDate: null,
      selectedTime: null,
      details: saved.details ?? EMPTY_DETAILS,
      submitted: false,
      loading: false,
    };
  }
  const service = saved.serviceId
    ? (bookableServices.find((s) => s.id === saved.serviceId) ?? null)
    : null;
  return {
    step: saved.step ?? 0,
    selectedService: service,
    selectedTierId: saved.selectedTierId ?? null,
    selectedTierLabel:
      (saved as { selectedTierLabel?: string | null }).selectedTierLabel ??
      null,
    selectedTierPrice: saved.selectedTierPrice ?? null,
    selectedTierPriceOnline: saved.selectedTierPriceOnline ?? null,
    selectedDuration: saved.selectedDuration ?? null,
    staffId: saved.staffId ?? null,
    staffName: saved.staffName ?? null,
    selectedDate: saved.selectedDate ? new Date(saved.selectedDate) : null,
    selectedTime: saved.selectedTime ?? null,
    details: saved.details ?? EMPTY_DETAILS,
    submitted: false,
    loading: false,
  };
}
