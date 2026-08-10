"use client";

import { useReducer, useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import { buildSteps } from "@/utils/calendar-helpers";
import { writeStorage, clearStorage } from "@/storage/booking-storage";
import { StepIndicator } from "./steps/step-indicator";
import { bookingDetailsSchema, parseErrors } from "@/lib/schemas";
import type { DetailsErrors } from "./steps/details-step";
import { type PaymentMethod } from "./steps/confirm-step";
import { PaymentOverlay, type RedsysFormData } from "./steps/payment-overlay";
import { useAuth } from "@/components/auth-provider";
import {
  BookingModals,
  BookingNavigation,
  BookingStepRenderer,
} from "./booking-parts";
import { bookingReducer, initState } from "./booking-state";
import {
  confirmBooking,
  saveDatetimeStep,
  saveDetailsStep,
} from "./booking-submit";

type BookingLocalState = {
  contactId: string | null;
  bookingId: string | null;
  memberBlocker: boolean;
  checking: boolean;
};

const INITIAL_LOCAL_STATE: BookingLocalState = {
  contactId: null,
  bookingId: null,
  memberBlocker: false,
  checking: false,
};

function BookingContentInner() {
  const { user } = useAuth();
  const locale = useLocale();
  const tSteps = useTranslations("booking.steps");
  const tServiceStep = useTranslations("booking.serviceStep");
  const { push } = useRouter();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const slug = get("service") ?? get("wellness") ?? get("medicine");
  const treatmentId = get("treatment");
  // All three families deep-link into the form, and the tier is matched by
  // label, so these titles have to read exactly as `service_tiers.label` does.
  const preselectedLabel = treatmentId
    ? ([...manualTherapyTreatments, ...facialTreatments, ...ivProtocols].find(
        (t) => t.id === treatmentId,
      )?.title ?? null)
    : null;

  const [local, setLocal] = useState<BookingLocalState>(INITIAL_LOCAL_STATE);
  const [detailErrors, setDetailErrors] = useState<DetailsErrors>({});
  const [redsysForm, setRedsysForm] = useState<RedsysFormData | null>(null);
  // Paying online carries the discount; paying at the centre is full price.
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("online");
  // A session type with nobody assigned cannot be performed, so the form stops
  // at the session-type step instead of walking the visitor to an empty
  // calendar and a booking nobody can honour.
  const [tierHasStaff, setTierHasStaff] = useState(false);
  const { contactId, bookingId, memberBlocker, checking } = local;

  const updateLocal = useCallback((patch: Partial<BookingLocalState>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
  }, []);

  const [state, dispatch] = useReducer(
    bookingReducer,
    { slug, startStep: treatmentId ? 1 : 0 },
    initState,
  );
  const {
    step,
    selectedService,
    selectedTierId,
    selectedTierLabel,
    selectedTierPrice,
    selectedTierPriceOnline,
    selectedDuration,
    staffId,
    staffName,
    selectedDate,
    selectedTime,
    details,
    loading,
  } = state;

  useEffect(() => {
    writeStorage({
      step,
      serviceId: selectedService?.id ?? null,
      selectedTierId,
      selectedTierLabel,
      selectedTierPrice,
      selectedTierPriceOnline,
      selectedDuration,
      staffId,
      staffName,
      selectedDate: selectedDate?.toISOString() ?? null,
      selectedTime,
      details,
    });
  }, [
    step,
    selectedService,
    selectedTierId,
    selectedTierLabel,
    selectedTierPrice,
    selectedTierPriceOnline,
    selectedDuration,
    staffId,
    staffName,
    selectedDate,
    selectedTime,
    details,
  ]);

  const rawSteps = buildSteps();
  const activeSteps = rawSteps.map((s) => ({
    ...s,
    label: tSteps(
      s.id as "service" | "duration" | "datetime" | "details" | "confirm",
    ),
  }));
  const currentStepId = activeSteps[step]?.id ?? "service";
  const isLastStep = step === activeSteps.length - 1;
  const nextStepLabel = activeSteps[step + 1]?.label;

  const canProceed: Record<string, boolean> = {
    service: !!selectedService,
    // Which person is optional — the centre can allocate one — but somebody
    // has to be able to perform the treatment.
    duration: !!selectedTierId && tierHasStaff,
    details: bookingDetailsSchema.safeParse(details).success,
    datetime: !!(selectedDate && selectedTime),
    confirm: !!(selectedDate && selectedTime),
  };

  /** Everything the writes need, gathered once from the form's own state. */
  const draft = {
    service: selectedService,
    tierId: selectedTierId,
    tierLabel: selectedTierLabel,
    tierPrice: selectedTierPrice,
    tierPriceOnline: selectedTierPriceOnline,
    duration: selectedDuration,
    staffId,
    date: selectedDate,
    time: selectedTime,
    details,
    paymentMethod,
  };

  const handleNextFromDetails = async () => {
    const errs = parseErrors(bookingDetailsSchema, details);
    if (Object.keys(errs).length > 0) {
      setDetailErrors(errs);
      return;
    }
    setDetailErrors({});
    updateLocal({ checking: true });

    const result = await saveDetailsStep({
      user: user ? { id: user.id } : null,
      locale,
      draft,
      contactId,
      bookingId,
    });

    if (result.kind === "member") {
      updateLocal({ checking: false, memberBlocker: true });
      return;
    }

    updateLocal({
      checking: false,
      contactId: result.contactId,
      bookingId: result.bookingId,
    });
    dispatch({ type: "SET_STEP", step: step + 1 });
  };

  const handleNextFromDatetime = async () => {
    await saveDatetimeStep(bookingId, selectedDate, selectedTime);
    dispatch({ type: "SET_STEP", step: step + 1 });
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedTierId) return;
    dispatch({ type: "CONFIRM_START" });

    const result = await confirmBooking({
      user: user ? { id: user.id } : null,
      locale,
      draft,
      contactId,
      bookingId,
      paymentDescription: tServiceStep(`services.${selectedService.id}.title`),
    });

    dispatch({ type: "CONFIRM_SUCCESS" });
    clearStorage();

    if (result.kind === "redsys") {
      setRedsysForm(result.formData);
      return;
    }

    // Both remaining outcomes land on the same page; only a booking paid at the
    // centre says so, because that is what the wording there depends on.
    const paid = result.kind === "on-site" ? "&payment=on-site" : "";
    push(
      `/booking/requested?service=${encodeURIComponent(selectedService.title)}${paid}`,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <StepIndicator current={step} steps={activeSteps} />

      <BookingStepRenderer
        currentStepId={currentStepId}
        selectedService={selectedService}
        selectedTierId={selectedTierId}
        selectedTierPrice={selectedTierPrice}
        selectedTierPriceOnline={selectedTierPriceOnline}
        selectedDuration={selectedDuration}
        staffId={staffId}
        staffName={staffName}
        onStaffLoaded={setTierHasStaff}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        details={details}
        detailErrors={detailErrors}
        dispatch={dispatch}
        onClearDetailError={(key) =>
          setDetailErrors((prev) => ({ ...prev, [key]: undefined }))
        }
        preselectedLabel={preselectedLabel}
        selectedTierLabel={selectedTierLabel}
        paymentMethod={paymentMethod}
        onPaymentMethodChange={setPaymentMethod}
      />

      <BookingNavigation
        step={step}
        isLastStep={isLastStep}
        nextStepLabel={nextStepLabel}
        loading={loading}
        checking={checking}
        canProceed={!!canProceed[currentStepId]}
        onBack={() => dispatch({ type: "SET_STEP", step: step - 1 })}
        onNext={
          currentStepId === "details"
            ? () => void handleNextFromDetails()
            : currentStepId === "datetime"
              ? () => void handleNextFromDatetime()
              : () => dispatch({ type: "SET_STEP", step: step + 1 })
        }
        onConfirm={() => void handleConfirm()}
      />

      <BookingModals
        memberBlocker={memberBlocker}
        onContinueAsGuest={() => {
          updateLocal({ memberBlocker: false });
          dispatch({ type: "SET_STEP", step: step + 1 });
        }}
      />

      {redsysForm && (
        <PaymentOverlay
          formData={redsysForm}
          onClose={() => setRedsysForm(null)}
        />
      )}
    </div>
  );
}

export function BookingContent() {
  return (
    <Suspense>
      <BookingContentInner />
    </Suspense>
  );
}
