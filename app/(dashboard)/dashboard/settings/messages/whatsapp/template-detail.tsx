"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { hasStaleSync } from "@/lib/whatsapp/template-ui";
import { formatMediumDate } from "@/utils/format";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { Modal } from "./modal";
import { TemplatePreview } from "@/components/dashboard/template-preview";
import {
  RejectionNote,
  SyncLine,
  TemplateStatusBadge,
  UnsupportedNote,
} from "./template-status";

/**
 * One template as the admin will see it on a phone, with what is wrong with it.
 * Two columns from md up: its facts (and any problem) on the left, the phone
 * preview on the right; on a phone, the facts first and the preview under them.
 */
export function TemplateDetail({
  template,
  configured,
  lastSync,
  onClose,
  onUseAnotherName,
}: {
  template: WhatsAppTemplateRow;
  configured: boolean;
  lastSync: number | null;
  onClose: () => void;
  onUseAnotherName: (template: WhatsAppTemplateRow) => void;
}) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const locale = useDashboardLocale();
  const language = t.has(`languages.${template.language}`)
    ? t(`languages.${template.language}`)
    : template.language;
  const category = t.has(`categories.${template.category}`)
    ? t(`categories.${template.category}`)
    : template.category;

  // The same labels as the columns of the list the template was opened from.
  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: t("table.status"),
      value: <TemplateStatusBadge status={template.status} />,
    },
    { label: t("table.language"), value: language },
    { label: t("table.category"), value: category },
    { label: t("table.params"), value: template.param_count },
    {
      label: t("table.updated"),
      value: formatMediumDate(template.updated_at, locale),
    },
  ];

  return (
    <Modal
      title={t("detail.title", { name: template.name })}
      onClose={onClose}
      wide
    >
      <div className="grid gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-start">
        <div className="flex flex-col gap-4">
          <dl className="divide-sand-100 flex flex-col divide-y">
            {facts.map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-2.5 first:pt-0"
              >
                <dt className="text-petroleum-400 text-xs">{label}</dt>
                <dd className="text-petroleum-700 text-right text-sm tabular-nums">
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {template.status === "REJECTED" && (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3">
              <RejectionNote reason={template.rejection_reason} />
              <p className="text-petroleum-500 mt-1 text-xs">
                {t("detail.rejectedHelp")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => onUseAnotherName(template)}
              >
                {t("useAnotherName")}
              </Button>
            </div>
          )}

          {template.unsupported_reason && (
            <UnsupportedNote reason={template.unsupported_reason} />
          )}

          {hasStaleSync(template, lastSync, configured) && (
            <SyncLine syncedAt={template.synced_at} />
          )}
        </div>

        <div>
          <p className="text-petroleum-500 mb-2 text-xs font-medium">
            {t("detail.preview")}
          </p>
          <TemplatePreview
            headerText={template.header_text}
            body={template.body}
            footerText={template.footer_text}
            buttons={template.buttons ?? []}
            examples={template.example_params ?? []}
          />
        </div>
      </div>
    </Modal>
  );
}
