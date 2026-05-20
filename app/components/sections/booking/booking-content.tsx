"use client";

import { useReducer, useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notifyBooking } from "@/actions/booking-notifications";
import { Button } from "@components/ui/button";
import {
  bookableServices,
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
import { ConfirmStep } from "./steps/confirm-step";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";

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
  selectedTierPrice: number | null;
  selectedDuration: string | null;
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
      tierId: string;
      duration: string | null;
      price: number | null;
    }
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
        selectedDuration: null,
      };
    case "SELECT_TIER":
      return {
        ...state,
        selectedTierId: action.tierId,
        selectedTierPrice: action.price,
        selectedDuration: action.duration,
      };
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
      selectedTierPrice: null,
      selectedDuration: null,
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
    selectedTierPrice: saved.selectedTierPrice ?? null,
    selectedDuration: saved.selectedDuration ?? null,
    selectedDate: saved.selectedDate ? new Date(saved.selectedDate) : null,
    selectedTime: saved.selectedTime ?? null,
    details: saved.details ?? EMPTY_DETAILS,
    submitted: false,
    loading: false,
  };
}

function MemberBlockerModal({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Active membership found
          </h3>
          <p className="text-petroleum-400 text-sm">
            This email is linked to an active Essentia membership. Sign in to
            book with your member benefits.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="solid" size="md" href="/sign-in" className="w-full">
            Sign in to my account
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={onContinue}
            className="w-full"
          >
            Continue as guest
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
          Back
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
            ? "Checking…"
            : nextStepLabel
              ? `Next: ${nextStepLabel}`
              : "Next step"}
        </Button>
      ) : (
        <Button
          variant="solid"
          size="md"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          {loading ? "Submitting…" : "Request booking"}
        </Button>
      )}
    </div>
  );
}

function BookingHeader() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
        Book a session.
      </h1>
      <p className="text-petroleum-400">
        Choose your service, pick a time, and we will take care of the rest.
      </p>
    </div>
  );
}

type BookingStepRendererProps = {
  currentStepId: string;
  selectedService: BookableService | null;
  selectedTierId: string | null;
  selectedTierPrice: number | null;
  selectedDuration: string | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  details: DetailsState;
  detailErrors: DetailsErrors;
  dispatch: React.Dispatch<BookingAction>;
  onClearDetailError: (key: keyof DetailsState) => void;
  preselectedLabel?: string | null;
};

function BookingStepRenderer({
  currentStepId,
  selectedService,
  selectedTierId,
  selectedTierPrice,
  selectedDuration,
  selectedDate,
  selectedTime,
  details,
  detailErrors,
  dispatch,
  onClearDetailError,
  preselectedLabel,
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
          preselectedLabel={preselectedLabel}
          onSelect={(sel: TierSelection) =>
            dispatch({
              type: "SELECT_TIER",
              tierId: sel.tierId,
              duration: sel.duration,
              price: sel.price,
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
          serviceId={selectedService.id}
          durationMinutes={
            selectedDuration ? parseInt(selectedDuration, 10) || undefined : undefined
          }
          selectedDate={selectedDate}
          selectedTime={selectedTime}
          onSelectDate={(d) => dispatch({ type: "SELECT_DATE", date: d })}
          onSelectTime={(t) => dispatch({ type: "SELECT_TIME", time: t })}
        />
      )}
      {currentStepId === "confirm" &&
        selectedService &&
        selectedDate &&
        selectedTime &&
        selectedTierId && (
          <ConfirmStep
            service={selectedService}
            duration={selectedDuration ?? ""}
            price={selectedTierPrice}
            date={selectedDate}
            time={selectedTime}
            details={details}
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const slug = get("service") ?? get("wellness") ?? get("medicine");
  const treatmentId = get("treatment");
  const preselectedLabel = treatmentId
    ? (manualTherapyTreatments.find((t) => t.id === treatmentId)?.title ?? null)
    : null;

  const [local, setLocal] = useState<BookingLocalState>(INITIAL_LOCAL_STATE);
  const [detailErrors, setDetailErrors] = useState<DetailsErrors>({});
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
    selectedTierPrice,
    selectedDuration,
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
      selectedTierPrice,
      selectedDuration,
      selectedDate: selectedDate?.toISOString() ?? null,
      selectedTime,
      details,
    });
  }, [
    step,
    selectedService,
    selectedTierId,
    selectedTierPrice,
    selectedDuration,
    selectedDate,
    selectedTime,
    details,
  ]);

  const activeSteps = buildSteps();
  const currentStepId = activeSteps[step]?.id ?? "service";
  const isLastStep = step === activeSteps.length - 1;
  const nextStepLabel = activeSteps[step + 1]?.label;

  const canProceed: Record<string, boolean> = {
    service: !!selectedService,
    duration: !!selectedTierId,
    details: bookingDetailsSchema.safeParse(details).success,
    datetime: !!(selectedDate && selectedTime),
    confirm: true,
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

      const { data: contactUuid } = await insforge.database.rpc(
        "upsert_contact",
        {
          p_email: details.email,
          p_first_name: details.firstName,
          p_last_name: details.lastName,
          p_phone: details.phone,
        },
      );

      if (contactUuid) {
        resolvedContactId = contactUuid as string;
        setContactId(contactUuid as string);
      }
    }

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
      setBookingId(newBookingId as string);
      await insforge.database
        .from("bookings")
        .update({
          ...(selectedTierId
            ? { tier_id: selectedTierId, price_eur: selectedTierPrice }
            : {}),
          location: "centro",
          ...(details.notes?.trim() ? { notes: details.notes.trim() } : {}),
          ...(user?.id
            ? { created_by_user_id: user.id, created_by_role: "client" }
            : { created_by_role: "anonymous" }),
        })
        .eq("id", newBookingId as string);
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
    if (!selectedService || !selectedDate || !selectedTime || !selectedTierId)
      return;
    dispatch({ type: "CONFIRM_START" });

    let resolvedBookingId = bookingId;
    if (resolvedBookingId) {
      await insforge.database
        .from("bookings")
        .update({ status: "pending" })
        .eq("id", resolvedBookingId);
    } else {
      const { data } = await insforge.database
        .from("bookings")
        .insert([
          {
            ...(user?.id ? { user_id: user.id } : {}),
            ...(contactId ? { contact_id: contactId } : {}),
            service_id: selectedService.id,
            service_title: selectedService.title,
            tier_id: selectedTierId,
            price_eur: selectedTierPrice,
            duration: selectedDuration ?? "",
            location: "centro",
            ...(details.notes?.trim() ? { notes: details.notes.trim() } : {}),
            date: selectedDate.toISOString().split("T")[0],
            time: selectedTime,
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
      await insforge.database
        .from("contacts")
        .update({ status: "client" })
        .eq("id", contactId)
        .neq("status", "client");
    }

    // Email notifications (non-blocking)
    try {
      await notifyBooking({
        bookingId: resolvedBookingId ?? "",
        event: "received",
        clientName: `${details.firstName} ${details.lastName}`.trim(),
        clientEmail: details.email,
        clientPhone: details.phone || null,
        service: selectedService.title,
        serviceId: selectedService.id,
        date: selectedDate.toISOString().split("T")[0],
        time: selectedTime,
        duration: selectedDuration,
      });
    } catch {
      // Email failed silently — booking is already saved
    }

    // Create Google Calendar event (non-blocking — booking succeeds even if calendar sync fails)
    try {
      await fetch("/api/google/calendar/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: selectedService.id,
          summary: `${selectedService.title} — ${details.firstName} ${details.lastName}`,
          description: `Booking #${resolvedBookingId ?? ""}\nPhone: ${details.phone}\nEmail: ${details.email}`,
          date: selectedDate.toISOString().split("T")[0],
          time: selectedTime,
          duration_minutes: selectedDuration
            ? parseInt(selectedDuration, 10)
            : 60,
        }),
      });
    } catch {
      // Calendar sync failed silently — booking is already saved
    }

    dispatch({ type: "CONFIRM_SUCCESS" });
    clearStorage();

    const params = new URLSearchParams({
      service: selectedService.title,
      date: selectedDate.toISOString(),
      time: selectedTime,
      phone: details.phone,
    });
    router.push(`/booking/confirmation?${params.toString()}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <BookingHeader />

      <StepIndicator current={step} steps={activeSteps} />

      <BookingStepRenderer
        currentStepId={currentStepId}
        selectedService={selectedService}
        selectedTierId={selectedTierId}
        selectedTierPrice={selectedTierPrice}
        selectedDuration={selectedDuration}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        details={details}
        detailErrors={detailErrors}
        dispatch={dispatch}
        onClearDetailError={(key) =>
          setDetailErrors((prev) => ({ ...prev, [key]: undefined }))
        }
        preselectedLabel={preselectedLabel}
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
