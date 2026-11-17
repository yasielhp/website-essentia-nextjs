"use client";

import { useRef, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import {
  APPOINTMENT_HOURS,
  appointmentGrace,
  appointmentHoursIssue,
  appointmentSentence,
  isAppointmentEvent,
  withAppointmentEvent,
  type AppointmentEvent,
} from "@/lib/campaigns/appointment-form";
import { radioTarget } from "@/lib/radio-nav";
import type { FormAction, FormState } from "./form-state";

const SIDES: AppointmentEvent[] = ["before_visit", "after_visit"];

/**
 * When an appointment notice goes out: before or after each appointment, and
 * how many hours. The hours have shortcuts for the usual ones and a free field
 * inside the limits the server holds; a sentence below says what the choice
 * means, so nobody has to work out "48 before" in their head, and the rules
 * (once per appointment, never for the past) are stated where they are chosen.
 */
export function AppointmentWhen({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.trigger.appointment");
  const tTrigger = useTranslations("dashboard.campaigns.trigger");
  const tValidation = useTranslations("dashboard.validation");
  const { trigger, submitting, fieldErrors } = state;
  const event: AppointmentEvent = isAppointmentEvent(trigger.event)
    ? trigger.event
    : "before_visit";
  const limits = APPOINTMENT_HOURS[event];
  const grace = appointmentGrace();
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  const localIssue = appointmentHoursIssue(event, trigger.hours);
  const serverError = fieldErrors["trigger.hours"];
  const sentence = appointmentSentence(trigger);
  const hasError = localIssue !== null || Boolean(serverError);

  const setHours = (hours: number | undefined) =>
    dispatch({ type: "SET_TRIGGER", trigger: { ...trigger, event, hours } });

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {tTrigger("title")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{tTrigger("hint")}</p>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <span
            id="appointment-side-label"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("side")}
          </span>
          <div
            role="radiogroup"
            aria-labelledby="appointment-side-label"
            className="bg-sand-100 inline-flex w-fit rounded-full p-1"
          >
            {SIDES.map((side, index) => {
              const active = event === side;
              return (
                <button
                  key={side}
                  ref={(el) => {
                    radios.current[index] = el;
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  tabIndex={active ? 0 : -1}
                  disabled={submitting}
                  onClick={() =>
                    dispatch({
                      type: "SET_TRIGGER",
                      trigger: withAppointmentEvent(trigger, side),
                    })
                  }
                  onKeyDown={(e) => {
                    const target = radioTarget(e.key, index, SIDES.length);
                    if (target === null) return;
                    e.preventDefault();
                    dispatch({
                      type: "SET_TRIGGER",
                      trigger: withAppointmentEvent(trigger, SIDES[target]),
                    });
                    radios.current[target]?.focus();
                  }}
                  className={[
                    "rounded-full px-5 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-petroleum-700 text-white"
                      : "text-petroleum-500 hover:text-petroleum-700",
                  ].join(" ")}
                >
                  {t(side === "before_visit" ? "before" : "after")}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="campaign-appointment-hours"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t(event === "before_visit" ? "hoursBefore" : "hoursAfter")}
          </label>
          <div
            role="group"
            aria-label={t("shortcuts")}
            className="flex flex-wrap gap-2"
          >
            {limits.shortcuts.map((hours) => (
              <button
                key={hours}
                type="button"
                aria-pressed={trigger.hours === hours}
                disabled={submitting}
                onClick={() => setHours(hours)}
                className={[
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  trigger.hours === hours
                    ? "border-petroleum-700 bg-petroleum-700 text-white"
                    : "border-sand-200 text-petroleum-700 hover:border-petroleum-400 bg-white",
                ].join(" ")}
              >
                {hours} {t("unit")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              id="campaign-appointment-hours"
              type="number"
              inputMode="numeric"
              min={limits.min}
              max={limits.max}
              step={1}
              value={trigger.hours ?? ""}
              disabled={submitting}
              aria-invalid={hasError ? true : undefined}
              aria-describedby={[
                hasError ? "campaign-appointment-hours-error" : null,
                "campaign-appointment-sentence",
              ]
                .filter(Boolean)
                .join(" ")}
              onChange={(e) =>
                setHours(
                  e.target.value === "" ? undefined : Number(e.target.value),
                )
              }
              className={`${INPUT_CLASS} max-w-28`}
            />
            <span className="text-petroleum-400 text-sm">{t("unit")}</span>
          </div>
          {hasError && (
            <p
              id="campaign-appointment-hours-error"
              role="alert"
              className="text-xs text-red-600"
            >
              {localIssue !== null
                ? t("sentenceInvalid", { min: limits.min, max: limits.max })
                : tValidation.has(serverError)
                  ? tValidation(serverError)
                  : // A key this screen does not know is never shown raw.
                    tValidation("invalidInput")}
            </p>
          )}
        </div>

        <div className="bg-sand-50 flex flex-col gap-2 rounded-xl px-4 py-3">
          <p
            id="campaign-appointment-sentence"
            aria-live="polite"
            className="text-petroleum-700 text-sm font-medium"
          >
            {sentence ? t(sentence.key, { hours: sentence.hours }) : "—"}
          </p>
          <p className="text-petroleum-500 text-xs">{t("rules")}</p>
          <p className="text-petroleum-500 text-xs">{t("delay")}</p>
          <p className="text-petroleum-500 text-xs">{t("grace", grace)}</p>
        </div>

        <div className="flex justify-end">
          <Button
            size="md"
            disabled={submitting || localIssue !== null}
            onClick={onDone}
          >
            {tTrigger("confirm")}
          </Button>
        </div>
      </div>
    </section>
  );
}
