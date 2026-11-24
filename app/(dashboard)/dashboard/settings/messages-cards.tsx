"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LoadWhenVisible } from "@/components/dashboard/load-when-visible";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { useKeepAnchorInView } from "@/hooks/use-keep-anchor-in-view";
import {
  MESSAGES_ANCHOR,
  WHATSAPP_TEMPLATES_ANCHOR,
} from "@/lib/messages/message-route";
import { EmailPanel } from "./messages/email/email-panel";
import { MessageListSkeleton } from "./messages/email/message-list-skeleton";
import { TemplatesPanel } from "./messages/whatsapp/templates-panel";
import { TemplateTable } from "./messages/whatsapp/template-table";

// The anchors the rest of the dashboard links to live with the addresses.
const MESSAGES_CARD_ID = MESSAGES_ANCHOR;
const WHATSAPP_TEMPLATES_CARD_ID = WHATSAPP_TEMPLATES_ANCHOR;

/**
 * "Automatic messages": every message the centre sends on its own, with its
 * switch, its state and the way to its page. A card of Settings like the others
 * (its own heading, then its content). Nothing is read until the card is near
 * the screen, so opening Settings does not pay for it.
 */
export function AutomaticMessagesSettings() {
  const t = useTranslations("dashboard.messages.email");
  useKeepAnchorInView(MESSAGES_CARD_ID);
  return (
    <div>
      <div className="mb-4 flex h-10 items-center">
        <h2 className="font-display text-petroleum-700 text-xl">
          {t("heading")}
        </h2>
      </div>
      <LoadWhenVisible
        placeholder={
          // What the panel itself shows while it loads, so nothing jumps.
          <div className="flex flex-col gap-6">
            <p className="text-petroleum-400 max-w-full text-sm">
              {t("intro")}
            </p>
            <MessageListSkeleton />
          </div>
        }
      >
        <EmailPanel />
      </LoadWhenVisible>
    </div>
  );
}

/**
 * "WhatsApp templates": the account's templates and the button to create one,
 * which sits in the card's own header, to the right of the title and its
 * description. The panel
 * asks Meta to refresh its copy when it opens, which is one more reason for it
 * not to load until the card is near the screen.
 */
export function WhatsAppTemplatesSettings() {
  const t = useTranslations("dashboard.messages.whatsapp");
  const locale = useDashboardLocale();
  useKeepAnchorInView(WHATSAPP_TEMPLATES_CARD_ID);
  // Where the panel draws its "New template" button: the card's header.
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  return (
    <div>
      {/* Two columns, both from the top: the title with its description right
          under it (the same space as in the other cards), and the button with
          the line under it, centred on it. Neither pushes the other: the table
          starts after the taller one. On a phone they stack, the button's
          column under the description. */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-4 flex h-10 items-center">
            <h2 className="font-display text-petroleum-700 text-xl">
              {t("heading")}
            </h2>
          </div>
          <p className="text-petroleum-400 max-w-full text-sm">{t("intro")}</p>
        </div>
        <div ref={setActionsSlot} className="flex shrink-0 self-start" />
      </div>
      <LoadWhenVisible
        placeholder={
          <TemplateTable
            templates={[]}
            loading
            configured
            lastSync={null}
            locale={locale}
            onOpen={() => {}}
          />
        }
      >
        <TemplatesPanel actionsSlot={actionsSlot} />
      </LoadWhenVisible>
    </div>
  );
}
