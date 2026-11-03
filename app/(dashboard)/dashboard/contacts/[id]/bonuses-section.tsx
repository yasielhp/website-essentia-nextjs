"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { shortDate } from "./consent-date";
import type { ContactBonus } from "@/types/bonus";
import { GrantBonusDialog } from "./grant-bonus-dialog";

const STATE_CLASS: Record<"active" | "used" | "expired", string> = {
  active: "bg-green-100 text-green-700",
  used: "bg-sand-100 text-petroleum-500",
  expired: "bg-red-100 text-red-600",
};

/** `YYYY-MM-DD` of today in the browser's calendar, for the expiry colour. */
function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The bonuses this contact bought, one line each: what it is, how many of its
 * sessions are used, when it expires, and — while there is a session left to
 * take and the bonus has not expired — a button to redeem one, which starts a
 * booking for this contact with the bonus ready to be used.
 */
export function BonusesSection({
  loading,
  bonuses,
  contactId,
  onChanged,
}: {
  loading: boolean;
  bonuses: ContactBonus[];
  contactId: string;
  onChanged: () => void;
}) {
  const t = useTranslations("dashboard.contacts.detail.bonuses");
  const tBonuses = useTranslations("dashboard.bonuses");
  const [granting, setGranting] = useState(false);
  const today = todayLocal();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-petroleum-500 text-sm">
          {!loading && t("total", { count: bonuses.length })}
        </span>
        <Button
          variant="solid"
          size="lg"
          onClick={() => setGranting(true)}
          disabled={loading}
        >
          {t("add")}
        </Button>
      </div>

      {loading ? (
        <div className="bg-sand-100 h-24 animate-pulse rounded-xl" />
      ) : bonuses.length === 0 ? (
        <p className="text-petroleum-300 text-sm">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {bonuses.map((b) => {
            const expired = b.expiresAt < today;
            const canRedeem = b.remaining > 0 && !expired;
            // What the bonus is right now. Used up wins over expired: a bonus
            // with nothing left to take is finished whatever the date says.
            const state =
              b.remaining === 0 ? "used" : expired ? "expired" : "active";
            return (
              <div
                key={b.id}
                className="border-sand-200 flex items-center justify-between gap-4 rounded-2xl border bg-white p-5"
              >
                <div className="min-w-0">
                  <span
                    className={`mb-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_CLASS[state]}`}
                  >
                    {t(`state.${state}`)}
                  </span>
                  <p className="text-petroleum-700 font-medium">
                    {tBonuses("label", { sessions: b.sessionsTotal })}
                  </p>
                  <p
                    className={`mt-1 text-sm ${expired ? "text-red-600" : "text-petroleum-500"}`}
                  >
                    {b.used}/{b.sessionsTotal} ·{" "}
                    {t(expired ? "expiredOn" : "expiresOn", {
                      date: shortDate(b.expiresAt),
                    })}
                  </p>
                </div>
                {canRedeem && (
                  <Button
                    variant="solid"
                    size="lg"
                    href={`/dashboard/bookings/new?contact=${contactId}&bonus=${b.id}`}
                  >
                    {t("redeem")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {granting && (
        <GrantBonusDialog
          contactId={contactId}
          onClose={() => setGranting(false)}
          onGranted={() => {
            setGranting(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
