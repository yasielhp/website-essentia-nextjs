"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { radioTarget } from "@/lib/radio-nav";
import type { CampaignChannel } from "@/types/campaign";

const CHOICES: (CampaignChannel | "")[] = ["", "email", "whatsapp"];

/**
 * Narrows the campaign list to one channel. A radio group, so the arrows move
 * the choice and only the chosen one is in the tab order.
 */
export function ChannelFilter({
  value,
  onChange,
}: {
  value: CampaignChannel | "";
  onChange: (value: CampaignChannel | "") => void;
}) {
  const t = useTranslations("dashboard.campaigns.channel");
  const radios = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className="bg-sand-100 inline-flex rounded-full p-1"
    >
      {CHOICES.map((choice, index) => {
        const active = value === choice;
        return (
          <button
            key={choice || "all"}
            ref={(el) => {
              radios.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(choice)}
            onKeyDown={(e) => {
              const target = radioTarget(e.key, index, CHOICES.length);
              if (target === null) return;
              e.preventDefault();
              onChange(CHOICES[target]);
              radios.current[target]?.focus();
            }}
            className={[
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-petroleum-700 text-white"
                : "text-petroleum-500 hover:text-petroleum-700",
            ].join(" ")}
          >
            {choice === "" ? t("all") : t(choice)}
          </button>
        );
      })}
    </div>
  );
}
