"use client";

import { useTranslations } from "next-intl";
import { formatMediumDate, type SupportedLocale } from "@/utils/format";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { hasStaleSync } from "@/lib/whatsapp/template-ui";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import {
  RejectionNote,
  SyncLine,
  TemplateStatusBadge,
  UnsupportedNote,
} from "./template-status";

const TH =
  "text-petroleum-400 px-5 py-3 text-left text-xs font-medium whitespace-nowrap";

/** What goes under a state: why it was rejected, or that Meta may have lost it. */
function StatusNotes({
  template,
  stale,
}: {
  template: WhatsAppTemplateRow;
  stale: boolean;
}) {
  return (
    <>
      {template.status === "REJECTED" && (
        <RejectionNote
          reason={template.rejection_reason}
          truncate
          className="mt-1 max-w-56"
        />
      )}
      {stale && <SyncLine syncedAt={template.synced_at} className="mt-1" />}
    </>
  );
}

export function TemplateTable({
  templates,
  loading,
  configured,
  lastSync,
  locale,
  onOpen,
}: {
  templates: WhatsAppTemplateRow[];
  loading: boolean;
  configured: boolean;
  /** When the newest sync ran; a row older than this was not in its answer. */
  lastSync: number | null;
  locale: SupportedLocale;
  onOpen: (template: WhatsAppTemplateRow) => void;
}) {
  const t = useTranslations("dashboard.messages.whatsapp");

  const languageLabel = (code: string) =>
    t.has(`languages.${code}`) ? t(`languages.${code}`) : code;
  const categoryLabel = (code: string) =>
    t.has(`categories.${code}`) ? t(`categories.${code}`) : code;

  return (
    <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
      {loading ? (
        <TableSkeleton cols={6} />
      ) : templates.length === 0 ? (
        <div className="text-petroleum-400 px-6 py-20 text-center text-sm">
          {t("empty")}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-100 border-b">
                  <th className={TH}>{t("table.name")}</th>
                  <th className={TH}>{t("table.language")}</th>
                  <th className={TH}>{t("table.category")}</th>
                  <th className={TH}>{t("table.status")}</th>
                  <th className={`${TH} text-right`}>{t("table.params")}</th>
                  <th className={TH}>{t("table.updated")}</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr
                    key={template.id}
                    onClick={() => onOpen(template)}
                    className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b align-top transition-colors last:border-0"
                  >
                    <td className="px-5 py-3.5">
                      {/* The click bubbles to the row; the button is how a
                          keyboard reaches it. */}
                      <button
                        type="button"
                        className="text-petroleum-700 text-left font-medium break-all"
                      >
                        {template.name}
                      </button>
                      {template.unsupported_reason && (
                        <UnsupportedNote
                          reason={template.unsupported_reason}
                          className="mt-1.5"
                        />
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5">
                      {languageLabel(template.language)}
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5">
                      {categoryLabel(template.category)}
                    </td>
                    <td className="px-5 py-3.5">
                      <TemplateStatusBadge status={template.status} />
                      <StatusNotes
                        template={template}
                        stale={hasStaleSync(template, lastSync, configured)}
                      />
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                      {template.param_count}
                    </td>
                    <td className="text-petroleum-500 px-5 py-3.5 text-xs whitespace-nowrap">
                      {formatMediumDate(template.updated_at, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="divide-sand-100 divide-y md:hidden">
            {templates.map((template) => (
              <div
                key={template.id}
                onClick={() => onOpen(template)}
                className="hover:bg-sand-50 flex w-full cursor-pointer items-start justify-between gap-4 px-5 py-4 transition-colors"
              >
                <div className="min-w-0">
                  <button
                    type="button"
                    className="text-petroleum-700 text-left font-medium break-all"
                  >
                    {template.name}
                  </button>
                  <p className="text-petroleum-400 text-xs">
                    {languageLabel(template.language)} ·{" "}
                    {categoryLabel(template.category)} ·{" "}
                    {formatMediumDate(template.updated_at, locale)}
                  </p>
                  {template.unsupported_reason && (
                    <UnsupportedNote
                      reason={template.unsupported_reason}
                      className="mt-1.5"
                    />
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <TemplateStatusBadge status={template.status} />
                  <StatusNotes
                    template={template}
                    stale={hasStaleSync(template, lastSync, configured)}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
