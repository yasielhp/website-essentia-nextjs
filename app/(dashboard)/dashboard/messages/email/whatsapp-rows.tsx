"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  whatsappRowState,
  type SavedWhatsAppRow,
} from "@/lib/messages/whatsapp-row";
import type { MessageKey } from "@/lib/messages/catalog";
import { messageEditHref } from "@/lib/messages/message-route";
import type { MessageTemplateRowView } from "@/lib/messages/types";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";

const PILL =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

/**
 * The WhatsApp rows of one message: one per language, because a booking goes
 * out in the language it was made in and each language needs its own template.
 * Shows what each does today (nothing, or which template) and, when the saved
 * template can no longer be sent, why.
 */
export function WhatsAppRows({
  messageKey,
  rows,
  templates,
}: {
  messageKey: MessageKey;
  rows: MessageTemplateRowView[];
  /** The account's templates; null when they could not be read. */
  templates: WhatsAppTemplateRow[] | null;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tWa = useTranslations("dashboard.messages.email.whatsapp");
  const tKeys = useTranslations("dashboard.messages.keys");

  return (
    <>
      {(["es", "en"] as const).map((locale) => {
        const saved = rows.find(
          (r) =>
            r.channel === "whatsapp" &&
            r.key === messageKey &&
            r.locale === locale,
        );
        const state = whatsappRowState(
          saved as SavedWhatsAppRow | undefined,
          templates,
          locale,
        );
        const tone =
          state.kind === "configured"
            ? "bg-green-100 text-green-800"
            : state.kind === "invalid"
              ? "bg-red-100 text-red-700"
              : state.kind === "off" || state.kind === "unknown"
                ? "bg-yellow-100 text-yellow-800"
                : "bg-sand-100 text-petroleum-500";
        return (
          <tr
            key={locale}
            className="border-sand-100 bg-sand-50/50 border-b align-top last:border-0"
          >
            <th scope="row" className="px-5 py-3 text-left font-normal">
              <p className="text-petroleum-700 text-sm font-medium">
                {tKeys(messageKey)}{" "}
                <span className="text-petroleum-400 font-normal">
                  · {tWa("channelLabel")}
                </span>
              </p>
            </th>
            <td className="text-petroleum-500 px-5 py-3">
              {t(`locales.${locale}`)}
            </td>
            <td className="px-5 py-3">
              <span className={`${PILL} ${tone}`}>
                {state.kind === "configured"
                  ? tWa("state.configured", { name: state.templateName })
                  : state.kind === "invalid"
                    ? tWa("state.invalid", {
                        reason: tWa(`issue.${state.issue}`),
                      })
                    : tWa(`state.${state.kind}`)}
              </span>
            </td>
            <td className="px-5 py-3">
              {/* The page of the row does the rest: test, remove. */}
              <Button
                size="sm"
                variant="outline"
                href={messageEditHref("whatsapp", messageKey, locale)}
                aria-label={tWa(
                  saved ? "actions.editRow" : "actions.configureRow",
                  {
                    name: tKeys(messageKey),
                    language: t(`locales.${locale}`),
                  },
                )}
              >
                {saved ? tWa("actions.edit") : tWa("actions.configure")}
              </Button>
            </td>
          </tr>
        );
      })}
      {/* The reminder and what follows an appointment are not set up here. */}
      <tr className="border-sand-100 bg-sand-50/50 border-b last:border-0">
        <td colSpan={4} className="text-petroleum-400 px-5 py-2.5 text-xs">
          {tWa("campaignNote")}{" "}
          <Link
            href="/dashboard/campaigns/new"
            className="text-petroleum-700 font-medium underline underline-offset-2"
          >
            {tWa("campaignLink")}
          </Link>
        </td>
      </tr>
    </>
  );
}
