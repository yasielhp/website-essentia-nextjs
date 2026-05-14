"use client";

import { useReducer, useEffect, Suspense } from "react";
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

function BookingContentInner() {
  const { get } = useSearchParams();
  const slug = get("wellness") ?? get("medicine");

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

  const handleConfirm = () => {
    dispatch({ type: "CONFIRM_START" });
    setTimeout(() => {
      dispatch({ type: "CONFIRM_SUCCESS" });
      clearStorage();
    }, 1200);
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

      <div className="flex w-full items-center justify-center gap-3">
        {step > 0 && (
          <Button
            variant="outline"
            size="md"
            onClick={() => dispatch({ type: "SET_STEP", step: step - 1 })}
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
            onClick={() => dispatch({ type: "SET_STEP", step: step + 1 })}
            disabled={!canProceed[currentStepId]}
            className="flex-1 sm:flex-none"
          >
            {nextStepLabel ? `Next: ${nextStepLabel}` : "Next step"}
          </Button>
        ) : (
          <Button
            variant="solid"
            size="md"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 sm:flex-none"
          >
            {loading ? "Confirming…" : "Confirm booking"}
          </Button>
        )}
      </div>
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
