"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { INPUT_CLASS } from "@/constants/form-styles";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { appointmentLabel } from "@/lib/campaigns/appointment-form";
import {
  recipientIdentity,
  recipientLastEvent,
} from "@/lib/campaigns/recipient-row";
import { MobileRowCard } from "@/components/dashboard/mobile-row-card";
import { describeRecipientError } from "@/lib/campaigns/report";
import type {
  CampaignChannel,
  CampaignKind,
  CampaignRecipientRow,
} from "@/types/campaign";
import { RecipientStatusBadge } from "../status-badge";

/**
 * Everyone the campaign went to, with what happened to each. Failures come
 * first (the server orders them so); the search narrows by address.
 */
export function RecipientTable({
  recipients,
  locale,
  channel = "email",
  kind,
}: {
  recipients: CampaignRecipientRow[];
  locale: SupportedLocale;
  channel?: CampaignChannel;
  kind?: CampaignKind;
}) {
  const t = useTranslations("dashboard.campaigns.detail");
  const tNotes = useTranslations("dashboard.campaigns.detail.notes");
  const whatsapp = channel === "whatsapp";
  // One client can get several notices from one campaign, one per appointment:
  // the appointment is what tells the rows apart.
  const appointment = kind === "appointment";

  /** The error column: our words for what the send marked, Meta's as they came. */
  const errorText = (error: string | null): string => {
    const note = describeRecipientError(error);
    if (!note) return "";
    return note.kind === "raw"
      ? note.text
      : tNotes.has(note.key)
        ? tNotes(note.key, note.values)
        : (error ?? "");
  };
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return recipients;
    // A WhatsApp recipient has a phone and no email; typing "600 11" must
    // still find +34600112233.
    const digits = term.replace(/\s+/g, "");
    return recipients.filter(
      (r) =>
        (r.email ?? "").includes(term) ||
        (digits !== "" && (r.phone ?? "").includes(digits)),
    );
  }, [recipients, query]);

  return (
    <section className="border-sand-200 rounded-2xl border bg-white">
      <div className="border-sand-100 flex flex-col gap-3 border-b px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-petroleum-500 text-sm font-semibold">
          {t("recipients")}
          <span className="text-petroleum-400 ml-1.5 text-xs">
            {recipients.length}
          </span>
        </h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={whatsapp ? t("searchPhone") : t("search")}
          aria-label={whatsapp ? t("searchPhone") : t("search")}
          className={`${INPUT_CLASS} sm:w-64`}
        />
      </div>

      {visible.length === 0 ? (
        <p className="text-petroleum-400 px-6 py-10 text-center text-sm">
          {t("noRecipients")}
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-100 border-b text-left">
                  {(
                    [
                      whatsapp ? "phone" : "email",
                      ...(appointment ? (["appointment"] as const) : []),
                      "language",
                      "status",
                      "date",
                      "error",
                    ] as const
                  ).map((column) => (
                    <th
                      key={column}
                      className="text-petroleum-400 px-6 py-2.5 text-xs font-medium whitespace-nowrap"
                    >
                      {column === "phone"
                        ? t("columnsPhone")
                        : column === "appointment"
                          ? t("columnsAppointment")
                          : t(`columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr
                    key={row.id}
                    className="border-sand-50 border-b last:border-0"
                  >
                    <td className="text-petroleum-700 px-6 py-3 font-medium">
                      {recipientIdentity(row, channel)}
                    </td>
                    {appointment && (
                      <td className="text-petroleum-500 px-6 py-3 text-xs">
                        {appointmentLabel(row.vars) ?? "—"}
                      </td>
                    )}
                    <td className="text-petroleum-500 px-6 py-3 uppercase">
                      {row.language}
                    </td>
                    <td className="px-6 py-3">
                      <RecipientStatusBadge
                        status={row.status}
                        channel={channel}
                      />
                    </td>
                    <td className="text-petroleum-400 px-6 py-3 text-xs whitespace-nowrap">
                      {formatMediumDate(
                        recipientLastEvent(row, channel),
                        locale,
                      )}
                    </td>
                    <td
                      className="text-petroleum-400 max-w-xs truncate px-6 py-3 text-xs"
                      title={errorText(row.error)}
                    >
                      {errorText(row.error)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="divide-sand-100 divide-y md:hidden">
            {visible.map((row) => {
              const error = errorText(row.error);
              return (
                <MobileRowCard
                  key={row.id}
                  title={recipientIdentity(row, channel)}
                  description={
                    appointment
                      ? `${t("columnsAppointment")}: ${appointmentLabel(row.vars) ?? "—"}`
                      : undefined
                  }
                  facts={[
                    {
                      label: t("columns.language"),
                      value: row.language.toUpperCase(),
                    },
                    {
                      label: t("columns.status"),
                      value: (
                        <RecipientStatusBadge
                          status={row.status}
                          channel={channel}
                        />
                      ),
                    },
                    {
                      label: t("columns.date"),
                      value: formatMediumDate(
                        recipientLastEvent(row, channel),
                        locale,
                      ),
                    },
                    ...(error
                      ? [{ label: t("columns.error"), value: error }]
                      : []),
                  ]}
                />
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
