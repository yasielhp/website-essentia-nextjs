"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import type { TriggerEvent } from "@/types/campaign";
import type { FormAction, FormState } from "./form-state";

/** The kinds whose trigger the admin chooses; the others have one event only. */
const CHOICES: Partial<Record<FormState["kind"], TriggerEvent[]>> = {
  automated: ["segment_entry", "after_booking"],
  dateBased: ["birthday", "first_booking_anniversary"],
};

export function hasTriggerStep(kind: FormState["kind"]): boolean {
  return kind in CHOICES;
}

/**
 * When an automated campaign fires. Only shown for the kinds that offer a
 * choice; an autoresponder or a blog announcement has exactly one event and
 * the review step just says so.
 */
export function TriggerStep({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.trigger");
  const fieldError = useTranslations("dashboard.validation");
  const { kind, trigger, submitting, fieldErrors } = state;
  const events = CHOICES[kind] ?? [];
  const options: SelectOption<TriggerEvent>[] = events.map((event) => ({
    value: event,
    label: t(`event.${event}`),
    desc: t(`eventDesc.${event}`),
  }));
  const daysError = fieldErrors["trigger.days"];

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="text-petroleum-400 mb-4 text-xs">{t("hint")}</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="campaign-trigger-event"
            className="text-petroleum-500 text-xs font-medium"
          >
            {t("when")}
          </label>
          <OptionSelect
            id="campaign-trigger-event"
            value={trigger.event ?? events[0]!}
            options={options}
            disabled={submitting}
            onChange={(event) =>
              dispatch({
                type: "SET_TRIGGER",
                trigger: {
                  event,
                  ...(event === "after_booking"
                    ? { days: trigger.days ?? 3 }
                    : {}),
                },
              })
            }
          />
        </div>

        {trigger.event === "after_booking" && (
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="campaign-trigger-days"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("days")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="campaign-trigger-days"
                type="number"
                min={0}
                max={365}
                value={trigger.days ?? ""}
                disabled={submitting}
                onChange={(e) => {
                  const days = Number(e.target.value);
                  dispatch({
                    type: "SET_TRIGGER",
                    trigger: {
                      ...trigger,
                      days: Number.isFinite(days) ? days : 0,
                    },
                  });
                }}
                className={`${INPUT_CLASS} w-28`}
              />
              <span className="text-petroleum-400 text-sm">
                {t("daysAfter")}
              </span>
            </div>
            {daysError && (
              <p className="text-xs text-red-500">
                {fieldError.has(daysError) ? fieldError(daysError) : daysError}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button size="md" disabled={submitting} onClick={onDone}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </section>
  );
}
