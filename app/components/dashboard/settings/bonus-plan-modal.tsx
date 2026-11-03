"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { OptionSelect } from "@/components/ui/option-select";
import { ToggleRow } from "@/components/dashboard/toggle-row";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { upsertBonusPlan } from "@/actions/bonuses";
import type { BonusPlan } from "@/types/bonus";

export type BonusTierOption = { id: string; label: string };

/**
 * One bonus plan, to create or change.
 *
 * Changing a plan does not touch bonuses already sold from it: each sold bonus
 * keeps the sessions and price it was bought at.
 */
export function BonusPlanModal({
  plan,
  tiers,
  onClose,
  onSaved,
}: {
  /** The plan being edited, or null for a new one. */
  plan: BonusPlan | null;
  tiers: BonusTierOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("dashboard.settings.bonuses");
  const tCommon = useTranslations("dashboard.common");
  const tBonuses = useTranslations("dashboard.bonuses");

  const [tierId, setTierId] = useState(plan?.tierId ?? tiers[0]?.id ?? "");
  const [sessions, setSessions] = useState(String(plan?.sessions ?? 5));
  const [price, setPrice] = useState(String(plan?.priceEur ?? ""));
  const [validity, setValidity] = useState(String(plan?.validityDays ?? 180));
  const [active, setActive] = useState(plan?.active ?? true);
  const [sellOnline, setSellOnline] = useState(plan?.sellOnline ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await upsertBonusPlan(getAccessToken(), {
      ...(plan ? { id: plan.id } : {}),
      tierId,
      sessions: Number(sessions),
      priceEur: Number(price.replace(",", ".")),
      validityDays: Number(validity),
      active,
      sellOnline,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error === "duplicate" ? t("duplicate") : t("error"));
      return;
    }
    onSaved();
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="border-sand-200 mx-4 w-full max-w-md rounded-2xl border bg-white shadow-xl">
        <div className="border-sand-100 flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-petroleum-700 font-semibold">
            {plan ? tBonuses("label", { sessions: plan.sessions }) : t("new")}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="bonus-tier"
              className="text-petroleum-500 text-xs font-medium"
            >
              {t("tier")}
            </label>
            <OptionSelect
              id="bonus-tier"
              value={tierId}
              options={tiers.map((o) => ({ value: o.id, label: o.label }))}
              onChange={setTierId}
              disabled={saving}
              ariaLabel={t("tier")}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              ["bonus-sessions", t("sessions"), sessions, setSessions],
              ["bonus-price", t("price"), price, setPrice],
              ["bonus-validity", t("validity"), validity, setValidity],
            ].map(([id, label, value, set]) => (
              <div key={id as string} className="flex flex-col gap-1.5">
                <label
                  htmlFor={id as string}
                  className="text-petroleum-500 text-xs font-medium"
                >
                  {label as string}
                </label>
                <input
                  id={id as string}
                  type="text"
                  inputMode="decimal"
                  value={value as string}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  disabled={saving}
                  className={INPUT_CLASS}
                />
              </div>
            ))}
          </div>

          <ToggleRow
            checked={active}
            onToggle={() => setActive((v) => !v)}
            label={t("active")}
            disabled={saving}
          />
          <ToggleRow
            checked={sellOnline}
            onToggle={() => setSellOnline((v) => !v)}
            label={t("sellOnline")}
            hint={t("sellOnlineHint")}
            disabled={saving}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-sand-100 flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={saving}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            variant="solid"
            size="md"
            onClick={() => void handleSave()}
            disabled={saving || !tierId}
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
