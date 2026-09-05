"use client";

import type { Dispatch } from "react";
import { useTranslations } from "next-intl";
import {
  IconCalendar,
  IconCheck,
  IconEdit,
  IconMail,
  IconSettings,
  IconWorld,
} from "@/components/ui/icons";
import {
  AVAILABLE_KINDS,
  type CampaignKind,
  type FormAction,
  type FormState,
} from "./form-state";

const KINDS: { kind: CampaignKind; icon: React.ReactNode }[] = [
  { kind: "standard", icon: <IconMail /> },
  { kind: "automated", icon: <IconSettings /> },
  { kind: "autoresponder", icon: <IconCheck /> },
  { kind: "split", icon: <IconEdit /> },
  { kind: "rss", icon: <IconWorld /> },
  { kind: "dateBased", icon: <IconCalendar /> },
];

/**
 * The first card: what kind of send this is. Choosing is advancing, as
 * picking a service is in the booking form.
 *
 * Only the standard campaign exists today. The other kinds are shown greyed
 * out rather than hidden so the admin knows they are coming and does not go
 * looking for them somewhere else.
 */
export function TypeStep({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.type");

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("title")}
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {KINDS.map(({ kind, icon }) => {
          const available = AVAILABLE_KINDS.includes(kind);
          const active = state.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              disabled={!available || state.submitting}
              aria-pressed={active}
              onClick={() => {
                dispatch({ type: "SET_KIND", kind });
                onDone();
              }}
              className={[
                "flex items-start gap-4 rounded-2xl border p-5 text-left transition-colors",
                active
                  ? "border-petroleum-700 bg-petroleum-50/50"
                  : "border-sand-200 bg-white",
                available
                  ? "hover:border-petroleum-400 cursor-pointer"
                  : "cursor-not-allowed opacity-55",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-12 shrink-0 items-center justify-center rounded-xl [&_svg]:size-6",
                  active
                    ? "bg-petroleum-700 text-white"
                    : "bg-sand-100 text-petroleum-500",
                ].join(" ")}
              >
                {icon}
              </span>
              <span className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-petroleum-700 text-sm font-semibold">
                    {t(kind)}
                  </span>
                  {!available && (
                    <span className="bg-sand-100 text-petroleum-400 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                      {t("comingSoon")}
                    </span>
                  )}
                </span>
                <span className="text-petroleum-400 text-xs leading-relaxed">
                  {t(`${kind}Desc`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
