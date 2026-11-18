"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { messagesTabHref } from "@/lib/messages/message-route";

/**
 * The way into Messages from Settings: what they are, and the two tabs they have,
 * one press away. Messages left the sidebar and became a page of Settings, so this
 * card is where it is found. It is a link, not a form: nothing here is saved, and
 * the page it opens keeps its own admin-only door.
 */
export function MessagesSettingsCard() {
  const t = useTranslations("dashboard.settings.messages");
  const tTabs = useTranslations("dashboard.messages.tabs");
  return (
    <div className="flex flex-col gap-3">
      {/* Row height matches the other settings headers. */}
      <div className="flex h-10 items-center">
        <h2 className="font-display text-petroleum-700 text-xl">
          {t("heading")}
        </h2>
      </div>
      <p className="text-petroleum-400 max-w-xl text-sm">{t("description")}</p>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="md" href={messagesTabHref("email")}>
          {tTabs("email")}
        </Button>
        <Button variant="outline" size="md" href={messagesTabHref("whatsapp")}>
          {tTabs("whatsapp")}
        </Button>
      </div>
    </div>
  );
}
