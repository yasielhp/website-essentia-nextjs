"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";
import { OptionSelect } from "@/components/ui/option-select";
import { INPUT_CLASS } from "@/constants/form-styles";
import { getAccessToken } from "@/lib/client-session";
import { fetchBonusPlans, grantContactBonus } from "@/actions/bonuses";
import { formatPrice } from "@/utils/format";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import type { BonusPaidMethod, BonusPlan } from "@/types/bonus";

const METHODS: Exclude<BonusPaidMethod, "online">[] = [
  "cash",
  "card",
  "transfer",
  "other",
];

/** Sells one of the active bonus plans to this contact. */
export function GrantBonusDialog({
  contactId,
  onClose,
  onGranted,
}: {
  contactId: string;
  onClose: () => void;
  onGranted: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.bonuses.dialog");
  const tMethods = useTranslations(
    "dashboard.bookings.detail.payment.dialog.methods",
  );
  const tCommon = useTranslations("dashboard.common");
  const locale = useDashboardLocale();

  const [plans, setPlans] = useState<BonusPlan[] | null>(null);
  const [planId, setPlanId] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchBonusPlans(getAccessToken()).then((all) => {
      if (cancelled) return;
      const active = all.filter((p) => p.active);
      setPlans(active);
      setPlanId(active[0]?.id ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleConfirm() {
    if (!planId) return;
    setSaving(true);
    setError(null);
    const result = await grantContactBonus(getAccessToken(), {
      contactId,
      planId,
      paidMethod: method,
      notes,
    });
    setSaving(false);
    if (result.error) {
      setError(t("error"));
      return;
    }
    onGranted();
  }

  return (
    <div
      ref={overlayRef}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("title")}
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

        {plans && plans.length === 0 ? (
          <p className="text-petroleum-400 text-sm">{t("noPlans")}</p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="grant-plan"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("plan")}
              </label>
              <OptionSelect
                id="grant-plan"
                value={planId}
                options={(plans ?? []).map((p) => ({
                  value: p.id,
                  label: p.name,
                  desc: `${p.tierLabel ?? "—"} · ${formatPrice(p.priceEur, locale)}`,
                }))}
                onChange={setPlanId}
                disabled={saving || plans === null}
                ariaLabel={t("plan")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="grant-method"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("method")}
              </label>
              <OptionSelect
                id="grant-method"
                value={method}
                options={METHODS.map((m) => ({ value: m, label: tMethods(m) }))}
                onChange={setMethod}
                disabled={saving}
                ariaLabel={t("method")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="grant-notes"
                className="text-petroleum-500 text-xs font-medium"
              >
                {t("notes")}
              </label>
              <textarea
                id="grant-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                disabled={saving}
                className={INPUT_CLASS + " resize-none"}
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-col gap-2">
          <Button
            variant="solid"
            size="md"
            onClick={() => void handleConfirm()}
            disabled={saving || !planId}
            className="w-full"
          >
            {t("confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={saving}
            className="w-full"
          >
            {t("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}
