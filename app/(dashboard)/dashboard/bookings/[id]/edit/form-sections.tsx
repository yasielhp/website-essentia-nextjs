"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { ServicePicker } from "@/components/ui/service-picker";
import { TierPicker } from "@/components/ui/tier-picker";
import { EmailInput } from "@/components/ui/email-input";
import { INPUT_CLASS } from "@/constants/form-styles";
import { formatCalendarDay } from "@/utils/format";
import {
  LocationSelect,
  TENERIFE_MUNICIPALITIES,
  type DashboardLocation,
  type LocationAddress,
  type LocationOption,
} from "../../_shared/location";
import { StatusSelect } from "./status-select";
import { CalendarView } from "./calendar-view";
import {
  toTierOption,
  type BookingStatus,
  type Service,
  type Tier,
} from "./form-state";

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

/**
 * The six questions this screen asks: what state the booking is in, which
 * service, where, which session type, when, and for whom.
 *
 * They already had their own names inside two thousand lines with the page that
 * saves them. Now they have a file.
 */
// ─── Form sections ────────────────────────────────────────────

export type StatusSectionProps = {
  status: string;
  onChange: (s: BookingStatus) => void;
};

export function StatusSection({ status, onChange }: StatusSectionProps) {
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

export type ServiceSectionProps = {
  loading: boolean;
  services: Service[];
  selectedService: Service | null;
  onSelect: (service: Service) => void;
};

export function ServiceSection({
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

export type LocationSectionProps = {
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

export function LocationSection({
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

export type TierSectionProps = {
  serviceId: string;
  tiersLoading: boolean;
  tiers: Tier[];
  tierId: string;
  location: DashboardLocation | "";
  onSelect: (tierId: string) => void;
};

export function TierSection({
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

export type DateTimeSectionProps = {
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

export function DateTimeSection({
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
  );
}

export type ClientSectionProps = {
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

export function ClientSection({
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
