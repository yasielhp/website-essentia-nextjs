"use client";

import { useState, useEffect } from "react";
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

export function BookingContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("wellness") ?? searchParams.get("medicine");

  const [step, setStep] = useState<number>(() => {
    if (slug) return 0;
    return readStorage().step ?? 0;
  });

  const [selectedService, setSelectedService] = useState<BookableService | null>(() => {
    const id = slug ?? readStorage().serviceId ?? null;
    return id ? (bookableServices.find((s) => s.id === id) ?? null) : null;
  });

  const [selectedDuration, setSelectedDuration] = useState<string | null>(() => {
    if (slug) {
      const service = bookableServices.find((s) => s.id === slug);
      return service?.durations.length === 1 ? service.durations[0] : null;
    }
    return readStorage().selectedDuration ?? null;
  });

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (slug) return null;
    const d = readStorage().selectedDate;
    return d ? new Date(d) : null;
  });

  const [selectedTime, setSelectedTime] = useState<string | null>(() => {
    if (slug) return null;
    return readStorage().selectedTime ?? null;
  });

  const [details, setDetails] = useState<DetailsState>(() => readStorage().details ?? EMPTY_DETAILS);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const handleSelectService = (s: BookableService | null) => {
    setSelectedService(s);
    setSelectedDuration(s && s.durations.length === 1 ? s.durations[0] : null);
  };

  const activeSteps = buildSteps();
  const currentStepId = activeSteps[step]?.id ?? "service";
  const isLastStep = step === activeSteps.length - 1;

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
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
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
            onSelect={handleSelectService}
          />
        )}
        {currentStepId === "duration" && selectedService && (
          <DurationStep
            service={selectedService}
            selectedDuration={selectedDuration}
            onSelect={setSelectedDuration}
          />
        )}
        {currentStepId === "details" && (
          <DetailsStep details={details} onChange={setDetails} />
        )}
        {currentStepId === "datetime" && selectedService && (
          <DateTimeStep
            service={selectedService}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelectDate={setSelectedDate}
            onSelectTime={setSelectedTime}
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
            onClick={() => setStep((s) => s - 1)}
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
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed[currentStepId]}
            className="flex-1 sm:flex-none"
          >
            Continue
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
