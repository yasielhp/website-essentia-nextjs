"use client";

import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { sendNotice } from "@/lib/campaigns/send-notice";
import type { SendOutcome } from "@/lib/campaigns/send-outcome";

/**
 * Tells the admin how a send or a retry ended, without ever saying "sent" when
 * it was not: a WhatsApp send that stopped leaves rows for the cron (and says
 * so), one that Meta kept refusing says why, and messages that left without
 * being recorded ask for a look at the report. `done` is the plain success
 * message of the caller (sent, retried…).
 */
export function useSendNoticeToast() {
  const t = useTranslations("dashboard.toasts");

  return (outcome: SendOutcome, done: "campaignSent" | "campaignRetried") => {
    const notice = sendNotice(outcome);
    if (notice.kind === "halted") {
      toast.error(
        notice.reason
          ? t("sendHalted", { reason: notice.reason })
          : t("sendHaltedNoReason"),
      );
    } else if (notice.kind === "partial") {
      toast.info(
        t("sendPartial", { sent: notice.sent, remaining: notice.remaining }),
      );
    } else {
      notifySuccess(t(done));
    }
    if (notice.unrecorded > 0) {
      toast.warning(t("sendUnrecorded", { count: notice.unrecorded }));
    }
  };
}
