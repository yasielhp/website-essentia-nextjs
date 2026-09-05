"use client";

import { useState, useRef, useReducer, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { useRole } from "@/context/role-context";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { useStaffAvailability } from "@/hooks/use-staff-availability";
import { LocationStep } from "./location-step";
import { ClientStep } from "./client-step";
import { DateTimeStep } from "./datetime-step";
import { ServiceStep, StaffStep, TierStep } from "./steps";
import { MobileCreateBar, NewBookingHeader } from "./new-chrome";
import { useNewBookingData } from "./use-new-booking-data";
import { useStepLabels } from "./use-step-labels";
import {
  announceNewBooking,
  createBooking,
  validateNewBooking,
  type NewBookingDraft,
} from "./create-booking";
import {
  asyncInitial,
  asyncReducer,
  formInitial,
  formReducer,
} from "./form-state";
import { useLocationOptions } from "../_shared/location-options";

// ─── Page ─────────────────────────────────────────────────────

function NewBookingPageInner() {
  const t = useTranslations("dashboard.bookings.form");
  const tToasts = useTranslations("dashboard.toasts");
  const tValidation = useTranslations("dashboard.validation");
  const locale = useDashboardLocale();
  const locationOptions = useLocationOptions();
  const { push } = useRouter();
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
    newsletter,
  } = form;

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedTier = tiers.find((tier) => tier.id === tierId) ?? null;

  const { tierStaff } = useNewBookingData({
    serviceId,
    tierId,
    dispatchAsync,
    dispatchForm,
  });

  const {
    month: availabilityMonth,
    onMonthChange: handleMonthChange,
    openDates,
    timeSlots,
    loadingSlots,
  } = useStaffAvailability({
    serviceId,
    tierId,
    staffId,
    selectedDate,
    durationMinutes: selectedTier?.duration_minutes ?? 60,
  });

  // A partner books into the centre or a hotel room; a home visit is not
  // theirs to offer.
  const allowedLocations =
    role === "partner"
      ? locationOptions.filter(
          (l) => l.id === "centro" || l.id === "habitacion",
        )
      : locationOptions;

  const { locationLabel, datetimeLabel } = useStepLabels({
    location,
    allowedLocations,
    reservationNumber,
    roomNumber,
    address,
    selectedDate,
    selectedTime,
    locale,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatchAsync({ type: "SET_ERROR", payload: null });

    const draft: NewBookingDraft = {
      ...form,
      service: selectedService,
      tier: selectedTier,
      role,
    };

    const invalid = validateNewBooking(draft, {
      serviceRequired: tValidation("serviceRequired"),
      firstNameRequired: tValidation("firstNameRequired"),
      emailRequired: tValidation("emailRequired"),
      emailInvalid: tValidation("emailInvalid"),
      reservationRequired: t("errors.reservationRequired"),
    });
    if (invalid) {
      dispatchAsync({ type: "SET_ERROR", payload: invalid });
      return;
    }

    // Guarded by a ref rather than by `submitting`: a second click lands before
    // React has re-rendered with the flag set, and two clicks are two bookings.
    if (submittingRef.current) return;
    submittingRef.current = true;
    dispatchAsync({ type: "SUBMIT_START" });

    const result = await createBooking(draft, {
      sessionExpired:
        "Your session expired. Please sign in again and try once more.",
      createFailed: t("errors.createFailed"),
    });

    dispatchAsync({ type: "SUBMIT_END" });

    if (!result.ok) {
      submittingRef.current = false;
      dispatchAsync({ type: "SET_ERROR", payload: result.error });
      return;
    }

    await announceNewBooking(result.bookingId, draft);

    notifySuccess(tToasts("bookingCreated"));
    push("/dashboard/bookings");
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <NewBookingHeader submitting={submitting} error={error} />

        <div className="space-y-3">
          {/* ── Step 1: Service ── */}
          <ServiceStep
            services={services}
            loading={servicesLoading}
            selectedService={selectedService}
            editing={editingStep === "service"}
            onEdit={() => setEditingStep("service")}
            onDone={() => setEditingStep(null)}
            dispatchForm={dispatchForm}
          />

          {/* ── Step 2: Location ── */}
          {serviceId && (
            <LocationStep
              location={location}
              address={address}
              reservationNumber={reservationNumber}
              roomNumber={roomNumber}
              allowedLocations={allowedLocations}
              locationLabel={locationLabel}
              submitting={submitting}
              editing={editingStep === "location"}
              onEdit={() => setEditingStep("location")}
              onDone={() => setEditingStep(null)}
              dispatchForm={dispatchForm}
            />
          )}

          {/* ── Step 3: Session type ── */}
          {serviceId && location && editingStep !== "location" && (
            <TierStep
              tiers={tiers}
              loading={tiersLoading}
              tierId={tierId}
              selectedTier={selectedTier}
              location={location}
              editing={editingStep === "tier"}
              onEdit={() => setEditingStep("tier")}
              onDone={() => setEditingStep(null)}
              dispatchForm={dispatchForm}
            />
          )}

          {/* ── Step 3b: who performs it, among those assigned to the tier ── */}
          {tierId !== "" && tierStaff.length > 0 && (
            <StaffStep
              staffId={staffId}
              tierStaff={tierStaff}
              dispatchForm={dispatchForm}
            />
          )}

          {/* ── Step 4: Date & Time ──
              Only once somebody is chosen: the calendar answers "when is this
              person free", and without a person there is no question. */}
          {tierId && staffId && (
            <DateTimeStep
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              calendarView={calendarView}
              openDates={openDates}
              timeSlots={timeSlots}
              loadingSlots={loadingSlots}
              availabilityMonth={availabilityMonth}
              datetimeLabel={datetimeLabel}
              editing={editingStep === "datetime"}
              onEdit={() => setEditingStep("datetime")}
              onDone={() => setEditingStep(null)}
              onMonthChange={handleMonthChange}
              dispatchForm={dispatchForm}
            />
          )}

          {/* ── Step 5: Client ──
              Last, and only once the appointment itself exists: who it is for
              is the one thing that cannot be worked out from the rest, and
              asking for it before there is an hour to attach it to is asking
              someone to type a name into nothing. */}
          {tierId && staffId && selectedDate && selectedTime && (
            <ClientStep
              firstName={firstName}
              lastName={lastName}
              email={email}
              phone={phone}
              gender={gender}
              language={language}
              notes={notes}
              newsletter={newsletter}
              submitting={submitting}
              dispatchForm={dispatchForm}
            />
          )}
        </div>

        <MobileCreateBar submitting={submitting} />
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
