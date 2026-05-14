"use client";

import { useReducer, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@components/ui/button";
import { bookableServices, type BookableService } from "@/data/services-data";
import { buildSteps } from "@/utils/calendar-helpers";
import {
  readStorage,
  writeStorage,
  clearStorage,
} from "@/storage/booking-storage";
import type { DetailsState } from "@/types";
import { StepIndicator } from "./steps/step-indicator";
import { ServiceStep } from "./steps/service-step";
import { DurationStep } from "./steps/duration-step";
import { DetailsStep } from "./steps/details-step";
import { DateTimeStep } from "./steps/datetime-step";
import { ConfirmStep } from "./steps/confirm-step";
import { SuccessState } from "./steps/success-state";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";
import { sendEmail } from "@/emails/send";
import { bookingConfirmationEmail } from "@/emails/templates/booking-confirmation";

const EMPTY_DETAILS: DetailsState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consent: false,
};

type BookingState = {
  step: number;
  selectedService: BookableService | null;
  selectedDuration: string | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  details: DetailsState;
  submitted: boolean;
  loading: boolean;
};

type BookingAction =
  | { type: "SELECT_SERVICE"; service: BookableService | null }
  | { type: "SELECT_DURATION"; duration: string | null }
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
        selectedDuration:
          action.service?.durations.length === 1
            ? action.service.durations[0]
            : null,
      };
    case "SELECT_DURATION":
      return { ...state, selectedDuration: action.duration };
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
      return { ...state, loading: false, submitted: true };
  }
}

function initState(slug: string | null): BookingState {
  const saved = readStorage();
  if (slug) {
    const service = bookableServices.find((s) => s.id === slug) ?? null;
    return {
      step: 0,
      selectedService: service,
      selectedDuration:
        service?.durations.length === 1 ? service.durations[0] : null,
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
          {loading ? "Confirming…" : "Confirm booking"}
        </Button>
      )}
    </div>
  );
}

function BookingContentInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const slug = get("wellness") ?? get("medicine");

  const [contactId, setContactId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [memberBlocker, setMemberBlocker] = useState(false);
  const [checking, setChecking] = useState(false);

  const [state, dispatch] = useReducer(bookingReducer, slug, initState);
  const {
    step,
    selectedService,
    selectedDuration,
    selectedDate,
    selectedTime,
    details,
    submitted,
    loading,
  } = state;

  useEffect(() => {
    writeStorage({
      step,
      serviceId: selectedService?.id ?? null,
      selectedDuration,
      selectedDate: selectedDate?.toISOString() ?? null,
      selectedTime,
      details,
    });
  }, [
    step,
    selectedService,
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
    duration: !!selectedDuration,
    details: !!(
      details.firstName &&
      details.lastName &&
      details.email &&
      details.phone &&
      details.consent
    ),
    datetime: !!(selectedDate && selectedTime),
    confirm: true,
  };

  const handleNextFromDetails = async () => {
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
        setChecking(false);
        setMemberBlocker(true);
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

    if (newBookingId) setBookingId(newBookingId as string);

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
    if (!selectedService || !selectedDate || !selectedTime || !selectedDuration)
      return;
    dispatch({ type: "CONFIRM_START" });

    if (bookingId) {
      await insforge.database.rpc("confirm_booking", {
        p_booking_id: bookingId,
      });
    } else {
      await insforge.database.from("bookings").insert([
        {
          ...(user?.id ? { user_id: user.id } : {}),
          ...(contactId ? { contact_id: contactId } : {}),
          service_id: selectedService.id,
          service_title: selectedService.title,
          duration: selectedDuration,
          date: selectedDate.toISOString().split("T")[0],
          time: selectedTime,
          first_name: details.firstName,
          last_name: details.lastName,
          email: details.email,
          phone: details.phone,
        },
      ]);
    }

    dispatch({ type: "CONFIRM_SUCCESS" });
    clearStorage();

    await sendEmail({
      to: details.email,
      subject: "Your Essentia booking is confirmed",
      html: bookingConfirmationEmail({
        name: details.firstName,
        serviceName: selectedService.title,
        date: selectedDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        time: selectedTime,
        duration: selectedDuration,
      }),
    });
  };

  if (submitted && selectedService && selectedDate && selectedTime) {
    return (
      <SuccessState
        service={selectedService}
        date={selectedDate}
        time={selectedTime}
        email={details.email}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          Book a session.
        </h1>
        <p className="text-petroleum-400">
          Choose your service, pick a time, and we will take care of the rest.
        </p>
      </div>

      <StepIndicator current={step} steps={activeSteps} />

      <div className="h-full">
        {currentStepId === "service" && (
          <ServiceStep
            selected={selectedService}
            onSelect={(s) => dispatch({ type: "SELECT_SERVICE", service: s })}
          />
        )}
        {currentStepId === "duration" && selectedService && (
          <DurationStep
            service={selectedService}
            selectedDuration={selectedDuration}
            onSelect={(d) => dispatch({ type: "SELECT_DURATION", duration: d })}
          />
        )}
        {currentStepId === "details" && (
          <DetailsStep
            details={details}
            onChange={(d) => dispatch({ type: "SET_DETAILS", details: d })}
          />
        )}
        {currentStepId === "datetime" && selectedService && (
          <DateTimeStep
            service={selectedService}
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
          selectedDuration && (
            <ConfirmStep
              service={selectedService}
              duration={selectedDuration}
              date={selectedDate}
              time={selectedTime}
              details={details}
            />
          )}
      </div>

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

      {memberBlocker && (
        <MemberBlockerModal
          onContinue={() => {
            setMemberBlocker(false);
            dispatch({ type: "SET_STEP", step: step + 1 });
          }}
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
