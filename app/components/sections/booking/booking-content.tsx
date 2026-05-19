"use client";

import { useReducer, useEffect, useState, Suspense, useCallback } from "react";
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
import { LocationStep, type BookingLocation } from "./steps/location-step";
import { DurationStep, type TierSelection } from "./steps/duration-step";
import { DetailsStep } from "./steps/details-step";
import { DateTimeStep } from "./steps/datetime-step";
import { ConfirmStep } from "./steps/confirm-step";
import { SuccessState } from "./steps/success-state";
import { PaymentOverlay, type RedsysFormData } from "./steps/payment-overlay";
import { useAuth } from "@/components/auth-provider";
import { insforge } from "@/lib/insforge";

const EMPTY_DETAILS: DetailsState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  consent: false,
};

export type LocationAddress = {
  street: string;
  apartment: string;
  city: string;
  postalCode: string;
};

const EMPTY_ADDRESS: LocationAddress = {
  street: "",
  apartment: "",
  city: "",
  postalCode: "",
};

type BookingState = {
  step: number;
  selectedService: BookableService | null;
  selectedLocation: string | null;
  locationAddress: LocationAddress;
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
  | { type: "SELECT_LOCATION"; location: string }
  | { type: "SET_LOCATION_ADDRESS"; address: LocationAddress }
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
        selectedLocation: null,
        selectedTierId: null,
        selectedTierPrice: null,
        selectedDuration: null,
      };
    case "SELECT_LOCATION":
      return {
        ...state,
        selectedLocation: action.location,
        locationAddress: EMPTY_ADDRESS,
      };
    case "SET_LOCATION_ADDRESS":
      return { ...state, locationAddress: action.address };
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

function initState(slug: string | null): BookingState {
  const saved = readStorage();
  if (slug) {
    const service = bookableServices.find((s) => s.id === slug) ?? null;
    return {
      step: 0,
      selectedService: service,
      selectedLocation: null,
      locationAddress: EMPTY_ADDRESS,
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
    selectedLocation: saved.selectedLocation ?? null,
    locationAddress: saved.locationAddress ?? EMPTY_ADDRESS,
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
          {loading ? "Confirming…" : "Confirm booking"}
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
  selectedLocation: string | null;
  locationAddress: LocationAddress;
  selectedTierId: string | null;
  selectedTierPrice: number | null;
  selectedDuration: string | null;
  selectedDate: Date | null;
  selectedTime: string | null;
  details: DetailsState;
  dispatch: React.Dispatch<BookingAction>;
};

function BookingStepRenderer({
  currentStepId,
  selectedService,
  selectedLocation,
  locationAddress,
  selectedTierId,
  selectedTierPrice,
  selectedDuration,
  selectedDate,
  selectedTime,
  details,
  dispatch,
}: BookingStepRendererProps) {
  return (
    <div key={currentStepId} className="animate-fade-in-up h-full">
      {currentStepId === "service" && (
        <ServiceStep
          selected={selectedService}
          onSelect={(s) => dispatch({ type: "SELECT_SERVICE", service: s })}
        />
      )}
      {currentStepId === "location" && (
        <LocationStep
          selected={selectedLocation}
          address={locationAddress}
          onSelect={(loc) =>
            dispatch({ type: "SELECT_LOCATION", location: loc })
          }
          onAddressChange={(addr) =>
            dispatch({ type: "SET_LOCATION_ADDRESS", address: addr })
          }
        />
      )}
      {currentStepId === "duration" && selectedService && (
        <DurationStep
          serviceId={selectedService.id}
          selectedTierId={selectedTierId}
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
  paymentError: string | null;
  memberBlocker: boolean;
  redsysForm: RedsysFormData | null;
  onContinueAsGuest: () => void;
  onClosePayment: () => void;
};

function BookingModals({
  paymentError,
  memberBlocker,
  redsysForm,
  onContinueAsGuest,
  onClosePayment,
}: BookingModalsProps) {
  return (
    <>
      {paymentError && (
        <div className="mx-auto mt-3 max-w-md rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {paymentError}
        </div>
      )}

      {memberBlocker && <MemberBlockerModal onContinue={onContinueAsGuest} />}

      {redsysForm && (
        <PaymentOverlay formData={redsysForm} onClose={onClosePayment} />
      )}
    </>
  );
}

type PaidBooking = {
  service_title: string | null;
  date: string | null;
  time: string | null;
  email: string | null;
};

type BookingLocalState = {
  contactId: string | null;
  bookingId: string | null;
  memberBlocker: boolean;
  checking: boolean;
  redsysForm: RedsysFormData | null;
  paymentError: string | null;
  paymentSuccess: boolean;
  paidBooking: PaidBooking | null;
};

const INITIAL_LOCAL_STATE: BookingLocalState = {
  contactId: null,
  bookingId: null,
  memberBlocker: false,
  checking: false,
  redsysForm: null,
  paymentError: null,
  paymentSuccess: false,
  paidBooking: null,
};

function BookingContentInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const get = searchParams.get.bind(searchParams);
  const slug = get("wellness") ?? get("medicine");

  const [local, setLocal] = useState<BookingLocalState>(INITIAL_LOCAL_STATE);
  const {
    contactId,
    bookingId,
    memberBlocker,
    checking,
    redsysForm,
    paymentError,
    paymentSuccess,
    paidBooking,
  } = local;

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
  const setRedsysForm = useCallback(
    (v: RedsysFormData | null) => updateLocal({ redsysForm: v }),
    [updateLocal],
  );
  const setPaymentError = useCallback(
    (v: string | null) => updateLocal({ paymentError: v }),
    [updateLocal],
  );
  const setPaymentSuccess = useCallback(
    (v: boolean) => updateLocal({ paymentSuccess: v }),
    [updateLocal],
  );
  const setPaidBooking = useCallback(
    (v: PaidBooking | null) => updateLocal({ paidBooking: v }),
    [updateLocal],
  );

  const [state, dispatch] = useReducer(bookingReducer, slug, initState);
  const {
    step,
    selectedService,
    selectedLocation,
    locationAddress,
    selectedTierId,
    selectedTierPrice,
    selectedDuration,
    selectedDate,
    selectedTime,
    details,
    loading,
  } = state;

  // Detect return from payment gateway
  useEffect(() => {
    if (get("payment") !== "success") return;
    clearStorage();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPaymentSuccess(true);
    const bid = get("bookingId");
    if (!bid) return;
    void insforge.database
      .from("bookings")
      .select("service_title, date, time, email")
      .eq("id", bid)
      .single()
      .then(({ data }) => {
        if (data) setPaidBooking(data as PaidBooking);
      });
  }, [get, setPaymentSuccess, setPaidBooking]);

  useEffect(() => {
    writeStorage({
      step,
      serviceId: selectedService?.id ?? null,
      selectedLocation,
      locationAddress,
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
    selectedLocation,
    locationAddress,
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
    location:
      !!selectedLocation &&
      (selectedLocation !== "domicilio" ||
        (locationAddress.street.trim().length > 0 &&
          locationAddress.city.trim().length > 0 &&
          locationAddress.postalCode.trim().length > 0)),
    duration: !!selectedTierId,
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
          location: selectedLocation ?? null,
          location_address:
            selectedLocation === "domicilio"
              ? [
                  locationAddress.street,
                  locationAddress.apartment,
                  locationAddress.city,
                  locationAddress.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")
              : null,
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

    // Ensure booking exists with pending payment status
    let resolvedBookingId = bookingId;
    if (resolvedBookingId) {
      await insforge.database
        .from("bookings")
        .update({ payment_status: "pending" })
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
            location: selectedLocation ?? null,
            location_address:
              selectedLocation === "domicilio"
                ? [
                    locationAddress.street,
                    locationAddress.apartment,
                    locationAddress.city,
                    locationAddress.postalCode,
                  ]
                    .filter(Boolean)
                    .join(", ")
                : null,
            date: selectedDate.toISOString().split("T")[0],
            time: selectedTime,
            first_name: details.firstName,
            last_name: details.lastName,
            email: details.email,
            phone: details.phone,
            payment_status: "pending",
          },
        ])
        .select("id")
        .single();
      resolvedBookingId = (data as { id: string } | null)?.id ?? null;
    }

    if (!resolvedBookingId) {
      dispatch({ type: "CONFIRM_SUCCESS" });
      clearStorage();
      return;
    }

    // Create embedded Stripe checkout session
    const res = await fetch("/api/checkout/booking-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: resolvedBookingId,
        tierId: selectedTierId,
        email: details.email,
        name: `${details.firstName} ${details.lastName}`.trim(),
        description: `${selectedService.title} — ${selectedDuration ?? ""}`,
      }),
    });

    dispatch({ type: "CONFIRM_SUCCESS" }); // stop loading spinner

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      const msg = body.error ?? "Failed to start payment. Please try again.";
      console.error("[booking] Failed to create checkout session:", msg);
      setPaymentError(msg);
      return;
    }

    setPaymentError(null);
    const form = (await res.json()) as RedsysFormData;
    setRedsysForm(form);
  };

  // Return from Stripe embedded checkout
  if (paymentSuccess) {
    const successService = {
      id: "",
      category: "wellness" as const,
      description: "",
      durations: [],
      price: "",
      image: "",
      title: paidBooking?.service_title ?? selectedService?.title ?? "Session",
    };
    const successDate = paidBooking?.date
      ? new Date(paidBooking.date)
      : (selectedDate ?? new Date());
    const successTime = paidBooking?.time ?? selectedTime ?? "";
    const successEmail =
      paidBooking?.email ?? details.email ?? get("email") ?? "";

    return (
      <SuccessState
        service={successService}
        date={successDate}
        time={successTime}
        email={successEmail}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingHeader />

      <StepIndicator current={step} steps={activeSteps} />

      <BookingStepRenderer
        currentStepId={currentStepId}
        selectedService={selectedService}
        selectedLocation={selectedLocation}
        locationAddress={locationAddress}
        selectedTierId={selectedTierId}
        selectedTierPrice={selectedTierPrice}
        selectedDuration={selectedDuration}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        details={details}
        dispatch={dispatch}
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
        paymentError={paymentError}
        memberBlocker={memberBlocker}
        redsysForm={redsysForm}
        onContinueAsGuest={() => {
          setMemberBlocker(false);
          dispatch({ type: "SET_STEP", step: step + 1 });
        }}
        onClosePayment={() => setRedsysForm(null)}
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
