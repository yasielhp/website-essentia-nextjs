"use client";

import {
  useState,
  useEffect,
  useRef,
  useReducer,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { useDayFreeBusy } from "@/hooks/use-free-busy";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { ServicePicker } from "@/components/ui/service-picker";
import { TierPicker, type TierPickerOption } from "@/components/ui/tier-picker";
import { getAccessToken, authFetch } from "@/lib/client-session";
import { fetchBookableServices } from "@/services/bookable-services.client";
import { notifyBooking } from "@/actions/booking-notifications";
import { notifyStaffWhatsApp } from "@/actions/staff-whatsapp";
import { z } from "zod";
import { getSessionUser } from "@/actions/auth";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { formatCalendarDay, localDateStr } from "@/utils/format";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { INPUT_CLASS } from "@/constants/form-styles";
import { contact } from "@/constants/contact";
import {
  MONTH_NAMES,
  DAY_NAMES,
  isAvailableDay,
  isSameDay,
  getCalendarDays,
  getCalendarStartColumn,
  getTimeSlotsForDashboard,
} from "@/utils/calendar-helpers";
import { EmailInput } from "@/components/ui/email-input";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import { StaffSelect } from "@/components/ui/staff-select";
import { fetchAvailability, type Availability } from "@/actions/availability";
import {
  GENDER_UNSPECIFIED,
  toStoredGender,
  type GenderValue,
} from "@/constants/gender";
import { useGenderOptions } from "@/hooks/use-gender-options";
import { OptionSelect } from "@/components/ui/option-select";
import { LANGUAGE_OPTIONS } from "@/constants/i18n";
import {
  EMPTY_ADDRESS,
  LocationSelect,
  TENERIFE_MUNICIPALITIES,
  useLocationOptions,
  type DashboardLocation,
  type LocationAddress,
} from "../_shared/location";

// ─── Types ────────────────────────────────────────────────────

type Service = {
  id: string;
  title: string;
  image?: string;
  description?: string;
  category?: string;
};

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
  price_suite_eur: number | null;
  image_url: string | null;
  color: string | null;
};

function resolvePrice(
  tier: Tier,
  location: DashboardLocation | "",
): number | null {
  if (location === "habitacion") {
    return tier.price_suite_eur ?? tier.price_center_eur ?? tier.price_eur;
  }
  return tier.price_center_eur ?? tier.price_eur;
}

/** The picker shows one price, so the location decides which rate that is. */
function toTierOption(
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

// ─── Helpers ──────────────────────────────────────────────────

function useServicePickerLabels() {
  const t = useTranslations("dashboard.bookings.form.servicePicker");
  return {
    placeholder: t("placeholder"),
    modalTitle: t("modalTitle"),
    close: t("close"),
    wellness: t("wellness"),
    medicine: t("medicine"),
  };
}

function useTierPickerLabels() {
  const t = useTranslations("dashboard.bookings.form.tierPicker");
  return {
    fieldLabel: t("fieldLabel"),
    placeholder: t("placeholder"),
    modalTitle: t("modalTitle"),
    close: t("close"),
    standard: t("standard"),
  };
}

// ─── Calendar ─────────────────────────────────────────────────

function CalendarView({
  selected,
  onSelect,
  openDates,
  viewYear,
  viewMonth,
  onMonthChange,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  /** Days the chosen professional can actually take, `YYYY-MM-DD`. */
  openDates: Set<string>;
  /**
   * The month on show, owned by the page.
   *
   * It used to be local state here, announced upwards from an effect so the
   * page could ask for that month's availability — which meant every arrow
   * press rendered twice, once to move the calendar and once to tell the page
   * it had moved. The page needs the month to fetch with, so the page holds
   * it, and the arrows say what they did rather than an effect noticing.
   */
  viewYear: number;
  viewMonth: number;
  onMonthChange: (year: number, month: number) => void;
}) {
  const today = new Date();
  const days = getCalendarDays(viewYear, viewMonth);
  const startColumn = getCalendarStartColumn(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) onMonthChange(viewYear - 1, 11);
    else onMonthChange(viewYear, viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) onMonthChange(viewYear + 1, 0);
    else onMonthChange(viewYear, viewMonth + 1);
  };

  const tCal = useTranslations("dashboard.common");
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          aria-label={tCal("prevMonth")}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          aria-label={tCal("nextMonth")}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-petroleum-400 py-2 text-center text-xs font-semibold tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          // Open means both "not in the past" and "this person works then and
          // has the hour free" — the same answer the public site gets.
          const available =
            isAvailableDay(day) && openDates.has(localDateStr(day));
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={localDateStr(day)}
              // The 1st sits in its own weekday column; the rest follow it.
              style={i === 0 ? { gridColumnStart: startColumn } : undefined}
              type="button"
              disabled={!available}
              onClick={() => available && onSelect(day)}
              className={[
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-colors",
                isSelected
                  ? "bg-petroleum-400 text-sand-50 shadow-sm"
                  : available
                    ? "text-petroleum-700 hover:bg-petroleum-100 border-petroleum-100 bg-petroleum-50 cursor-pointer border"
                    : "text-sand-400 border-sand-200 cursor-not-allowed border opacity-40",
              ].join(" ")}
            >
              {day.getDate()}
              {isToday && !isSelected && (
                <span className="bg-petroleum-400 mt-0.5 size-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Async state ──────────────────────────────────────────────

type AsyncState = {
  submitting: boolean;
  error: string | null;
  services: Service[];
  servicesLoading: boolean;
  tiers: Tier[];
  tiersLoading: boolean;
};

type AsyncAction =
  | { type: "SERVICES_LOADING" }
  | { type: "SERVICES_LOADED"; payload: Service[] }
  | { type: "TIERS_LOADING" }
  | { type: "TIERS_LOADED"; payload: Tier[] }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_END" }
  | { type: "SET_ERROR"; payload: string | null };

const asyncInitial: AsyncState = {
  submitting: false,
  error: null,
  services: [],
  servicesLoading: true,
  tiers: [],
  tiersLoading: false,
};

function asyncReducer(state: AsyncState, action: AsyncAction): AsyncState {
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

// ─── Form state ───────────────────────────────────────────────

type FormState = {
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

type FormAction =
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

const formInitial: FormState = {
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

function formReducer(state: FormState, action: FormAction): FormState {
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

// ─── Completed row ───────────────────────────────────────────

function CompletedRow({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  const t = useTranslations("dashboard.bookings.form");
  return (
    <div className="border-sand-200 flex items-center gap-4 rounded-2xl border bg-white px-5 py-4">
      <div className="bg-sand-100 flex size-8 shrink-0 items-center justify-center rounded-lg">
        <Check size={14} className="text-petroleum-500" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="text-petroleum-400 text-xs">{label}</p>
        <p className="text-petroleum-700 truncate text-sm font-medium">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-petroleum-400 hover:text-petroleum-700 shrink-0 text-xs transition-colors"
      >
        {t("change")}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

function NewBookingPageInner() {
  const t = useTranslations("dashboard.bookings.form");
  const tToasts = useTranslations("dashboard.toasts");
  const tValidation = useTranslations("dashboard.validation");
  const tCommon = useTranslations("dashboard.common");
  const locale = useDashboardLocale();
  const locationOptions = useLocationOptions();
  const genderOptions = useGenderOptions();
  const servicePickerLabels = useServicePickerLabels();
  const tierPickerLabels = useTierPickerLabels();
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const { role } = useRole();
  const [async_, dispatchAsync] = useReducer(asyncReducer, asyncInitial);
  const [form, dispatchForm] = useReducer(formReducer, formInitial);
  const submittingRef = useRef(false);

  const [editingStep, setEditingStep] = useState<
    "service" | "location" | "tier" | "datetime" | null
  >(null);

  const { submitting, error, services, servicesLoading, tiers, tiersLoading } =
    async_;
  const {
    serviceId,
    tierId,
    location,
    roomNumber,
    reservationNumber,
    notes,
    address,
    selectedDate,
    selectedTime,
    calendarView,
    firstName,
    gender,
    language,
    lastName,
    email,
    phone,
    staffId,
  } = form;

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;

  // Who can perform the chosen session type.
  const [tierStaff, setTierStaff] = useState<TierStaff[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (
      tierId ? fetchTierStaff(tierId) : Promise.resolve([] as TierStaff[])
    ).then((people) => {
      if (!cancelled) setTierStaff(people);
    });
    return () => {
      cancelled = true;
    };
  }, [tierId]);

  // freeBusy for time-slot availability.
  const { busy: busyIntervals, loading: loadingSlots } = useDayFreeBusy(
    serviceId,
    selectedDate,
  );

  /**
   * What the chosen professional can actually take, month by month.
   *
   * The dashboard used to draw every future day and every hour of the day,
   * filtered only by the service's Google calendar — so it offered slots on
   * days the person does not work, and hours another of their sessions already
   * had. This is the same answer the public site gets, asked for one person.
   */
  // The answer carries the question it answers, so a reply for the previous
  // professional is simply an answer nobody asked for any more — and nothing
  // has to be cleared from inside an effect to make that true.
  const [availability, setAvailability] = useState<{
    key: string;
    data: Availability;
  }>({ key: "", data: {} });
  const [availabilityMonth, setAvailabilityMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const handleMonthChange = useCallback((year: number, month: number) => {
    setAvailabilityMonth({ year, month });
  }, []);

  const availabilityKey =
    tierId && staffId
      ? `${tierId}|${staffId}|${availabilityMonth.year}-${availabilityMonth.month}`
      : "";

  useEffect(() => {
    if (!availabilityKey) return;
    let cancelled = false;
    const { year, month } = availabilityMonth;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const mm = String(month + 1).padStart(2, "0");

    void fetchAvailability({
      tierId,
      staffId,
      from: `${year}-${mm}-01`,
      to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
      durationMinutes: selectedTier?.duration_minutes ?? 60,
    }).then((result) => {
      if (!cancelled) setAvailability({ key: availabilityKey, data: result });
    });

    return () => {
      cancelled = true;
    };
  }, [
    availabilityKey,
    availabilityMonth,
    tierId,
    staffId,
    selectedTier?.duration_minutes,
  ]);

  /** Only the answer to the question being asked; anything older is ignored. */
  const currentAvailability = useMemo(
    () => (availability.key === availabilityKey ? availability.data : {}),
    [availability, availabilityKey],
  );

  const openDates = useMemo(
    () =>
      // One pass: a day with no free hour never becomes an entry to discard.
      new Set(
        Object.entries(currentAvailability).flatMap(([date, times]) =>
          times.length > 0 ? [date] : [],
        ),
      ),
    [currentAvailability],
  );

  const timeSlots = (() => {
    if (!selectedDate) return [];
    const all = getTimeSlotsForDashboard(
      selectedDate,
      selectedService?.category,
      selectedTier?.duration_minutes ?? 60,
      busyIntervals,
    );
    // Kept to the hours this person is free: the grid still marks what the
    // service calendar has taken, and an hour they do not work never appears.
    const free = new Set(currentAvailability[localDateStr(selectedDate)] ?? []);
    return all.filter((slot) => free.has(slot.time));
  })();

  const allowedLocations =
    role === "partner"
      ? locationOptions.filter(
          (l) => l.id === "centro" || l.id === "habitacion",
        )
      : locationOptions;

  const sortedServices = services.toSorted((a, b) => {
    if (a.id === "manual-therapies") return -1;
    if (b.id === "manual-therapies") return 1;
    return a.title.localeCompare(b.title);
  });

  useEffect(() => {
    const dateParam = searchParams.get("date");
    const timeParam = searchParams.get("time");
    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      if (y && m && d) {
        const parsed = new Date(y, m - 1, d);
        if (!isNaN(parsed.getTime())) {
          dispatchForm({ type: "SET_DATE", value: parsed });
        }
      }
    }
    if (timeParam) {
      dispatchForm({ type: "SET_TIME", value: timeParam });
    }
  }, [searchParams]);

  useEffect(() => {
    async function load() {
      dispatchAsync({ type: "SERVICES_LOADING" });
      dispatchAsync({
        type: "SERVICES_LOADED",
        payload: await fetchBookableServices(),
      });
    }
    void load();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        dispatchAsync({ type: "TIERS_LOADED", payload: [] });
        dispatchForm({ type: "RESET_TIERS" });
        return;
      }
      dispatchAsync({ type: "TIERS_LOADING" });
      dispatchForm({ type: "RESET_TIERS" });
      const { data } = await insforge.database
        .from("service_tiers")
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, image_url, color",
        )
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");

      if (cancelled) return;

      const rows = (data as Tier[] | null) ?? [];
      dispatchAsync({ type: "TIERS_LOADED", payload: rows });
      if (rows.length === 1 && rows[0]) {
        dispatchForm({ type: "SET_TIER", id: rows[0].id });
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatchAsync({ type: "SET_ERROR", payload: null });

    if (!serviceId) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("serviceRequired"),
      });
      return;
    }
    if (!firstName.trim()) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("firstNameRequired"),
      });
      return;
    }
    if (!email.trim()) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("emailRequired"),
      });
      return;
    }
    /**
     * The address was only checked for being non-empty, so `oliverthomp.co.uk`
     * — no @ — was accepted, saved, and could never be matched to a contact.
     * Same rule the public booking form uses.
     */
    if (!z.email().safeParse(email.trim()).success) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("emailInvalid"),
      });
      return;
    }
    if (
      (location === "habitacion" || location === "centro") &&
      !reservationNumber.trim()
    ) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: t("errors.reservationRequired"),
      });
      return;
    }

    let locationAddress: string | null = null;
    if (location === "habitacion" || location === "centro") {
      locationAddress = JSON.stringify({ roomNumber, reservationNumber });
    } else if (location === "domicilio") {
      locationAddress = JSON.stringify(address);
    }

    const durationText =
      selectedTier?.duration_minutes != null
        ? `${selectedTier.duration_minutes} min`
        : null;

    const dateStr = selectedDate
      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
      : null;

    if (submittingRef.current) return;
    submittingRef.current = true;
    dispatchAsync({ type: "SUBMIT_START" });

    // An expired token makes the SDK fall back to the anon key, which then fails
    // the partner RLS policies. Check the session before writing anything.
    //
    // Asked on the server, which is the side that holds the cookie: the browser
    // client keeps the access token but never a user object, so its own
    // `getCurrentUser()` answers "nobody" after every page load — and moving
    // into the dashboard is always a full page load.
    const { user: sessionUser } = await getSessionUser();
    if (!sessionUser) {
      submittingRef.current = false;
      dispatchAsync({ type: "SUBMIT_END" });
      dispatchAsync({
        type: "SET_ERROR",
        payload:
          "Your session expired. Please sign in again and try once more.",
      });
      return;
    }
    const authUserId = sessionUser.id;

    // The id is generated client-side so the insert does not need a RETURNING
    // clause — RETURNING would require a SELECT policy covering the new row.
    const bookingId = crypto.randomUUID();

    // Link the client's contact record. Bookings created here never set
    // `contact_id`, which is why 81 of 100 rows had none and a client's history
    // looked empty on their own page. `upsert_contact` creates the contact or
    // returns the existing one, exactly as the public booking flow does.
    let contactId: string | null = null;
    const bookingEmail = email.trim();
    if (bookingEmail) {
      const { data: contactUuid, error: contactError } =
        await insforge.database.rpc("upsert_contact", {
          p_email: bookingEmail,
          p_first_name: firstName.trim(),
          p_last_name: lastName.trim(),
          p_phone: phone.trim() || null,
          p_language: language,
          p_gender: toStoredGender(gender),
        });
      // A booking is worth more than its contact link, so a failure here does
      // not stop the write — but it is said out loud. Swallowing it is how
      // every dashboard booking came to be saved with no contact at all.
      if (contactError) {
        console.error(
          "[booking] upsert_contact failed; the booking will have no contact:",
          contactError,
        );
      }
      contactId = (contactUuid as string | null) ?? null;
    }

    const { error: insertError } = await insforge.database
      .from("bookings")
      .insert([
        {
          id: bookingId,
          service_id: serviceId,
          service_title: selectedService?.title ?? serviceId,
          tier_id: tierId || null,
          price_eur: selectedTier ? resolvePrice(selectedTier, location) : null,
          duration: durationText,
          date: dateStr,
          time: selectedTime || null,
          location: location || null,
          location_address: locationAddress,
          ...(staffId ? { staff_id: staffId } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: bookingEmail,
          phone: phone.trim() || null,
          ...(contactId ? { contact_id: contactId } : {}),
          status: "confirmed",
          ...(role === "partner" ? { partner_id: authUserId } : {}),
          created_by_user_id: authUserId,
          ...(role ? { created_by_role: role as string } : {}),
        },
      ]);

    dispatchAsync({ type: "SUBMIT_END" });

    if (insertError) {
      submittingRef.current = false;
      dispatchAsync({
        type: "SET_ERROR",
        payload:
          (insertError as { message?: string })?.message ??
          t("errors.createFailed"),
      });
      return;
    }

    const clientName = [firstName.trim(), lastName.trim()]
      .filter(Boolean)
      .join(" ");

    // Send notifications (non-blocking)
    if (email.trim() && dateStr) {
      try {
        await notifyBooking(getAccessToken(), {
          bookingId,
          event: "confirmed",
          clientName,
          clientEmail: email.trim(),
          clientPhone: phone.trim() || null,
          service: selectedService?.title ?? serviceId,
          serviceId,
          sessionType: selectedTier?.label ?? null,
          date: dateStr,
          time: selectedTime || "",
          duration:
            selectedTier?.duration_minutes != null
              ? `${selectedTier.duration_minutes} min`
              : null,
          // The client's language, not the language of whoever is at the desk.
          locale: language === "en" ? "en" : "es",
        });
      } catch {
        // Notification failed silently — booking is already saved
      }
    }

    // The professional gets it on WhatsApp too: whoever took this booking at
    // the desk is not going to walk down the corridor to say so.
    if (staffId) {
      await notifyStaffWhatsApp(getAccessToken(), {
        bookingId,
        staffId,
        event: "assigned",
      });
    }

    // Create Google Calendar event (non-blocking, only for confirmed bookings)
    if (dateStr && selectedTime) {
      // Build location string for the event
      const calLocation = (() => {
        if (location === "centro") return contact.address;
        if (location === "habitacion") {
          const parts: string[] = [];
          if (reservationNumber.trim())
            parts.push(`Reservation: ${reservationNumber.trim()}`);
          if (roomNumber.trim()) parts.push(`Room: ${roomNumber.trim()}`);
          return parts.length
            ? `Baobab Suites — ${parts.join(" · ")}`
            : "Baobab Suites";
        }
        if (location === "domicilio") {
          const parts: string[] = [];
          if (address.street.trim()) parts.push(address.street.trim());
          if (address.building.trim()) parts.push(address.building.trim());
          if (address.postalCode.trim() || address.municipality.trim())
            parts.push(
              [address.postalCode.trim(), address.municipality.trim()]
                .filter(Boolean)
                .join(" "),
            );
          return parts.filter(Boolean).join(", ");
        }
        return "";
      })();

      const descLines = [
        `Booking #${bookingId}`,
        phone.trim() ? `Phone: ${phone.trim()}` : null,
        email.trim() ? `Email: ${email.trim()}` : null,
        notes.trim() ? `Notes: ${notes.trim()}` : null,
      ].filter(Boolean);

      const tierParts: string[] = [];
      if (selectedTier?.label) tierParts.push(selectedTier.label);
      if (selectedTier?.duration_minutes != null)
        tierParts.push(`${selectedTier.duration_minutes} min`);
      const tierInfo = tierParts.join(" · ");
      const serviceName = selectedService?.title ?? serviceId;
      const calSummary = tierInfo
        ? `${serviceName} · ${tierInfo} — ${clientName}`
        : `${serviceName} — ${clientName}`;

      try {
        const calRes = await authFetch("/api/google/calendar/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service_id: serviceId,
            summary: calSummary,
            description: descLines.join("\n"),
            location: calLocation || undefined,
            colorId: "7",
            date: dateStr,
            time: selectedTime,
            duration_minutes: selectedTier?.duration_minutes ?? 60,
          }),
        });
        if (calRes.ok) {
          const calData = (await calRes.json()) as { eventId?: string };
          if (calData.eventId && bookingId) {
            void insforge.database
              .from("bookings")
              .update({ google_event_id: calData.eventId })
              .eq("id", bookingId);
          }
        }
      } catch {
        // fail-open: calendar error must not block navigation
      }
    }

    notifySuccess(tToasts("bookingCreated"));
    push("/dashboard/bookings");
  }

  const locationLabel = (() => {
    const base = allowedLocations.find((l) => l.id === location)?.label ?? "";
    if (location === "centro" || location === "habitacion") {
      const parts: string[] = [];
      if (reservationNumber.trim())
        parts.push(
          t("locations.reservationSummary", {
            number: reservationNumber.trim(),
          }),
        );
      if (roomNumber.trim())
        parts.push(t("locations.roomSummary", { number: roomNumber.trim() }));
      return parts.length ? parts.join(" · ") : base;
    }
    if (location === "domicilio") {
      const parts: string[] = [];
      if (address.street.trim()) parts.push(address.street.trim());
      if (address.postalCode.trim() || address.municipality.trim())
        parts.push(
          [address.postalCode.trim(), address.municipality.trim()]
            .filter(Boolean)
            .join(" "),
        );
      return parts.length ? parts.join(" · ") : base;
    }
    return base;
  })();
  const shortDayLabel = selectedDate
    ? formatCalendarDay(selectedDate, locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
      })
    : "";
  const datetimeLabel = !selectedDate
    ? ""
    : selectedTime
      ? `${shortDayLabel} · ${selectedTime}`
      : shortDayLabel;

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          <div className="hidden items-center gap-3 sm:flex">
            <Button variant="outline" size="md" href="/dashboard/bookings">
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
            >
              {submitting ? t("creating") : t("createBooking")}
            </Button>
          </div>
        </div>

        {error && (
          <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {/* ── Step 1: Service ── */}
          {serviceId && editingStep !== "service" ? (
            <CompletedRow
              label={t("steps.service")}
              value={selectedService?.title ?? ""}
              onEdit={() => setEditingStep("service")}
            />
          ) : (
            <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("steps.service")}
              </h2>
              {servicesLoading ? (
                <div className="border-sand-200 bg-sand-50 h-16 animate-pulse rounded-2xl border" />
              ) : (
                <ServicePicker
                  options={sortedServices}
                  selected={selectedService}
                  onSelect={(s) => {
                    dispatchForm({ type: "SET_SERVICE", id: s.id });
                    setEditingStep(null);
                  }}
                  labels={servicePickerLabels}
                />
              )}
            </div>
          )}

          {/* ── Step 2: Location ── */}
          {serviceId && (
            <>
              {location && editingStep !== "location" ? (
                <CompletedRow
                  label={t("steps.location")}
                  value={locationLabel}
                  onEdit={() => setEditingStep("location")}
                />
              ) : (
                <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
                  <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                    {t("steps.location")}
                  </h2>
                  <div className="flex flex-col gap-4">
                    <LocationSelect
                      selected={location || null}
                      onSelect={(l) => {
                        dispatchForm({ type: "SET_LOCATION", value: l });
                        setEditingStep("location");
                      }}
                      locations={allowedLocations}
                    />

                    {location === "centro" && (
                      <div className="animate-fade-in-up flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="centro-reservationNumber"
                              className="text-petroleum-500 text-xs font-medium"
                            >
                              {t("fields.reservationNumber")}{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="centro-reservationNumber"
                              type="text"
                              value={reservationNumber}
                              onChange={(e) =>
                                dispatchForm({
                                  type: "SET_RESERVATION_NUMBER",
                                  value: e.target.value,
                                })
                              }
                              placeholder={t(
                                "fields.reservationNumberPlaceholder",
                              )}
                              disabled={submitting}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="centro-roomNumber"
                              className="text-petroleum-500 text-xs font-medium"
                            >
                              {t("fields.roomNumber")}
                            </label>
                            <input
                              id="centro-roomNumber"
                              type="text"
                              value={roomNumber}
                              onChange={(e) =>
                                dispatchForm({
                                  type: "SET_ROOM_NUMBER",
                                  value: e.target.value,
                                })
                              }
                              placeholder={t("fields.roomNumberPlaceholder")}
                              disabled={submitting}
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="solid"
                          size="sm"
                          disabled={!reservationNumber.trim()}
                          onClick={() => setEditingStep(null)}
                          className="self-start"
                        >
                          {t("locations.confirm")}
                        </Button>
                      </div>
                    )}

                    {location === "habitacion" && (
                      <div className="animate-fade-in-up flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="reservationNumber"
                              className="text-petroleum-500 text-xs font-medium"
                            >
                              {t("fields.reservationNumber")}{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="reservationNumber"
                              type="text"
                              value={reservationNumber}
                              onChange={(e) =>
                                dispatchForm({
                                  type: "SET_RESERVATION_NUMBER",
                                  value: e.target.value,
                                })
                              }
                              placeholder={t(
                                "fields.reservationNumberPlaceholder",
                              )}
                              disabled={submitting}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="roomNumber"
                              className="text-petroleum-500 text-xs font-medium"
                            >
                              {t("fields.roomNumber")}
                            </label>
                            <input
                              id="roomNumber"
                              type="text"
                              value={roomNumber}
                              onChange={(e) =>
                                dispatchForm({
                                  type: "SET_ROOM_NUMBER",
                                  value: e.target.value,
                                })
                              }
                              placeholder={t("fields.roomNumberPlaceholder")}
                              disabled={submitting}
                              className={INPUT_CLASS}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="solid"
                          size="sm"
                          disabled={!reservationNumber.trim()}
                          onClick={() => setEditingStep(null)}
                          className="self-start"
                        >
                          {t("locations.confirm")}
                        </Button>
                      </div>
                    )}

                    {location === "domicilio" && (
                      <div className="animate-fade-in-up flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="addr-street"
                            className="text-petroleum-500 text-xs font-medium"
                          >
                            {t("fields.street")}{" "}
                            <span className="text-red-400">*</span>
                          </label>
                          <input
                            id="addr-street"
                            type="text"
                            value={address.street}
                            onChange={(e) =>
                              dispatchForm({
                                type: "SET_ADDRESS",
                                value: { ...address, street: e.target.value },
                              })
                            }
                            placeholder={t("fields.streetPlaceholder")}
                            autoComplete="address-line1"
                            disabled={submitting}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label
                            htmlFor="addr-building"
                            className="text-petroleum-500 text-xs font-medium"
                          >
                            {t("fields.building")}
                          </label>
                          <input
                            id="addr-building"
                            type="text"
                            value={address.building}
                            onChange={(e) =>
                              dispatchForm({
                                type: "SET_ADDRESS",
                                value: { ...address, building: e.target.value },
                              })
                            }
                            placeholder={t("fields.buildingPlaceholder")}
                            autoComplete="address-line2"
                            disabled={submitting}
                            className={INPUT_CLASS}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="addr-postal"
                              className="text-petroleum-500 text-xs font-medium"
                            >
                              {t("fields.postalCode")}{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="addr-postal"
                              type="text"
                              inputMode="numeric"
                              maxLength={5}
                              value={address.postalCode}
                              onChange={(e) =>
                                dispatchForm({
                                  type: "SET_ADDRESS",
                                  value: {
                                    ...address,
                                    postalCode: e.target.value,
                                  },
                                })
                              }
                              placeholder={t("fields.postalCodePlaceholder")}
                              autoComplete="postal-code"
                              disabled={submitting}
                              className={INPUT_CLASS}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label
                              htmlFor="addr-municipality"
                              className="text-petroleum-500 text-xs font-medium"
                            >
                              {t("fields.municipality")}{" "}
                              <span className="text-red-400">*</span>
                            </label>
                            <input
                              id="addr-municipality"
                              type="text"
                              list="dash-municipalities"
                              value={address.municipality}
                              onChange={(e) =>
                                dispatchForm({
                                  type: "SET_ADDRESS",
                                  value: {
                                    ...address,
                                    municipality: e.target.value,
                                  },
                                })
                              }
                              placeholder={t("fields.municipalityPlaceholder")}
                              autoComplete="address-level2"
                              disabled={submitting}
                              className={INPUT_CLASS}
                            />
                            <datalist id="dash-municipalities">
                              {TENERIFE_MUNICIPALITIES.map((m) => (
                                <option key={m} value={m} />
                              ))}
                            </datalist>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="solid"
                          size="sm"
                          disabled={
                            !address.street.trim() ||
                            !address.postalCode.trim() ||
                            !address.municipality.trim()
                          }
                          onClick={() => setEditingStep(null)}
                          className="self-start"
                        >
                          {t("locations.confirm")}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Session type ── */}
          {serviceId && location && editingStep !== "location" && (
            <>
              {tierId && editingStep !== "tier" ? (
                <CompletedRow
                  label={t("steps.sessionType")}
                  value={
                    selectedTier
                      ? [
                          selectedTier.label,
                          selectedTier.duration_minutes != null
                            ? `${selectedTier.duration_minutes} min`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : ""
                  }
                  onEdit={() => setEditingStep("tier")}
                />
              ) : (
                <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
                  <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                    {t("steps.sessionType")}
                  </h2>
                  {tiersLoading ? (
                    <div className="border-sand-200 bg-sand-50 h-18.5 animate-pulse rounded-2xl border" />
                  ) : tiers.length === 0 ? (
                    <p className="text-petroleum-300 border-sand-200 rounded-xl border border-dashed px-4 py-3 text-sm">
                      {t("noTiers")}
                    </p>
                  ) : (
                    <TierPicker
                      options={tiers.map((t) => toTierOption(t, location))}
                      selectedId={tierId}
                      labels={tierPickerLabels}
                      collapseSingle
                      onSelect={(o) => {
                        dispatchForm({ type: "SET_TIER", id: o.id });
                        setEditingStep(null);
                      }}
                    />
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Step 3b: who performs it, among those assigned to the tier ── */}
          {tierId !== "" && tierStaff.length > 0 && (
            <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("steps.staff")}
              </h2>
              <StaffSelect
                options={tierStaff}
                selected={staffId || null}
                onSelect={(person) =>
                  dispatchForm({ type: "SET_STAFF", value: person.id })
                }
                labels={{
                  fieldLabel: t("steps.staff"),
                  placeholder: t("staff.placeholder"),
                  modalTitle: t("steps.staff"),
                  close: tCommon("cancel"),
                }}
              />
            </div>
          )}

          {/* ── Step 4: Date & Time ──
              Only once somebody is chosen: the calendar answers "when is this
              person free", and without a person there is no question. */}
          {tierId && staffId && (
            <>
              {selectedDate && selectedTime && editingStep !== "datetime" ? (
                <CompletedRow
                  label={t("steps.datetime")}
                  value={datetimeLabel}
                  onEdit={() => setEditingStep("datetime")}
                />
              ) : (
                <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
                  <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                    Date & Time
                  </h2>
                  {calendarView === "date" ? (
                    <CalendarView
                      selected={selectedDate}
                      openDates={openDates}
                      viewYear={availabilityMonth.year}
                      viewMonth={availabilityMonth.month}
                      onMonthChange={handleMonthChange}
                      onSelect={(d) =>
                        dispatchForm({ type: "SET_DATE", value: d })
                      }
                    />
                  ) : (
                    <div className="flex flex-col gap-5">
                      <button
                        type="button"
                        onClick={() =>
                          dispatchForm({
                            type: "SET_CALENDAR_VIEW",
                            value: "date",
                          })
                        }
                        className="border-sand-300 bg-sand-50 hover:border-petroleum-100 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors duration-200"
                      >
                        <div className="flex flex-col gap-1">
                          <p className="text-petroleum-400 text-xs">Date</p>
                          <p className="text-petroleum-700 font-medium">
                            {selectedDate &&
                              formatCalendarDay(selectedDate, "en", {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                          </p>
                        </div>
                        <ChevronDown
                          className="text-petroleum-400 shrink-0"
                          size={16}
                        />
                      </button>
                      <div className="flex flex-col gap-3">
                        <p className="text-petroleum-400 text-sm">
                          {t("availableTimes")}
                        </p>
                        {loadingSlots ? (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {Array.from({ length: 8 }).map((_, i) => (
                              <div
                                key={i}
                                className="bg-sand-100 h-10 animate-pulse rounded-xl"
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {timeSlots.map(({ time, booked }) => (
                              <button
                                key={time}
                                type="button"
                                disabled={booked}
                                onClick={() => {
                                  if (booked) return;
                                  dispatchForm({
                                    type: "SET_TIME",
                                    value: time,
                                  });
                                  setEditingStep(null);
                                }}
                                className={[
                                  "rounded-xl border py-2.5 text-sm font-medium transition-colors",
                                  selectedTime === time
                                    ? "bg-petroleum-400 border-petroleum-400 text-sand-50 shadow-sm"
                                    : booked
                                      ? "border-sand-200 text-sand-400 cursor-not-allowed opacity-40"
                                      : "bg-petroleum-50 border-petroleum-100 text-petroleum-700 hover:bg-petroleum-100 cursor-pointer",
                                ].join(" ")}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Step 5: Client ──
              Last, and only once the appointment itself exists: who it is for
              is the one thing that cannot be worked out from the rest, and
              asking for it before there is an hour to attach it to is asking
              someone to type a name into nothing. */}
          {tierId && staffId && selectedDate && selectedTime && (
            <div className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("steps.client")}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="firstName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.firstName")}{" "}
                      <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_FIELD",
                          field: "firstName",
                          value: e.target.value,
                        })
                      }
                      placeholder={t("fields.firstNamePlaceholder")}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="lastName"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      {t("fields.lastName")}
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_FIELD",
                          field: "lastName",
                          value: e.target.value,
                        })
                      }
                      placeholder={t("fields.lastNamePlaceholder")}
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="email"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.email")} <span className="text-red-400">*</span>
                  </label>
                  <EmailInput
                    id="email"
                    value={email}
                    onChange={(value) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "email",
                        value: value,
                      })
                    }
                    placeholder={t("fields.emailPlaceholder")}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="phone"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.phone")}
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "phone",
                        value: e.target.value,
                      })
                    }
                    placeholder={t("fields.phonePlaceholder")}
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="client-gender"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.gender")}
                  </label>
                  <OptionSelect
                    id="client-gender"
                    value={gender}
                    options={genderOptions}
                    onChange={(next) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "gender",
                        value: next,
                      })
                    }
                    disabled={submitting}
                    ariaLabel={t("fields.gender")}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="client-language"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.language")}
                  </label>
                  <OptionSelect
                    id="client-language"
                    value={language}
                    options={LANGUAGE_OPTIONS}
                    onChange={(next) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "language",
                        value: next,
                      })
                    }
                    disabled={submitting}
                    ariaLabel={t("fields.language")}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="notes"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    {t("fields.notes")}
                  </label>
                  <textarea
                    id="notes"
                    value={notes}
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_NOTES",
                        value: e.target.value,
                      })
                    }
                    placeholder={t("fields.notesPlaceholder")}
                    rows={3}
                    disabled={submitting}
                    className={INPUT_CLASS + " resize-none"}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Mobile bottom bar */}
        <div className="mt-6 sm:hidden">
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="md"
              href="/dashboard/bookings"
              className="w-full justify-center"
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting}
              className="w-full justify-center"
            >
              {submitting ? t("creating") : t("createBooking")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function NewBookingPage() {
  return (
    <Suspense>
      <NewBookingPageInner />
    </Suspense>
  );
}
