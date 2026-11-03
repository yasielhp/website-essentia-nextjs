"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { shortDate } from "./consent-date";
import { localDateStr } from "@/utils/format";
import type { ContactBonus } from "@/types/bonus";
import { GrantBonusDialog } from "./grant-bonus-dialog";
import { deleteContactBonus } from "@/actions/bonuses";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";

const STATE_CLASS: Record<"active" | "used" | "expired", string> = {
  active: "bg-green-100 text-green-700",
  used: "bg-sand-100 text-petroleum-500",
  expired: "bg-red-100 text-red-600",
};

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
  const [removing, setRemoving] = useState<ContactBonus | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function remove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    const { error } = await deleteContactBonus(getAccessToken(), removing.id);
    setRemoveBusy(false);
    if (error) {
      setRemoveError(t(`deleteError.${error}`));
      return;
    }
    setRemoving(null);
    notifySuccess(t("deleted"));
    onChanged();
  }

  const today = localDateStr(new Date());

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
                <div className="flex shrink-0 items-center gap-3">
                  {/* Only a bonus nobody has drawn from, and not one the client
                      paid for online: those are money, and a mistake in them
                      is undone on the booking or by the bank. */}
                  {b.used === 0 && b.paidMethod !== "online" && (
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveError(null);
                        setRemoving(b);
                      }}
                      className="text-sm text-red-500 underline underline-offset-4 hover:text-red-600"
                    >
                      {t("delete")}
                    </button>
                  )}
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
              </div>
            );
          })}
        </div>
      )}

      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("deleteDialog.title")}
            className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex flex-col gap-1">
              <h3 className="font-display text-petroleum-700 text-xl">
                {t("deleteDialog.title")}
              </h3>
              <p className="text-petroleum-400 text-sm">
                {t("deleteDialog.body", {
                  bonus: tBonuses("label", {
                    sessions: removing.sessionsTotal,
                  }),
                })}
              </p>
            </div>
            {removeError && (
              <p className="text-sm text-red-600" role="alert">
                {removeError}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Button
                variant="danger"
                size="md"
                onClick={() => void remove()}
                disabled={removeBusy}
                className="w-full"
              >
                {removeBusy
                  ? t("deleteDialog.deleting")
                  : t("deleteDialog.confirm")}
              </Button>
              <Button
                variant="outline"
                size="md"
                onClick={() => setRemoving(null)}
                disabled={removeBusy}
                className="w-full"
              >
                {t("dialog.cancel")}
              </Button>
            </div>
          </div>
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
