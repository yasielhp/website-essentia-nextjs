"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { hasStaleSync } from "@/lib/whatsapp/template-ui";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { Modal } from "./modal";
import { TemplatePreview } from "./template-preview";
import {
  RejectionNote,
  SyncLine,
  TemplateStatusBadge,
  UnsupportedNote,
} from "./template-status";

/** One template as the admin will see it on a phone, with what is wrong with it. */
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
  const language = t.has(`languages.${template.language}`)
    ? t(`languages.${template.language}`)
    : template.language;
  const category = t.has(`categories.${template.category}`)
    ? t(`categories.${template.category}`)
    : template.category;

  return (
    <Modal title={t("detail.title", { name: template.name })} onClose={onClose}>
      <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <TemplateStatusBadge status={template.status} />
          <span className="text-petroleum-400 text-xs">
            {language} · {category} ·{" "}
            {t("paramCount", { count: template.param_count })}
          </span>
        </div>

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
