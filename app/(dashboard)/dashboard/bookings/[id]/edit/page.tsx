"use client";

import { useState, useEffect, useRef, useReducer, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Building2,
  Home,
  BedDouble,
} from "lucide-react";
import { insforge } from "@/lib/insforge";
import { ServicePicker } from "@/components/ui/service-picker";
import { TierPicker, type TierPickerOption } from "@/components/ui/tier-picker";
import { useDropdownPortal } from "@/hooks/use-dropdown-portal";
import { getAccessToken, authFetch } from "@/lib/client-session";
import { fetchBookableServices } from "@/services/bookable-services.client";
import { notifyBooking } from "@/actions/booking-notifications";
import { deleteBooking, updateBookingByAdmin } from "@/actions/booking-draft";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { contact } from "@/constants/contact";

import {
  MONTH_NAMES,
  DAY_NAMES,
  isAvailableDay,
  isSameDay,
  getCalendarDays,
  getTimeSlotsForDashboard,
} from "@/utils/calendar-helpers";
import { EmailInput } from "@/components/ui/email-input";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import { StaffSelect } from "@/components/ui/staff-select";

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

type DashboardLocation = "centro" | "habitacion" | "domicilio";

type LocationAddress = {
  street: string;
  building: string;
  postalCode: string;
  municipality: string;
};

type BookingStatus = "pending" | "confirmed" | "cancelled";

// ─── Constants ────────────────────────────────────────────────

const TENERIFE_MUNICIPALITIES = [
  "Adeje",
  "Arona",
  "Granadilla de Abona",
  "Guía de Isora",
  "San Miguel de Abona",
  "Santiago del Teide",
  "Los Cristianos",
  "Playa de las Américas",
  "Costa Adeje",
  "El Médano",
  "Los Abrigos",
  "Puerto de la Cruz",
  "Santa Cruz de Tenerife",
  "San Cristóbal de La Laguna",
  "Los Realejos",
  "Candelaria",
  "Güímar",
];

type LocationOption = {
  id: DashboardLocation;
  label: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
};

const LOCATION_ICONS: Record<
  DashboardLocation,
  React.FC<{ size?: number; className?: string }>
> = {
  centro: Building2,
  habitacion: BedDouble,
  domicilio: Home,
};

/** Wording from messages; the centre's description is a real address. */
function useLocationOptions(): LocationOption[] {
  const t = useTranslations("dashboard.bookings.form.locations");
  return [
    {
      id: "centro",
      label: t("centro.label"),
      description: contact.address,
      Icon: LOCATION_ICONS.centro,
    },
    {
      id: "habitacion",
      label: t("habitacion.label"),
      description: t("habitacion.description"),
      Icon: LOCATION_ICONS.habitacion,
    },
    {
      id: "domicilio",
      label: t("domicilio.label"),
      description: t("domicilio.description"),
      Icon: LOCATION_ICONS.domicilio,
    },
  ];
}

const EMPTY_ADDRESS: LocationAddress = {
  street: "",
  building: "",
  postalCode: "",
  municipality: "",
};

type StatusOption = {
  id: BookingStatus;
  label: string;
  description: string;
  dot: string;
};

const STATUS_DOTS: Record<BookingStatus, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
};

const STATUS_IDS: BookingStatus[] = ["pending", "confirmed", "cancelled"];

function useStatusOptions(): StatusOption[] {
  const t = useTranslations("dashboard.bookings.edit.statuses");
  return STATUS_IDS.map((id) => ({
    id,
    label: t(`${id}.label`),
    description: t(`${id}.description`),
    dot: STATUS_DOTS[id],
  }));
}

// ─── Helpers ──────────────────────────────────────────────────

function canPartnerEdit(date: string | null, time: string | null): boolean {
  if (!date || !time) return true;
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const appt = new Date(y, mo - 1, d, h, m);
  return appt.getTime() - Date.now() > (23 * 60 + 59) * 60 * 1000;
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

// ─── Status Select ────────────────────────────────────────────

function StatusSelect({
  selected,
  onSelect,
}: {
  selected: BookingStatus;
  onSelect: (s: BookingStatus) => void;
}) {
  const statuses = useStatusOptions();
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const active = statuses.find((s) => s.id === selected) ?? statuses[0]!;

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        <div className="bg-sand-200 flex size-14 shrink-0 items-center justify-center rounded-xl">
          <span className={`size-3.5 rounded-full ${active.dot}`} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-petroleum-700 font-medium">{active.label}</p>
          <p className="text-petroleum-400 text-sm">{active.description}</p>
        </div>
        <ChevronDown
          className={[
            "text-petroleum-400 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-hidden rounded-2xl border shadow-lg"
          >
            <div className="p-3">
              {statuses.map(({ id, label, description, dot }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                  className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
                >
                  <div className="bg-sand-200 flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <span className={`size-3 rounded-full ${dot}`} />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-petroleum-700 text-sm font-medium">
                      {label}
                    </p>
                    <p className="text-petroleum-400 text-xs">{description}</p>
                  </div>
                  {selected === id && (
                    <Check className="text-petroleum-700 shrink-0" size={14} />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Location Select ──────────────────────────────────────────

function LocationSelect({
  selected,
  onSelect,
  locations,
}: {
  selected: DashboardLocation | null;
  onSelect: (l: DashboardLocation) => void;
  locations: LocationOption[];
}) {
  const t = useTranslations("dashboard.bookings.form.locations");
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const active = locations.find((l) => l.id === selected);
  const single = locations.length === 1;

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !single && setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          single
            ? "border-sand-300 cursor-default"
            : isOpen
              ? "border-petroleum-400 ring-petroleum-100 ring-2"
              : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        {active ? (
          <>
            <div className="bg-sand-200 animate-fade-in-up flex size-14 shrink-0 items-center justify-center rounded-xl">
              <active.Icon size={22} className="text-petroleum-500" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-petroleum-700 font-medium">{active.label}</p>
              <p className="text-petroleum-400 text-sm">{active.description}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-sand-200 flex size-14 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-100 text-lg">+</span>
            </div>
            <p className="text-petroleum-400 flex-1 text-sm">
              {t("selectPrompt")}
            </p>
          </>
        )}
        {!single && (
          <ChevronDown
            className={[
              "text-petroleum-400 shrink-0 transition-transform duration-200",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
            size={16}
          />
        )}
      </button>

      {!single &&
        isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-hidden rounded-2xl border shadow-lg"
          >
            <div className="p-3">
              {locations.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                  className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
                >
                  <div className="bg-sand-200 flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <Icon size={20} className="text-petroleum-500" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-petroleum-700 text-sm font-medium">
                      {label}
                    </p>
                    <p className="text-petroleum-400 text-xs">{description}</p>
                  </div>
                  {selected === id && (
                    <Check className="text-petroleum-700 shrink-0" size={14} />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────

function CalendarView({
  selected,
  onSelect,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  fullyBlockedDates,
  loadingMonth,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  fullyBlockedDates: Set<string>;
  loadingMonth: boolean;
}) {
  const today = new Date();
  const days = getCalendarDays(viewYear, viewMonth);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onPrevMonth}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex items-center gap-2">
          <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          {loadingMonth && (
            <span className="border-petroleum-300 size-3 animate-spin rounded-full border border-t-transparent" />
          )}
        </div>
        <button
          type="button"
          onClick={onNextMonth}
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
          const cellKey = day ? localDateStr(day) : `empty-${i}`;
          if (!day) return <div key={cellKey} />;
          const baseAvailable = isAvailableDay(day);
          const isBlocked =
            baseAvailable && fullyBlockedDates.has(localDateStr(day));
          const available = baseAvailable && !isBlocked;
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={cellKey}
              type="button"
              disabled={!available}
              onClick={() => available && onSelect(day)}
              className={[
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-all",
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

// ─── Delete dialog ────────────────────────────────────────────

function DeleteDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.bookings.edit");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("deleteDialog.title")}
          </h3>
          <p className="text-petroleum-400 text-sm">{t("deleteDialog.body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
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
  bookingLoading: boolean;
};

type AsyncAction =
  | { type: "SERVICES_LOADED"; payload: Service[] }
  | { type: "TIERS_LOADING" }
  | { type: "TIERS_LOADED"; payload: Tier[] }
  | { type: "BOOKING_LOADED" }
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
  bookingLoading: true,
};

function asyncReducer(state: AsyncState, action: AsyncAction): AsyncState {
  switch (action.type) {
    case "SERVICES_LOADED":
      return { ...state, services: action.payload, servicesLoading: false };
    case "TIERS_LOADING":
      return { ...state, tiersLoading: true };
    case "TIERS_LOADED":
      return { ...state, tiers: action.payload, tiersLoading: false };
    case "BOOKING_LOADED":
      return { ...state, bookingLoading: false };
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
  lastName: string;
  email: string;
  phone: string;
  status: string;
  staffId: string;
};

type FormAction =
  | { type: "LOAD_BOOKING"; payload: Partial<FormState> }
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
      field: "firstName" | "lastName" | "email" | "phone" | "status";
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
  lastName: "",
  email: "",
  phone: "",
  status: "pending",
  staffId: "",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "LOAD_BOOKING":
      return { ...state, ...action.payload };
    case "SET_SERVICE":
      return { ...state, serviceId: action.id, tierId: "" };
    case "SET_TIER":
      return { ...state, tierId: action.id };
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

// ─── Form sections ────────────────────────────────────────────

type StatusSectionProps = {
  status: string;
  onChange: (s: BookingStatus) => void;
};

function StatusSection({ status, onChange }: StatusSectionProps) {
  const t = useTranslations("dashboard.bookings.edit");
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.status")}
      </h2>
      <StatusSelect
        selected={(status as BookingStatus) || "pending"}
        onSelect={onChange}
      />
    </div>
  );
}

type ServiceSectionProps = {
  loading: boolean;
  services: Service[];
  selectedService: Service | null;
  onSelect: (service: Service) => void;
};

function ServiceSection({
  loading,
  services,
  selectedService,
  onSelect,
}: ServiceSectionProps) {
  const t = useTranslations("dashboard.bookings.form");
  const servicePickerLabels = useServicePickerLabels();
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.service")}
      </h2>
      {loading ? (
        <div className="border-sand-200 bg-sand-50 h-16 animate-pulse rounded-2xl border" />
      ) : (
        <ServicePicker
          options={services}
          selected={selectedService}
          onSelect={onSelect}
          labels={servicePickerLabels}
        />
      )}
    </div>
  );
}

type LocationSectionProps = {
  location: DashboardLocation | "";
  allowedLocations: LocationOption[];
  onLocationChange: (l: DashboardLocation) => void;
  roomNumber: string;
  reservationNumber: string;
  address: LocationAddress;
  submitting: boolean;
  onRoomNumberChange: (value: string) => void;
  onReservationNumberChange: (value: string) => void;
  onAddressChange: (value: LocationAddress) => void;
};

function LocationSection({
  location,
  allowedLocations,
  onLocationChange,
  roomNumber,
  reservationNumber,
  address,
  submitting,
  onRoomNumberChange,
  onReservationNumberChange,
  onAddressChange,
}: LocationSectionProps) {
  const t = useTranslations("dashboard.bookings.form");
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.location")}
      </h2>
      <div className="flex flex-col gap-4">
        <LocationSelect
          selected={location || null}
          onSelect={onLocationChange}
          locations={allowedLocations}
        />

        {(location === "centro" || location === "habitacion") && (
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
                  onChange={(e) => onReservationNumberChange(e.target.value)}
                  placeholder={t("fields.reservationNumberPlaceholder")}
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
                  onChange={(e) => onRoomNumberChange(e.target.value)}
                  placeholder={t("fields.roomNumberPlaceholder")}
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        )}

        {location === "domicilio" && (
          <div className="animate-fade-in-up flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="addr-street"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("fields.street")} <span className="text-red-400">*</span>
              </label>
              <input
                id="addr-street"
                type="text"
                value={address.street}
                onChange={(e) =>
                  onAddressChange({ ...address, street: e.target.value })
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
                  onAddressChange({ ...address, building: e.target.value })
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
                    onAddressChange({
                      ...address,
                      postalCode: e.target.value,
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
                  list="edit-municipalities"
                  value={address.municipality}
                  onChange={(e) =>
                    onAddressChange({
                      ...address,
                      municipality: e.target.value,
                    })
                  }
                  placeholder={t("fields.municipalityPlaceholder")}
                  autoComplete="address-level2"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
                <datalist id="edit-municipalities">
                  {TENERIFE_MUNICIPALITIES.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type TierSectionProps = {
  serviceId: string;
  tiersLoading: boolean;
  tiers: Tier[];
  tierId: string;
  location: DashboardLocation | "";
  onSelect: (tierId: string) => void;
};

function TierSection({
  serviceId,
  tiersLoading,
  tiers,
  tierId,
  location,
  onSelect,
}: TierSectionProps) {
  const t = useTranslations("dashboard.bookings.form");
  const tierPickerLabels = useTierPickerLabels();
  if (!serviceId) return null;
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("steps.sessionType")}
      </h2>
      {tiersLoading ? (
        <div className="border-sand-200 bg-sand-50 h-[74px] animate-pulse rounded-2xl border" />
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
          onSelect={(o) => onSelect(o.id)}
        />
      )}
    </div>
  );
}

type DateTimeSectionProps = {
  calendarView: "date" | "time";
  selectedDate: Date | null;
  selectedTime: string;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  fullyBlockedDates: Set<string>;
  loadingMonth: boolean;
  loadingSlots: boolean;
  timeSlots: { time: string; booked: boolean }[];
  onSelectDate: (d: Date) => void;
  onSelectTime: (time: string) => void;
  onChangeView: (view: "date" | "time") => void;
};

function DateTimeSection({
  calendarView,
  selectedDate,
  selectedTime,
  viewYear,
  viewMonth,
  onPrevMonth,
  onNextMonth,
  fullyBlockedDates,
  loadingMonth,
  loadingSlots,
  timeSlots,
  onSelectDate,
  onSelectTime,
  onChangeView,
}: DateTimeSectionProps) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        Date & Time <span className="text-red-400">*</span>
      </h2>
      {calendarView === "date" ? (
        <CalendarView
          selected={selectedDate}
          onSelect={onSelectDate}
          viewYear={viewYear}
          viewMonth={viewMonth}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          fullyBlockedDates={fullyBlockedDates}
          loadingMonth={loadingMonth}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <button
            type="button"
            onClick={() => onChangeView("date")}
            className="border-sand-300 bg-sand-50 hover:border-petroleum-100 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200"
          >
            <div className="flex flex-col gap-1">
              <p className="text-petroleum-400 text-xs">Date</p>
              <p className="text-petroleum-700 font-medium">
                {selectedDate?.toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <ChevronDown className="text-petroleum-400 shrink-0" size={16} />
          </button>
          <div className="flex flex-col gap-3">
            <p className="text-petroleum-400 text-sm">Available times</p>
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
                      if (!booked) onSelectTime(time);
                    }}
                    className={[
                      "rounded-xl border py-2.5 text-sm font-medium transition-all",
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
  );
}

type ClientSectionProps = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  submitting: boolean;
  onFieldChange: (
    field: "firstName" | "lastName" | "email" | "phone",
    value: string,
  ) => void;
  onNotesChange: (value: string) => void;
};

function ClientSection({
  firstName,
  lastName,
  email,
  phone,
  notes,
  submitting,
  onFieldChange,
  onNotesChange,
}: ClientSectionProps) {
  const t = useTranslations("dashboard.bookings.form");
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
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
              {t("fields.firstName")} <span className="text-red-400">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => onFieldChange("firstName", e.target.value)}
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
              onChange={(e) => onFieldChange("lastName", e.target.value)}
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
            onChange={(value) => onFieldChange("email", value)}
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
            onChange={(e) => onFieldChange("phone", e.target.value)}
            placeholder={t("fields.phonePlaceholder")}
            disabled={submitting}
            className={INPUT_CLASS}
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
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={t("fields.notesPlaceholder")}
            rows={3}
            disabled={submitting}
            className={INPUT_CLASS + " resize-none"}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditBookingPage() {
  const tValidation = useTranslations("dashboard.validation");
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.bookings.edit");
  const tForm = useTranslations("dashboard.bookings.form");
  const tCommonLabels = useTranslations("dashboard.common");
  const locationOptions = useLocationOptions();
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const { role } = useRole();

  useEffect(() => {
    if (role && role !== "admin" && role !== "staff" && role !== "partner") {
      push(`/dashboard/bookings/${id}`);
    }
  }, [role, id, push]);

  const [async_, dispatchAsync] = useReducer(asyncReducer, asyncInitial);
  const [form, dispatchForm] = useReducer(formReducer, formInitial);
  const [deleteState, setDeleteState] = useState({
    open: false,
    pending: false,
  });
  const { open: deleteOpen, pending: deleting } = deleteState;

  const [origBookingDate, setOrigBookingDate] = useState<string | null>(null);
  const [origBookingTime, setOrigBookingTime] = useState<string>("");

  const pendingTierId = useRef<string>("");
  const originalRef = useRef<{
    status: string;
    date: string | null;
    time: string;
    serviceId: string;
    googleEventId: string | null;
  } | null>(null);

  const {
    submitting,
    error,
    services,
    servicesLoading,
    tiers,
    tiersLoading,
    bookingLoading,
  } = async_;
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
    lastName,
    email,
    phone,
    status,
    staffId,
  } = form;

  const fullNameForCrumb =
    [firstName, lastName].filter(Boolean).join(" ") || null;
  useDynamicBreadcrumb(!bookingLoading ? fullNameForCrumb : null);

  useEffect(() => {
    if (bookingLoading || !role || role !== "partner") return;
    if (!canPartnerEdit(origBookingDate, origBookingTime)) {
      push(`/dashboard/bookings/${id}`);
    }
  }, [bookingLoading, role, origBookingDate, origBookingTime, id, push]);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;

  // ── Calendar month view state (lifted to enable month-level freeBusy) ────
  const [calView, setCalView] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const { year: viewYear, month: viewMonth } = calView;

  const prevCalMonth = () => {
    setCalView((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 },
    );
  };
  const nextCalMonth = () => {
    setCalView((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 },
    );
  };

  // ── Month-level freeBusy (blocks fully-booked days in the calendar) ───────
  const [monthFreeBusy, setMonthFreeBusy] = useState<{
    busy: { start: string; end: string }[];
    loading: boolean;
  }>({ busy: [], loading: false });
  const { busy: monthBusy, loading: loadingMonth } = monthFreeBusy;

  useEffect(() => {
    if (!serviceId) return;
    let cancelled = false;
    void (async () => {
      setMonthFreeBusy({ busy: [], loading: true });
      let busy: { start: string; end: string }[] = [];
      try {
        const startDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
        const endDate = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        const res = await fetch(
          `/api/google/calendar/freebusy?service_id=${serviceId}&start=${startDate}&end=${endDate}`,
        );
        if (res.ok) {
          const json = (await res.json()) as {
            busy: { start: string; end: string }[];
          };
          busy = json.busy ?? [];
        }
      } catch {
        // fail-open
      }
      if (!cancelled) setMonthFreeBusy({ busy, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId, viewYear, viewMonth]);

  const fullyBlockedDates = useMemo(() => {
    const blocked = new Set<string>();
    if (monthBusy.length === 0) return blocked;
    const days = getCalendarDays(viewYear, viewMonth);
    for (const day of days) {
      if (!day || !isAvailableDay(day)) continue;
      const slots = getTimeSlotsForDashboard(
        day,
        selectedService?.category,
        selectedTier?.duration_minutes ?? 60,
        monthBusy,
      );
      if (slots.length > 0 && slots.every((s) => s.booked)) {
        blocked.add(localDateStr(day));
      }
    }
    return blocked;
  }, [monthBusy, viewYear, viewMonth, selectedService, selectedTier]);

  // ── freeBusy for time-slot availability ───────────────────────
  const [slotsFreeBusy, setSlotsFreeBusy] = useState<{
    busy: { start: string; end: string }[];
    loading: boolean;
  }>({ busy: [], loading: false });
  const { busy: busyIntervals, loading: loadingSlots } = slotsFreeBusy;

  useEffect(() => {
    if (!selectedDate || !serviceId) return;
    let cancelled = false;
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;
    void (async () => {
      setSlotsFreeBusy({ busy: [], loading: true });
      let busy: { start: string; end: string }[] = [];
      try {
        const r = await fetch(
          `/api/google/calendar/freebusy?service_id=${serviceId}&date=${dateStr}`,
        );
        const json = (await r.json()) as {
          busy?: { start: string; end: string }[];
        };
        busy = json.busy ?? [];
      } catch {
        // fail-open
      }
      if (!cancelled) setSlotsFreeBusy({ busy, loading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, serviceId]);

  const timeSlots = selectedDate
    ? getTimeSlotsForDashboard(
        selectedDate,
        selectedService?.category,
        selectedTier?.duration_minutes ?? 60,
        busyIntervals,
      )
    : [];

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

  // The same list the public booking flow offers.
  useEffect(() => {
    async function load() {
      dispatchAsync({
        type: "SERVICES_LOADED",
        payload: await fetchBookableServices(),
      });
    }
    void load();
  }, []);

  // Load booking
  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "service_id, tier_id, staff_id, duration, location, location_address, notes, date, time, first_name, last_name, email, phone, status, google_event_id",
        )
        .eq("id", id)
        .limit(1);

      const b = (
        data as Array<{
          service_id: string | null;
          tier_id: string | null;
          staff_id: string | null;
          duration: string | null;
          location: string | null;
          location_address: string | null;
          notes: string | null;
          date: string | null;
          time: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          status: string | null;
          google_event_id: string | null;
        }> | null
      )?.[0];

      if (!b) {
        dispatchAsync({ type: "BOOKING_LOADED" });
        return;
      }

      // Parse location address
      let parsedRoomNumber = "";
      let parsedReservationNumber = "";
      let parsedAddress = EMPTY_ADDRESS;
      if (b.location_address) {
        try {
          const parsed = JSON.parse(b.location_address) as Record<
            string,
            string
          >;
          if (b.location === "habitacion" || b.location === "centro") {
            parsedRoomNumber = parsed.roomNumber ?? "";
            parsedReservationNumber = parsed.reservationNumber ?? "";
          } else if (b.location === "domicilio") {
            parsedAddress = {
              street: parsed.street ?? "",
              building: parsed.building ?? "",
              postalCode: parsed.postalCode ?? "",
              municipality: parsed.municipality ?? "",
            };
          }
        } catch {
          /* ignore */
        }
      }

      // Parse date
      let parsedDate: Date | null = null;
      let parsedCalendarView: "date" | "time" = "date";
      if (b.date) {
        const [y, m, d] = b.date.split("-").map(Number) as [
          number,
          number,
          number,
        ];
        parsedDate = new Date(y, m - 1, d);
        parsedCalendarView = "time";
      }

      pendingTierId.current = b.tier_id ?? "";
      originalRef.current = {
        status: b.status ?? "pending",
        date: b.date ?? null,
        time: b.time ?? "",
        serviceId: b.service_id ?? "",
        googleEventId: b.google_event_id ?? null,
      };
      setOrigBookingDate(b.date ?? null);
      setOrigBookingTime(b.time ?? "");

      // Bookings taken before the staff column carry the old free-text
      // prefix; strip it so it does not show up twice.
      const parsedNotes = (b.notes ?? "").replace(
        /^Terapeuta: (?:Masculino|Femenina)(?:\n\n)?/,
        "",
      );

      dispatchForm({
        type: "LOAD_BOOKING",
        payload: {
          serviceId: b.service_id ?? "",
          location: (b.location as DashboardLocation) ?? "",
          roomNumber: parsedRoomNumber,
          reservationNumber: parsedReservationNumber,
          notes: parsedNotes,
          address: parsedAddress,
          selectedDate: parsedDate,
          selectedTime: b.time ?? "",
          calendarView: parsedCalendarView,
          firstName: b.first_name ?? "",
          lastName: b.last_name ?? "",
          email: b.email ?? "",
          phone: b.phone ?? "",
          status: b.status ?? "pending",
          staffId: b.staff_id ?? "",
        },
      });
      dispatchAsync({ type: "BOOKING_LOADED" });
    }
    void load();
  }, [id]);

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

  // Load tiers when service changes
  useEffect(() => {
    async function load() {
      if (!serviceId) {
        dispatchAsync({ type: "TIERS_LOADED", payload: [] });
        return;
      }
      dispatchAsync({ type: "TIERS_LOADING" });
      const { data } = await insforge.database
        .from("service_tiers")
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, image_url, color",
        )
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");
      const rows = (data as Tier[] | null) ?? [];
      dispatchAsync({ type: "TIERS_LOADED", payload: rows });

      if (pendingTierId.current) {
        const match = rows.find((r) => r.id === pendingTierId.current);
        if (match) dispatchForm({ type: "SET_TIER", id: match.id });
        pendingTierId.current = "";
      } else if (rows.length === 1 && rows[0]) {
        dispatchForm({ type: "SET_TIER", id: rows[0].id });
      }
    }
    void load();
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
    // Same check the create screen and the public form apply.
    if (!z.string().email().safeParse(email.trim()).success) {
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
    if (!selectedDate) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("dateRequired"),
      });
      return;
    }
    if (!selectedTime) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("timeRequired"),
      });
      return;
    }

    let locationAddress: string | null = null;
    if (location === "habitacion" || location === "centro")
      locationAddress = JSON.stringify({ roomNumber, reservationNumber });
    else if (location === "domicilio")
      locationAddress = JSON.stringify(address);

    const durationText =
      selectedTier?.duration_minutes != null
        ? `${selectedTier.duration_minutes} min`
        : null;
    const dateStr = selectedDate
      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
      : null;

    dispatchAsync({ type: "SUBMIT_START" });

    const { error: updateErrorMsg } = await updateBookingByAdmin(
      getAccessToken(),
      id,
      {
        service_id: serviceId,
        service_title: selectedService?.title ?? serviceId,
        tier_id: tierId || null,
        price_eur: selectedTier ? resolvePrice(selectedTier, location) : null,
        duration: durationText,
        date: dateStr,
        time: selectedTime || null,
        location: location || null,
        location_address: locationAddress,
        staff_id: staffId || null,
        notes: notes.trim() || null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        status,
      },
    );

    dispatchAsync({ type: "SUBMIT_END" });

    if (updateErrorMsg) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: updateErrorMsg ?? t("errors.saveFailed"),
      });
      return;
    }

    // Send email notifications based on what changed (non-blocking)
    const orig = originalRef.current;
    if (orig && email) {
      const clientName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");
      const service = selectedService?.title ?? serviceId;
      const dur =
        selectedTier?.duration_minutes != null
          ? `${selectedTier.duration_minutes} min`
          : null;

      const statusChanged = status !== orig.status;
      const dateTimeChanged =
        (dateStr ?? null) !== orig.date || (selectedTime || "") !== orig.time;

      const sessionType = selectedTier?.label ?? null;

      try {
        if (statusChanged && status === "confirmed") {
          await notifyBooking(getAccessToken(), {
            bookingId: id,
            event: "confirmed",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            sessionType,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        } else if (statusChanged && status === "cancelled") {
          await notifyBooking(getAccessToken(), {
            bookingId: id,
            event: "cancelled",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            sessionType,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        } else if (!statusChanged && dateTimeChanged) {
          await notifyBooking(getAccessToken(), {
            bookingId: id,
            event: "rescheduled",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            sessionType,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        }
      } catch {
        // Notification failed silently — booking is already saved
      }

      // Delete Google Calendar event when booking is cancelled
      if (statusChanged && status === "cancelled" && orig.googleEventId) {
        try {
          await authFetch("/api/google/calendar/event", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId || orig.serviceId,
              event_id: orig.googleEventId,
            }),
          });
        } catch {
          // fail-open: calendar deletion failure must not block navigation
        }
      }

      // Update original ref so re-saves don't re-send
      originalRef.current = {
        status,
        date: dateStr ?? null,
        time: selectedTime,
        serviceId,
        googleEventId: originalRef.current?.googleEventId ?? null,
      };
    }

    // Create Google Calendar event when booking is confirmed/paid and has date+time
    const isConfirmedStatus = status === "confirmed" || status === "paid";
    if (isConfirmedStatus && dateStr && selectedTime) {
      const clientName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");

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
        `Booking #${id}`,
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

      const existingEventId = originalRef.current?.googleEventId ?? null;

      try {
        if (existingEventId) {
          // Update existing calendar event instead of creating a duplicate
          await authFetch("/api/google/calendar/event", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId,
              event_id: existingEventId,
              summary: calSummary,
              description: descLines.join("\n"),
              location: calLocation || undefined,
              colorId: "7",
              date: dateStr,
              time: selectedTime,
              duration_minutes: selectedTier?.duration_minutes ?? 60,
            }),
          });
        } else {
          // No existing event — create one
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
            if (calData.eventId) {
              void insforge.database
                .from("bookings")
                .update({ google_event_id: calData.eventId })
                .eq("id", id);
            }
          }
        }
      } catch {
        // fail-open: calendar error must not block navigation
      }
    }

    notifySuccess(tToasts("bookingSaved"));
    push(`/dashboard/bookings/${id}`);
  }

  async function handleDelete() {
    setDeleteState((prev) => ({ ...prev, pending: true }));
    await deleteBooking(getAccessToken(), id);
    notifySuccess(tToasts("bookingDeleted"));
    push("/dashboard/bookings");
  }

  const loading = bookingLoading || servicesLoading;

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          {/* Desktop buttons */}
          <div className="hidden items-center gap-3 sm:flex">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() =>
                setDeleteState((prev) => ({ ...prev, open: true }))
              }
              disabled={loading}
            >
              {t("delete")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || loading}
            >
              {submitting ? t("saving") : t("save")}
            </Button>
          </div>
        </div>

        {/* Desktop error */}
        {error && (
          <p className="mb-6 hidden rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600 sm:block">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {/* ── 1. Status ── */}
          <StatusSection
            status={status}
            onChange={(s) =>
              dispatchForm({ type: "SET_FIELD", field: "status", value: s })
            }
          />

          {/* ── 2. Service ── */}
          <ServiceSection
            loading={loading}
            services={sortedServices}
            selectedService={selectedService}
            onSelect={(s) => dispatchForm({ type: "SET_SERVICE", id: s.id })}
          />

          {/* ── 3. Location ── */}
          <LocationSection
            location={location}
            allowedLocations={allowedLocations}
            onLocationChange={(l) =>
              dispatchForm({ type: "SET_LOCATION", value: l })
            }
            roomNumber={roomNumber}
            reservationNumber={reservationNumber}
            address={address}
            submitting={submitting}
            onRoomNumberChange={(value) =>
              dispatchForm({ type: "SET_ROOM_NUMBER", value })
            }
            onReservationNumberChange={(value) =>
              dispatchForm({ type: "SET_RESERVATION_NUMBER", value })
            }
            onAddressChange={(value) =>
              dispatchForm({ type: "SET_ADDRESS", value })
            }
          />

          {/* ── 4. Session type ── */}
          <TierSection
            serviceId={serviceId}
            tiersLoading={tiersLoading}
            tiers={tiers}
            tierId={tierId}
            location={location}
            onSelect={(id) => dispatchForm({ type: "SET_TIER", id })}
          />

          {/* ── 4b. Who performs it, among those assigned to the tier ── */}
          {tierId !== "" && tierStaff.length > 0 && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {tForm("steps.staff")}
              </h2>
              <StaffSelect
                options={tierStaff}
                selected={staffId || null}
                onSelect={(person) =>
                  dispatchForm({ type: "SET_STAFF", value: person.id })
                }
                labels={{
                  fieldLabel: tForm("steps.staff"),
                  placeholder: tForm("staff.placeholder"),
                  modalTitle: tForm("steps.staff"),
                  close: tCommonLabels("cancel"),
                }}
              />
            </div>
          )}

          {/* ── 5. Date & Time ── */}
          <DateTimeSection
            calendarView={calendarView}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={prevCalMonth}
            onNextMonth={nextCalMonth}
            fullyBlockedDates={fullyBlockedDates}
            loadingMonth={loadingMonth}
            loadingSlots={loadingSlots}
            timeSlots={timeSlots}
            onSelectDate={(d) => dispatchForm({ type: "SET_DATE", value: d })}
            onSelectTime={(time) =>
              dispatchForm({ type: "SET_TIME", value: time })
            }
            onChangeView={(view) =>
              dispatchForm({ type: "SET_CALENDAR_VIEW", value: view })
            }
          />

          {/* ── 6. Client ── */}
          <ClientSection
            firstName={firstName}
            lastName={lastName}
            email={email}
            phone={phone}
            notes={notes}
            submitting={submitting}
            onFieldChange={(field, value) =>
              dispatchForm({ type: "SET_FIELD", field, value })
            }
            onNotesChange={(value) =>
              dispatchForm({ type: "SET_NOTES", value })
            }
          />
        </div>

        {/* Mobile bottom bar */}
        <div className="mt-6 sm:hidden">
          {error && (
            <p className="mb-3 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || loading}
              className="w-full justify-center"
            >
              {submitting ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </form>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteState((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
}
