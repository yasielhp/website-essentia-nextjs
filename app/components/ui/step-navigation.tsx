"use client";

import { Button } from "@components/ui/button";

export type StepNavigationLabels = {
  back: string;
  /** The text of the "next" button, already composed ("Next: Your details"). */
  next: string;
  /** Shown on "next" while the step is being checked. */
  checking: string;
  /** The final action: "Confirm", "Pay". */
  confirm: string;
  /** Shown on the final action while it is working. */
  confirming: string;
};

/**
 * The back / next / final-action row under a multi-step form.
 *
 * The booking form and the bonus purchase both walk through steps with the same
 * three buttons behaving the same way: "back" from the second step on, "next"
 * until the last step, and the final action there. The words are the callers',
 * so each flow keeps its own.
 */
export function StepNavigation({
  step,
  isLastStep,
  loading,
  checking,
  canProceed,
  onBack,
  onNext,
  onConfirm,
  labels,
}: {
  step: number;
  isLastStep: boolean;
  loading: boolean;
  checking: boolean;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  onConfirm: () => void;
  labels: StepNavigationLabels;
}) {
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
          {labels.back}
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
          {checking ? labels.checking : labels.next}
        </Button>
      ) : (
        <Button
          variant="solid"
          size="md"
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          {loading ? labels.confirming : labels.confirm}
        </Button>
      )}
    </div>
  );
}
