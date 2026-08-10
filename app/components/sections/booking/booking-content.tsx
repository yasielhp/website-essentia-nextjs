"use client";

import { useReducer, useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  updateDraftBookingMeta,
  updateDraftBookingDetails,
  confirmDraftBooking,
} from "@/actions/booking-draft";
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
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { notifyBooking } from "@/actions/booking-notifications";
import { localDateStr } from "@/utils/format";
import {
  BookingModals,
  BookingNavigation,
  BookingStepRenderer,
} from "./booking-parts";
import { bookingReducer, initState } from "./booking-state";

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
    // Which person is optional — the centre can allocate one — but somebody
    // has to be able to perform the treatment.
    duration: !!selectedTierId && tierHasStaff,
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
        p_date: localDateStr(selectedDate),
        p_time: selectedTime,
      });
    }
    dispatch({ type: "SET_STEP", step: step + 1 });
  };

  const handleConfirm = async () => {
    if (!selectedService || !selectedTierId) return;
    dispatch({ type: "CONFIRM_START" });

    const dateStr = selectedDate ? localDateStr(selectedDate) : null;
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
