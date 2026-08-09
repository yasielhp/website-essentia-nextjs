"use client";

import { useReducer, useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  updateDraftBookingMeta,
  updateDraftBookingDetails,
  confirmDraftBooking,
} from "@/actions/booking-draft";
import { Button } from "@components/ui/button";
import {
  bookableServices,
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
  type BookableService,
} from "@/data/services-data";
import { buildSteps } from "@/utils/calendar-helpers";
import {
  readStorage,
  writeStorage,
  clearStorage,
} from "@/storage/booking-storage";
import type { DetailsState } from "@/types";
import { StepIndicator } from "./steps/step-indicator";
import { ServiceStep } from "./steps/service-step";
import { DurationStep, type TierSelection } from "./steps/duration-step";
import { DetailsStep, type DetailsErrors } from "./steps/details-step";
import { bookingDetailsSchema, parseErrors } from "@/lib/schemas";
import { DateTimeStep } from "./steps/datetime-step";
import { ConfirmStep, type PaymentMethod } from "./steps/confirm-step";
import { PaymentOverlay, type RedsysFormData } from "./steps/payment-overlay";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { notifyBooking } from "@/actions/booking-notifications";

const EMPTY_DETAILS: DetailsState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consent: false,
  notes: "",
};

type BookingState = {
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

type BookingAction =
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

function bookingReducer(
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

type InitArg = { slug: string | null; startStep: number };

function initState({ slug, startStep }: InitArg): BookingState {
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

function MemberBlockerModal({ onContinue }: { onContinue: () => void }) {
  const t = useTranslations("booking.memberBlocker");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("title")}
          </h3>
          <p className="text-petroleum-400 text-sm">{t("body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="solid" size="md" href="/sign-in" className="w-full">
            {t("signIn")}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={onContinue}
            className="w-full"
          >
            {t("continueAsGuest")}
          </Button>
        </div>
      </div>
    </div>
  );
}

type BookingNavigationProps = {
  step: number;
  isLastStep: boolean;
  nextStepLabel: string | undefined;
  loading: boolean;
  checking: boolean;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
};

function BookingNavigation({
  step,
  isLastStep,
  nextStepLabel,
  loading,
  checking,
  canProceed,
  onBack,
  onNext,
  onConfirm,
}: BookingNavigationProps) {
  const t = useTranslations("booking.nav");
  return (
    <div className="flex w-full items-center justify-center gap-3">
      {step > 0 && (
        <Button
          variant="outline"
          size="md"
          onClick={onBack}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          {t("back")}
        </Button>
      )}
      {!isLastStep ? (
        <Button
          variant="solid"
          size="md"
          onClick={onNext}
          disabled={!canProceed || checking}
          className="flex-1 sm:flex-none"
        >
          {checking
            ? t("checking")
            : nextStepLabel
              ? t("nextWithLabel", { label: nextStepLabel })
              : t("nextStep")}
        </Button>
      ) : (
        <Button
          variant="solid"
          size="md"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          {loading ? t("submitting") : t("requestBooking")}
        </Button>
      )}
    </div>
  );
}

type BookingStepRendererProps = {
  currentStepId: string;
  selectedService: BookableService | null;
  selectedTierId: string | null;
  selectedTierLabel: string | null;
  selectedTierPrice: number | null;
  selectedTierPriceOnline: number | null;
  selectedDuration: string | null;
  staffId: string | null;
  staffName: string | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  details: DetailsState;
  detailErrors: DetailsErrors;
  dispatch: React.Dispatch<BookingAction>;
  onClearDetailError: (key: keyof DetailsState) => void;
  preselectedLabel?: string | null;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
};

function BookingStepRenderer({
  currentStepId,
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
  detailErrors,
  dispatch,
  onClearDetailError,
  preselectedLabel,
  paymentMethod,
  onPaymentMethodChange,
}: BookingStepRendererProps) {
  return (
    <div key={currentStepId} className="animate-fade-in-up h-full">
      {currentStepId === "service" && (
        <ServiceStep
          selected={selectedService}
          onSelect={(s) => dispatch({ type: "SELECT_SERVICE", service: s })}
        />
      )}
      {currentStepId === "duration" && selectedService && (
        <DurationStep
          serviceId={selectedService.id}
          selectedTierId={selectedTierId}
          staffId={staffId}
          preselectedLabel={preselectedLabel}
          onSelect={(sel: TierSelection) =>
            dispatch({
              type: "SELECT_TIER",
              tierId: sel.tierId,
              label: sel.label,
              duration: sel.duration,
              price: sel.price,
              priceOnline: sel.priceOnline,
            })
          }
          onSelectStaff={(person) =>
            dispatch({
              type: "SELECT_STAFF",
              staffId: person.id,
              staffName: person.name,
            })
          }
        />
      )}
      {currentStepId === "details" && (
        <DetailsStep
          details={details}
          errors={detailErrors}
          onChange={(d) => dispatch({ type: "SET_DETAILS", details: d })}
          onClearError={onClearDetailError}
        />
      )}
      {currentStepId === "datetime" && selectedService && (
        <DateTimeStep
          service={selectedService}
          tierId={selectedTierId}
          staffId={staffId}
          durationMinutes={
            selectedDuration
              ? parseInt(selectedDuration, 10) || undefined
              : undefined
          }
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onSelectDate={(d) => dispatch({ type: "SELECT_DATE", date: d })}
          onSelectTime={(t) => dispatch({ type: "SELECT_TIME", time: t })}
        />
      )}
      {currentStepId === "confirm" && selectedService && selectedTierId && (
        <ConfirmStep
          service={selectedService}
          tierId={selectedTierId}
          tierLabel={selectedTierLabel}
          duration={selectedDuration ?? ""}
          price={selectedTierPrice}
          priceOnline={selectedTierPriceOnline}
          date={selectedDate}
          time={selectedTime}
          details={details}
          staffName={staffName}
          paymentMethod={paymentMethod}
          onPaymentMethodChange={onPaymentMethodChange}
        />
      )}
    </div>
  );
}

type BookingModalsProps = {
  memberBlocker: boolean;
  onContinueAsGuest: () => void;
};

function BookingModals({
  memberBlocker,
  onContinueAsGuest,
}: BookingModalsProps) {
  return memberBlocker ? (
    <MemberBlockerModal onContinue={onContinueAsGuest} />
  ) : null;
}

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
  const { contactId, bookingId, memberBlocker, checking } = local;

  const updateLocal = useCallback((patch: Partial<BookingLocalState>) => {
    setLocal((prev) => ({ ...prev, ...patch }));
  }, []);

  const setContactId = useCallback(
    (v: string | null) => updateLocal({ contactId: v }),
    [updateLocal],
  );
  const setBookingId = useCallback(
    (v: string | null) => updateLocal({ bookingId: v }),
    [updateLocal],
  );
  const setMemberBlocker = useCallback(
    (v: boolean) => updateLocal({ memberBlocker: v }),
    [updateLocal],
  );
  const setChecking = useCallback(
    (v: boolean) => updateLocal({ checking: v }),
    [updateLocal],
  );

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
    // Picking a person is optional: a session type with nobody assigned yet
    // must still be bookable, and the centre can allocate one afterwards.
    duration: !!selectedTierId,
    details: bookingDetailsSchema.safeParse(details).success,
    datetime: !!(selectedDate && selectedTime),
    confirm: !!(selectedDate && selectedTime),
  };

  const handleNextFromDetails = async () => {
    const errs = parseErrors(bookingDetailsSchema, details);
    if (Object.keys(errs).length > 0) {
      setDetailErrors(errs);
      return;
    }
    setDetailErrors({});
    setChecking(true);

    let resolvedContactId = contactId;

    if (!user) {
      const { data: roleData } = await insforge.database.rpc(
        "check_email_role",
        {
          p_email: details.email,
        },
      );

      if (roleData === "member") {
        updateLocal({ checking: false, memberBlocker: true });
        return;
      }

      const { data: contactUuid, error: contactError } =
        await insforge.database.rpc("upsert_contact", {
          p_email: details.email,
          p_first_name: details.firstName,
          p_last_name: details.lastName,
          p_phone: details.phone,
          p_language: locale,
          p_gender: details.gender || null,
        });

      // Never swallow this. A failure here used to pass unnoticed and the draft
      // was written with no contact attached, which is how orphaned drafts —
      // and missing leads — accumulated. The booking still proceeds, because a
      // bookkeeping problem must not cost a customer their appointment, but it
      // is recorded loudly enough to be found.
      if (contactError || !contactUuid) {
        console.error(
          "[booking] upsert_contact failed; the draft will have no contact:",
          contactError ?? "no id returned",
        );
      } else {
        resolvedContactId = contactUuid as string;
        setContactId(contactUuid as string);
      }
    }

    // This step can run more than once — back and forward through the flow, or
    // a corrected typo — and each run used to create another draft. Reuse the
    // one this visit already started.
    let draftId = bookingId;

    if (draftId) {
      await updateDraftBookingDetails(draftId, {
        contactId: resolvedContactId ?? null,
        userId: user?.id ?? null,
        serviceId: selectedService?.id ?? "",
        serviceTitle: selectedService?.title ?? "",
        duration: selectedDuration ?? "",
        firstName: details.firstName,
        lastName: details.lastName,
        email: details.email,
        phone: details.phone,
      });
    } else {
      const { data: newBookingId } = await insforge.database.rpc(
        "create_draft_booking",
        {
          p_contact_id: resolvedContactId ?? null,
          p_user_id: user?.id ?? null,
          p_service_id: selectedService?.id ?? "",
          p_service_title: selectedService?.title ?? "",
          p_duration: selectedDuration ?? "",
          p_first_name: details.firstName,
          p_last_name: details.lastName,
          p_email: details.email,
          p_phone: details.phone,
        },
      );
      if (newBookingId) {
        draftId = newBookingId as string;
        setBookingId(draftId);
      }
    }

    if (draftId) {
      await updateDraftBookingMeta(
        draftId,
        selectedTierId,
        selectedTierPrice,
        user?.id ?? null,
        user?.id ? "client" : "anonymous",
        details.notes?.trim() || null,
        staffId,
        paymentMethod,
      );
    }

    setChecking(false);
    dispatch({ type: "SET_STEP", step: step + 1 });
  };

  const handleNextFromDatetime = async () => {
    if (bookingId && selectedDate && selectedTime) {
      await insforge.database.rpc("update_booking_datetime", {
        p_booking_id: bookingId,
        p_date: selectedDate.toISOString().split("T")[0],
        p_time: selectedTime,
      });
    }
    dispatch({ type: "SET_STEP", step: step + 1 });
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedTierId) return;
    dispatch({ type: "CONFIRM_START" });

    const dateStr = selectedDate
      ? selectedDate.toISOString().split("T")[0]
      : null;
    const timeStr = selectedTime ?? null;

    let resolvedBookingId = bookingId;
    if (resolvedBookingId) {
      await confirmDraftBooking(
        resolvedBookingId,
        selectedTierId,
        selectedTierPrice,
        selectedDuration ?? "",
        dateStr ?? "",
        timeStr ?? "",
      );
    } else {
      const composedNotes = details.notes?.trim() || null;
      const { data } = await insforge.database
        .from("bookings")
        .insert([
          {
            ...(user?.id ? { user_id: user.id } : {}),
            ...(contactId ? { contact_id: contactId } : {}),
            service_id: selectedService.id,
            service_title: selectedService.title,
            tier_id: selectedTierId,
            ...(staffId ? { staff_id: staffId } : {}),
            // What this booking will actually be charged, which is the online
            // price when they pay now and the centre price when they don't.
            price_eur:
              paymentMethod === "online"
                ? (selectedTierPriceOnline ?? selectedTierPrice)
                : selectedTierPrice,
            duration: selectedDuration ?? "",
            location: "centro",
            ...(composedNotes ? { notes: composedNotes } : {}),
            ...(dateStr ? { date: dateStr } : {}),
            ...(timeStr ? { time: timeStr } : {}),
            first_name: details.firstName,
            last_name: details.lastName,
            email: details.email,
            phone: details.phone,
            status: "pending",
            ...(user?.id
              ? { created_by_user_id: user.id, created_by_role: "client" }
              : { created_by_role: "anonymous" }),
          },
        ])
        .select("id")
        .single();
      resolvedBookingId = (data as { id: string } | null)?.id ?? null;
    }

    if (contactId) {
      // Through a function, not a direct update: the open UPDATE policy this
      // relied on let anyone rewrite any contact. It also only ever promotes a
      // lead — the previous `.neq("status", "client")` still demoted a member
      // to client the moment they booked.
      const { error: promoteError } = await insforge.database.rpc(
        "promote_contact_to_client",
        { p_contact_id: contactId },
      );
      if (promoteError) {
        console.error(
          "[booking] promote_contact_to_client failed; the contact stays a lead:",
          promoteError,
        );
      }
    }

    // Send "received" notification to client and staff as soon as booking is created
    if (resolvedBookingId && details.email && dateStr) {
      notifyBooking(getAccessToken(), {
        bookingId: resolvedBookingId,
        event: "received",
        clientName: `${details.firstName} ${details.lastName}`.trim(),
        clientEmail: details.email,
        clientPhone: details.phone || null,
        service: selectedService.title,
        serviceId: selectedService.id,
        sessionType: selectedTierLabel,
        amountDueEur: paymentMethod === "on-site" ? selectedTierPrice : null,
        date: dateStr,
        time: timeStr ?? "",
        duration: selectedDuration ?? null,
        locale: locale as "en" | "es",
      }).catch(() => {});
    }

    // Paying at the centre: the booking stands, the money is taken on the day.
    if (paymentMethod === "on-site") {
      dispatch({ type: "CONFIRM_SUCCESS" });
      clearStorage();
      push(
        `/booking/requested?service=${encodeURIComponent(selectedService.title)}&payment=on-site`,
      );
      return;
    }

    // Redirect to Redsys payment
    const res = await fetch("/api/checkout/booking-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: resolvedBookingId ?? "",
        tierId: selectedTierId,
        email: details.email,
        name: `${details.firstName} ${details.lastName}`.trim(),
        description: tServiceStep(`services.${selectedService.id}.title`),
        date: dateStr ?? undefined,
        time: timeStr ?? undefined,
        phone: details.phone || undefined,
      }),
    });

    if (!res.ok) {
      dispatch({ type: "CONFIRM_SUCCESS" });
      clearStorage();
      push(
        `/booking/requested?service=${encodeURIComponent(selectedService.title)}`,
      );
      return;
    }

    const formData = (await res.json()) as RedsysFormData;
    dispatch({ type: "CONFIRM_SUCCESS" });
    clearStorage();
    setRedsysForm(formData);
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
          setMemberBlocker(false);
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
