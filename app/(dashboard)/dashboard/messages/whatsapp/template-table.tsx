"use client";

import { useTranslations } from "next-intl";
import { MobileRowCard } from "@/components/dashboard/mobile-row-card";
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
          <ul className="divide-sand-100 divide-y md:hidden">
            {templates.map((template) => (
              <MobileRowCard
                key={template.id}
                title={
                  // The card opens the template: the name is the button, as tall
                  // as a thumb needs.
                  <button
                    type="button"
                    onClick={() => onOpen(template)}
                    className="text-petroleum-700 focus-visible:ring-petroleum-500 min-h-11 w-full rounded text-left font-medium break-all focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {template.name}
                  </button>
                }
                facts={[
                  {
                    label: t("table.language"),
                    value: languageLabel(template.language),
                  },
                  {
                    label: t("table.category"),
                    value: categoryLabel(template.category),
                  },
                  { label: t("table.params"), value: template.param_count },
                  {
                    label: t("table.updated"),
                    value: formatMediumDate(template.updated_at, locale),
                  },
                  {
                    label: t("table.status"),
                    value: <TemplateStatusBadge status={template.status} />,
                  },
                ]}
              >
                <StatusNotes
                  template={template}
                  stale={hasStaleSync(template, lastSync, configured)}
                />
                {template.unsupported_reason && (
                  <UnsupportedNote reason={template.unsupported_reason} />
                )}
              </MobileRowCard>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
