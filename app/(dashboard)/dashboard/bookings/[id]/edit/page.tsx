"use client";

import { useState, useEffect, useReducer } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { getAccessToken } from "@/lib/client-session";
import { deleteBooking } from "@/actions/booking-draft";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useRole } from "@/context/role-context";
import { DeleteDialog } from "./delete-dialog";
import { EditHeader, MobileSaveBar } from "./edit-chrome";
import {
  ClientSection,
  DateTimeSection,
  LocationSection,
  ServiceSection,
  StaffSection,
  StatusSection,
  TierSection,
} from "./form-sections";
import {
  asyncInitial,
  asyncReducer,
  formInitial,
  formReducer,
} from "./form-state";
import { useBookingEditData } from "./use-booking-edit-data";
import { useCalendarMonth } from "./use-calendar-month";
import {
  announceBookingSaved,
  updateBooking,
  toDraft,
  validateBookingDraft,
} from "./save-booking";
import { useLocationOptions } from "../../_shared/location-options";

// ─── Helpers ──────────────────────────────────────────────────

function canPartnerEdit(date: string | null, time: string | null): boolean {
  if (!date || !time) return true;
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const appt = new Date(y, mo - 1, d, h, m);
  return appt.getTime() - Date.now() > (23 * 60 + 59) * 60 * 1000;
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditBookingPage() {
  const tValidation = useTranslations("dashboard.validation");
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.bookings.edit");
  const locationOptions = useLocationOptions();
  const validationMessages = {
    serviceRequired: tValidation("serviceRequired"),
    firstNameRequired: tValidation("firstNameRequired"),
    emailRequired: tValidation("emailRequired"),
    emailInvalid: tValidation("emailInvalid"),
    reservationRequired: t("errors.reservationRequired"),
    dateRequired: tValidation("dateRequired"),
    timeRequired: tValidation("timeRequired"),
  };
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

  const { originalRef, tierStaff, origDate, origTime } = useBookingEditData({
    id,
    serviceId,
    tierId,
    dispatchAsync,
    dispatchForm,
  });

  const fullNameForCrumb =
    [firstName, lastName].filter(Boolean).join(" ") || null;
  useDynamicBreadcrumb(!bookingLoading ? fullNameForCrumb : null);

  useEffect(() => {
    if (bookingLoading || !role || role !== "partner") return;
    if (!canPartnerEdit(origDate, origTime)) {
      push(`/dashboard/bookings/${id}`);
    }
  }, [bookingLoading, role, origDate, origTime, id, push]);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedTier = tiers.find((tier) => tier.id === tierId) ?? null;

  const {
    viewYear,
    viewMonth,
    prevMonth,
    nextMonth,
    fullyBlockedDates,
    loadingMonth,
    loadingSlots,
    timeSlots,
  } = useCalendarMonth({
    serviceId,
    serviceCategory: selectedService?.category,
    durationMinutes: selectedTier?.duration_minutes ?? 60,
    selectedDate,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatchAsync({ type: "SET_ERROR", payload: null });

    const draft = toDraft(form, selectedService, selectedTier);

    const invalid = validateBookingDraft(draft, validationMessages);
    if (invalid) {
      dispatchAsync({ type: "SET_ERROR", payload: invalid });
      return;
    }

    dispatchAsync({ type: "SUBMIT_START" });
    const { error: saveError } = await updateBooking(
      getAccessToken(),
      id,
      draft,
    );
    dispatchAsync({ type: "SUBMIT_END" });

    if (saveError) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: saveError || t("errors.saveFailed"),
      });
      return;
    }

    // Told after the write, never before: a message about a change that failed
    // to save is worse than no message at all.
    const saved = await announceBookingSaved({
      token: getAccessToken(),
      id,
      draft,
      original: originalRef.current,
    });
    // So a second save compares against what was just stored.
    if (saved) originalRef.current = saved;

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
        <EditHeader
          loading={loading}
          submitting={submitting}
          error={error}
          onDelete={() => setDeleteState((prev) => ({ ...prev, open: true }))}
        />

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
            services={services}
            selectedService={selectedService}
            onSelect={(s) => dispatchForm({ type: "SET_SERVICE", id: s.id })}
          />

          {/* ── 3. Location ── */}
          <LocationSection
            location={location}
            role={role}
            locationOptions={locationOptions}
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
            onSelect={(nextTierId) =>
              dispatchForm({ type: "SET_TIER", id: nextTierId })
            }
          />

          {/* ── 4b. Who performs it ── */}
          {tierId !== "" && tierStaff.length > 0 && (
            <StaffSection
              staffId={staffId}
              tierStaff={tierStaff}
              onSelect={(value) => dispatchForm({ type: "SET_STAFF", value })}
            />
          )}

          {/* ── 5. Date & Time ── */}
          <DateTimeSection
            calendarView={calendarView}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={prevMonth}
            onNextMonth={nextMonth}
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

        <MobileSaveBar
          loading={loading}
          submitting={submitting}
          error={error}
        />
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
