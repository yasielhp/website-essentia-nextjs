"use client";

import {
  useReducer,
  useEffect,
  useRef,
  useState,
  Suspense,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import { buildSteps } from "@/utils/calendar-helpers";
import {
  clearStorage,
  readStorage,
  resumableDraft,
  writeStorage,
} from "@/storage/booking-storage";
import { StepIndicator } from "./steps/step-indicator";
import { bookingDetailsSchema, parseErrors } from "@/lib/schemas";
import type { DetailsErrors } from "./steps/details-step";
import { firstInvalidFieldId } from "./steps/details-fields";
import type { PaymentMode } from "@/lib/payments/amounts";
import { PaymentOverlay, type RedsysFormData } from "./steps/payment-overlay";
import { useAuth } from "@/components/auth-provider";
import { fetchOwnMarketingOn } from "@/actions/whatsapp-consent";
import { getAccessToken } from "@/lib/client-session";
import {
  BookingModals,
  BookingNavigation,
  BookingStepRenderer,
} from "./booking-parts";
import { DETAILS_STEP_INDEX, bookingReducer, initState } from "./booking-state";
import {
  confirmBooking,
  saveDatetimeStep,
  saveDetailsStep,
} from "./booking-submit";

type BookingLocalState = {
  contactId: string | null;
  bookingId: string | null;
  /** When this visit's draft was started; saved with it (see `resumableDraft`). */
  draftStartedAt: number | null;
  memberBlocker: boolean;
  checking: boolean;
};

const INITIAL_LOCAL_STATE: BookingLocalState = {
  contactId: null,
  bookingId: null,
  draftStartedAt: null,
  memberBlocker: false,
  checking: false,
};

/**
 * A reload goes on with the draft this visit had already started, instead of
 * leaving it behind and starting another: the one left behind would go on
 * holding the hour she had picked, and she would find her own hour taken. The
 * contact is not kept: the details step she comes back to finds it again.
 */
function initLocalState(): BookingLocalState {
  const draft = resumableDraft(readStorage());
  return {
    ...INITIAL_LOCAL_STATE,
    bookingId: draft?.bookingId ?? null,
    draftStartedAt: draft?.startedAt ?? null,
  };
}

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

  const [local, setLocal] = useState<BookingLocalState>(initLocalState);
  const [detailErrors, setDetailErrors] = useState<DetailsErrors>({});
  const [redsysForm, setRedsysForm] = useState<RedsysFormData | null>(null);
  // Everything is paid at booking: a deposit, or the whole price at a discount.
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("deposit");
  // A session type with nobody assigned cannot be performed, so the form stops
  // at the session-type step instead of walking the visitor to an empty
  // calendar and a booking nobody can honour.
  const [tierHasStaff, setTierHasStaff] = useState(false);
  const { contactId, bookingId, draftStartedAt, memberBlocker, checking } =
    local;

  // Whether a signed-in client already has news and offers on for both
  // channels, so her box shows ticked rather than asking again. A guest has
  // nothing to read, and a failed read is just "not on".
  const [marketingOn, setMarketingOn] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchOwnMarketingOn(getAccessToken())
      .then((on) => {
        if (!cancelled) setMarketingOn(on);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      draft:
        bookingId && draftStartedAt
          ? { bookingId, startedAt: draftStartedAt }
          : null,
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
    bookingId,
    draftStartedAt,
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
    // Always open: a greyed-out button cannot say what is missing. Pressing it
    // checks the fields, writes each error under its own and takes the focus to
    // the first one (`handleNextFromDetails`).
    details: true,
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
    paymentMode,
  };

  // The field the focus is owed to. It is paid after the render, once the
  // messages are on the page (so a screen reader that lands on the field finds
  // the reason it is described by) and, when the errors send her back from the
  // confirmation, once the details step is there to be focused.
  const focusOwed = useRef<string | null>(null);
  useEffect(() => {
    const id = focusOwed.current;
    if (!id) return;
    const field = document.getElementById(id);
    if (!field) return;
    focusOwed.current = null;
    field.focus();
  }, [detailErrors, currentStepId]);

  /** Writes each error under its field and sends the focus to the first one. */
  const showDetailErrors = (errs: DetailsErrors) => {
    focusOwed.current = firstInvalidFieldId(errs);
    setDetailErrors(errs);
  };

  const handleNextFromDetails = async ({ asGuest = false } = {}) => {
    const errs = parseErrors(bookingDetailsSchema, details);
    if (Object.keys(errs).length > 0) {
      showDetailErrors(errs);
      return;
    }
    setDetailErrors({});
    updateLocal({ checking: true });

    const result = await saveDetailsStep({
      user: user ? { id: user.id, email: user.email } : null,
      locale,
      draft,
      contactId,
      bookingId,
      asGuest,
    });

    if (result.kind === "member") {
      updateLocal({ checking: false, memberBlocker: true });
      return;
    }

    updateLocal({
      checking: false,
      contactId: result.contactId,
      bookingId: result.bookingId,
      // The same draft keeps the moment it was started; a new one starts now.
      draftStartedAt: !result.bookingId
        ? null
        : result.bookingId === bookingId && draftStartedAt
          ? draftStartedAt
          : Date.now(),
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

    // Nothing was written: her details are not in order, the terms box most
    // of all. Back to the details step, with each error under its field.
    if (result.kind === "incomplete") {
      showDetailErrors(result.errors);
      dispatch({ type: "SET_STEP", step: DETAILS_STEP_INDEX });
      return;
    }

    clearStorage();

    if (result.kind === "redsys") {
      setRedsysForm(result.formData);
      return;
    }

    // The payment could not be opened; the booking stands and is chased.
    push(
      `/booking/requested?service=${encodeURIComponent(selectedService.title)}&payment=unpaid`,
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
        draftId={bookingId}
        details={details}
        detailErrors={detailErrors}
        dispatch={dispatch}
        onClearDetailError={(key) =>
          setDetailErrors((prev) => ({ ...prev, [key]: undefined }))
        }
        preselectedLabel={preselectedLabel}
        selectedTierLabel={selectedTierLabel}
        paymentMode={paymentMode}
        onPaymentModeChange={setPaymentMode}
        marketingOn={Boolean(user) && marketingOn}
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
        // The same save as any other guest, minus the question she has just
        // answered. Only moving her on, as this once did, left her booking with
        // no contact, no draft and no consent, and dropped her "news and
        // offers" tick.
        onContinueAsGuest={() => {
          updateLocal({ memberBlocker: false });
          void handleNextFromDetails({ asGuest: true });
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
