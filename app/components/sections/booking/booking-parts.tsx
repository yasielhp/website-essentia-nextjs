"use client";

import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import { ServiceStep } from "./steps/service-step";
import { DurationStep, type TierSelection } from "./steps/duration-step";
import { DetailsStep, type DetailsErrors } from "./steps/details-step";
import { DateTimeStep } from "./steps/datetime-step";
import { ConfirmStep, type PaymentMethod } from "./steps/confirm-step";
import type { BookableService } from "@/data/services-data";
import type { DetailsState } from "@/types";
import type { BookingAction } from "./booking-state";

/**
 * The pieces of the booking form that are not the booking form: the warning a
 * member sees before booking as a guest, the back-and-next buttons, whichever
 * step is on show, and the overlays that cover all of it.
 */
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

export type BookingNavigationProps = {
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

export function BookingNavigation({
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

export type BookingStepRendererProps = {
  currentStepId: string;
  selectedService: BookableService | null;
  selectedTierId: string | null;
  selectedTierLabel: string | null;
  selectedTierPrice: number | null;
  selectedTierPriceOnline: number | null;
  selectedDuration: string | null;
  staffId: string | null;
  staffName: string | null;
  onStaffLoaded: (hasStaff: boolean) => void;
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

export function BookingStepRenderer({
  currentStepId,
  selectedService,
  selectedTierId,
  selectedTierLabel,
  selectedTierPrice,
  selectedTierPriceOnline,
  selectedDuration,
  staffId,
  staffName,
  onStaffLoaded,
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
          onStaffLoaded={onStaffLoaded}
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

export type BookingModalsProps = {
  memberBlocker: boolean;
  onContinueAsGuest: () => void;
};

export function BookingModals({
  memberBlocker,
  onContinueAsGuest,
}: BookingModalsProps) {
  return memberBlocker ? (
    <MemberBlockerModal onContinue={onContinueAsGuest} />
  ) : null;
}
