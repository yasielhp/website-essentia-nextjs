"use client";

import { useRef, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import {
  IconCalendar,
  IconBell,
  IconCheck,
  IconEdit,
  IconMail,
  IconSettings,
  IconWorld,
} from "@/components/ui/icons";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { kindChoices } from "@/lib/campaigns/kind-choices";
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
  { kind: "appointment", icon: <IconBell /> },
];

/**
 * The first card: the channel, and what kind of send this is, as a select with
 * each kind's picture, name and description. Choosing a kind is advancing, as
 * picking a service is in the booking form; the arrow keys only walk the list
 * (they do not choose), so passing over a kind does not change the campaign.
 *
 * The kinds this channel cannot be are not in the list at all. One that does
 * not exist yet is shown greyed, as coming soon, and so is one a saved
 * campaign cannot become.
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
  const choices = kindChoices({
    order: KINDS.map(({ kind }) => kind),
    implemented: AVAILABLE_KINDS,
    channel: state.channel,
    saved: state.id !== null,
    savedKind: state.savedKind,
  });
  const anyKindLocked = choices.some((c) => c.implemented && !c.available);
  const options: SelectOption<CampaignKind>[] = choices.map((choice) => {
    const kind = choice.kind;
    return {
      value: kind,
      label: t(kind),
      desc:
        state.channel === "whatsapp" && kind === "standard"
          ? t("standardDescWhatsApp")
          : state.channel === "whatsapp" && kind === "autoresponder"
            ? t("autoresponderDescWhatsApp")
            : t(`${kind}Desc`),
      icon: KINDS.find((k) => k.kind === kind)?.icon,
      badge: choice.implemented ? undefined : t("comingSoon"),
      disabled: !choice.available,
    };
  });
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
        {channelLocked ? t("channelLocked") : ""}
      </p>

      <h2
        id="campaign-kind-label"
        className="text-petroleum-500 mb-3 text-sm font-semibold"
      >
        {t("title")}
      </h2>
      {anyKindLocked && (
        <p className="text-petroleum-400 mb-3 text-xs">{t("kindLocked")}</p>
      )}
      <OptionSelect
        id="campaign-kind"
        ariaLabel={t("title")}
        value={state.kind}
        options={options}
        disabled={state.submitting}
        // Only an activated option chooses: the arrows walk the list.
        commitOnArrows={false}
        onChange={(kind) => {
          dispatch({ type: "SET_KIND", kind });
          onDone();
        }}
      />
      {/* Who each channel writes to, under the types it applies to. */}
      <p className="text-petroleum-400 mt-4 text-xs">
        {state.channel === "whatsapp"
          ? t("consentNoteWhatsApp")
          : t("consentNoteEmail")}
      </p>
    </section>
  );
}
