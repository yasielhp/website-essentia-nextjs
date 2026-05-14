import { Fragment } from "react";
import { Check } from "lucide-react";
import type { Step } from "@/types";

export function StepIndicator({
  current,
  steps,
}: {
  current: number;
  steps: Step[];
}) {
  return (
    <div className="flex w-full items-start">
      {steps.map((step, i) => (
        <Fragment key={step.id}>
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={[
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                i < current
                  ? "bg-petroleum-400 text-sand-50"
                  : i === current
                    ? "border-petroleum-400 text-petroleum-400 border-2"
                    : "border-sand-500 text-sand-600 border-2",
              ].join(" ")}
            >
              {i < current ? <Check size={10} /> : i + 1}
            </div>
            <span
              className={[
                "hidden max-w-20 text-center text-xs leading-tight transition-colors sm:block",
                i <= current ? "text-petroleum-400" : "text-sand-700",
              ].join(" ")}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={[
                "mt-3 h-0.5 min-w-3 flex-1 transition-colors",
                i < current ? "bg-petroleum-400" : "bg-sand-200",
              ].join(" ")}
            />
          )}
        </Fragment>
      ))}
    </div>
  );
}
