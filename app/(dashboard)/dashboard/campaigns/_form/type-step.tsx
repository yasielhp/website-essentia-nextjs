"use client";

import { useRef, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import {
  IconCalendar,
  IconCheck,
  IconEdit,
  IconMail,
  IconSettings,
  IconWorld,
} from "@/components/ui/icons";
import { kindsForChannel } from "@/lib/campaigns/whatsapp-form";
import { radioTarget } from "@/lib/radio-nav";
import type { CampaignChannel, CampaignKind } from "@/types/campaign";
import { AVAILABLE_KINDS, type FormAction, type FormState } from "./form-state";

const CHANNELS: CampaignChannel[] = ["email", "whatsapp"];

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

  // A saved campaign keeps its channel: its recipients and report only mean
  // something in one.
  const channelLocked = state.id !== null;
  // Only the kinds this channel can be; the others are not shown at all.
  const visible = kindsForChannel(AVAILABLE_KINDS, state.channel);
  const shown = KINDS.filter(({ kind }) => visible.includes(kind));
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  /** Arrows move the choice and the focus together, as a radio group does. */
  function onChannelKey(e: React.KeyboardEvent, index: number) {
    const target = radioTarget(e.key, index, CHANNELS.length);
    if (target === null) return;
    e.preventDefault();
    dispatch({ type: "SET_CHANNEL", channel: CHANNELS[target] });
    radios.current[target]?.focus();
  }

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-3 text-sm font-semibold">
        {t("channel")}
      </h2>
      <div
        role="radiogroup"
        aria-label={t("channel")}
        aria-describedby="campaign-channel-note"
        className="bg-sand-100 mb-2 inline-flex rounded-full p-1"
      >
        {CHANNELS.map((channel, index) => {
          const active = state.channel === channel;
          return (
            <button
              key={channel}
              ref={(el) => {
                radios.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              // Only the chosen one is in the tab order; the arrows reach the rest.
              tabIndex={active ? 0 : -1}
              onKeyDown={(e) => onChannelKey(e, index)}
              disabled={channelLocked || state.submitting}
              onClick={() => dispatch({ type: "SET_CHANNEL", channel })}
              className={[
                "rounded-full px-5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed",
                active
                  ? "bg-petroleum-700 text-white"
                  : "text-petroleum-500 hover:text-petroleum-700",
                channelLocked && !active ? "opacity-50" : "",
              ].join(" ")}
            >
              {channel === "email" ? t("channelEmail") : t("channelWhatsApp")}
            </button>
          );
        })}
      </div>
      <p id="campaign-channel-note" className="text-petroleum-400 mb-6 text-xs">
        {channelLocked
          ? t("channelLocked")
          : state.channel === "whatsapp"
            ? t("channelHint")
            : ""}
      </p>

      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("title")}
      </h2>
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${
          // Four cards in three columns leave one alone on a second row.
          shown.length === 4 ? "" : "xl:grid-cols-3"
        }`}
      >
        {shown.map(({ kind, icon }) => {
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
                  {state.channel === "whatsapp" && kind === "standard"
                    ? t("standardDescWhatsApp")
                    : state.channel === "whatsapp" && kind === "autoresponder"
                      ? t("autoresponderDescWhatsApp")
                      : t(`${kind}Desc`)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
