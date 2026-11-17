"use client";

import { useTranslations } from "next-intl";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatMediumDate } from "@/utils/format";
import { statusTone, type StatusTone } from "@/lib/whatsapp/template-ui";
import type { WhatsAppTemplateUnsupportedReason } from "@/lib/whatsapp/types";

/**
 * The colours say what the campaign badges say: green is usable, amber is
 * waiting or at risk, red needs somebody to look, grey is inert.
 */
const TONE_STYLES: Record<StatusTone, string> = {
  neutral: "bg-sand-100 text-petroleum-500",
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  danger: "bg-red-100 text-red-700",
};

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/** `status` is text in the database: Meta can add a state before we know it. */
export function TemplateStatusBadge({ status }: { status: string }) {
  const t = useTranslations("dashboard.messages.whatsapp.status");
  return (
    <span className={`${PILL} ${TONE_STYLES[statusTone(status)]}`}>
      {t.has(status) ? t(status) : status}
    </span>
  );
}

/**
 * Marks a template the dashboard cannot send and says why, so nobody waits for
 * an approval that would not help. Campaigns must not offer these.
 */
export function UnsupportedNote({
  reason,
  className = "",
}: {
  reason: WhatsAppTemplateUnsupportedReason;
  className?: string;
}) {
  const t = useTranslations("dashboard.messages.whatsapp.unsupported");
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <span
        className={`${PILL} bg-yellow-50 text-yellow-800 ring-1 ring-yellow-300`}
      >
        {t("badge")}
      </span>
      <span className="text-petroleum-400 text-xs">
        {t.has(reason) ? t(reason) : reason}
      </span>
    </div>
  );
}

/**
 * "Last synced: <date>" for a template Meta may no longer have. The date is
 * the one the row carries, which is how a deletion on Meta's side shows up: a
 * row the sync keeps skipping gets older than the rest.
 */
export function SyncLine({
  syncedAt,
  className = "",
}: {
  syncedAt: string | null;
  className?: string;
}) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const locale = useDashboardLocale();
  return (
    <p className={`text-petroleum-400 text-xs ${className}`}>
      {t("lastSync", {
        date: syncedAt ? formatMediumDate(syncedAt, locale) : t("neverSynced"),
      })}
    </p>
  );
}

/** Meta's reason for a rejection, or the line that says it gave none. */
export function RejectionNote({
  reason,
  className = "",
  truncate = false,
}: {
  reason: string | null;
  className?: string;
  truncate?: boolean;
}) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const text = reason ? t("rejection", { reason }) : t("rejectionUnknown");
  return (
    <p
      title={text}
      className={`text-xs text-red-700 ${truncate ? "truncate" : ""} ${className}`}
    >
      {text}
    </p>
  );
}
