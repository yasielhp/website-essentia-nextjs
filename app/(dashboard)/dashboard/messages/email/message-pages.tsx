"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { listMessageTemplates } from "@/actions/message-templates";
import { getAccessToken } from "@/lib/client-session";
import type { MessageKey } from "@/lib/messages/catalog";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { useWhatsAppTemplates } from "../../campaigns/_form/use-whatsapp-templates";
import { useEmailActionToast } from "./action-error";
import { MessageEditor } from "./message-editor";
import { MessagePageHeader, ResetControl } from "./page-parts";
import { WhatsAppMessageEditor } from "./whatsapp-message-editor";

type Locale = "es" | "en";

type Loaded =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      rows: MessageTemplateRowView[];
      defaults: MessageDefaultEntry[];
      catalog: MessageCatalogEntry[];
    };

/**
 * The messages, read when the page opens and again on every visit: nothing is
 * kept from the list, so what is edited here is what is saved now, and the list
 * reads its own the same way when it is opened again.
 */
function useLoadedMessages(): Loaded & { reload: () => void } {
  const showError = useEmailActionToast();
  const [state, setState] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listMessageTemplates(getAccessToken())
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setState({
            status: "ready",
            rows: result.rows,
            defaults: result.defaults,
            catalog: result.catalog,
          });
        } else {
          setState({ status: "error" });
          showError(result);
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // `showError` is a new function each render; the read repeats on `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);
  return { ...state, reload };
}

const FRAME = "px-6 py-8 lg:px-10";

/** The page while it loads or when it could not: the same header, then the state. */
function Waiting({
  title,
  failed,
  onRetry,
}: {
  title: string;
  failed: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("dashboard.messages.email");
  return (
    <div className={`${FRAME} flex flex-col gap-6`}>
      <MessagePageHeader title={title} />
      {failed ? (
        <div className="border-sand-200 flex flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-16 text-center">
          <p className="text-petroleum-400 text-sm">{t("loadFailed")}</p>
          <Button variant="outline" onClick={onRetry}>
            {t("retry")}
          </Button>
        </div>
      ) : (
        <div
          role="status"
          aria-label={t("page.loading")}
          className="bg-sand-100 h-64 animate-pulse rounded-2xl"
        />
      )}
    </div>
  );
}

/** The page where one email is edited. */
export function EmailMessagePage({
  messageKey,
  locale,
}: {
  messageKey: MessageKey;
  locale: Locale;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const loaded = useLoadedMessages();
  const title = t("editor.title", { name: tKeys(messageKey) });

  if (loaded.status !== "ready") {
    return (
      <Waiting
        title={title}
        failed={loaded.status === "error"}
        onRetry={loaded.reload}
      />
    );
  }

  const saved =
    loaded.rows.find(
      (r) =>
        r.channel === "email" && r.key === messageKey && r.locale === locale,
    ) ?? null;
  const defaults = loaded.defaults.find(
    (d) => d.key === messageKey && d.locale === locale,
  );
  const catalog = loaded.catalog.find((c) => c.key === messageKey);
  if (!defaults || !catalog) {
    return <Waiting title={title} failed onRetry={loaded.reload} />;
  }

  // A row whose text cannot be read is not edited: it is put back to the default.
  if (saved?.corrupt) {
    return (
      <div className={`${FRAME} flex flex-col gap-6`}>
        <MessagePageHeader title={title} describedBy="message-corrupt" />
        <p
          id="message-corrupt"
          role="alert"
          className="max-w-xl rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {t("corrupt")}
        </p>
        <div>
          <ResetControl
            channel="email"
            messageKey={messageKey}
            locale={locale}
            labels={{
              button: t("actions.reset"),
              working: t("actions.resetting"),
              title: t("resetDialog.title", {
                name: tKeys(messageKey),
                language: t(`locales.${locale}`),
              }),
              body: t("resetDialog.body"),
              note:
                saved.enabled === false ? t("resetDialog.keepsOff") : undefined,
              yes: t("resetDialog.yes"),
              no: t("resetNo"),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={FRAME}>
      <MessageEditor
        messageKey={messageKey}
        locale={locale}
        saved={saved}
        defaults={defaults}
        catalog={catalog}
      />
    </div>
  );
}

/** The page where the WhatsApp notice of one message is set up. */
export function WhatsAppMessagePage({
  messageKey,
  locale,
}: {
  messageKey: MessageKey;
  locale: Locale;
}) {
  const t = useTranslations("dashboard.messages.email");
  const tKeys = useTranslations("dashboard.messages.keys");
  const loaded = useLoadedMessages();
  const [templatesKey, setTemplatesKey] = useState(0);
  const templates = useWhatsAppTemplates(true, templatesKey);
  const title = t("whatsapp.editor.title", { name: tKeys(messageKey) });

  const failed = loaded.status === "error" || templates.status === "error";
  if (loaded.status !== "ready" || templates.status !== "ready") {
    return (
      <Waiting
        title={title}
        failed={failed}
        onRetry={() => {
          loaded.reload();
          setTemplatesKey((n) => n + 1);
        }}
      />
    );
  }

  const saved =
    loaded.rows.find(
      (r) =>
        r.channel === "whatsapp" && r.key === messageKey && r.locale === locale,
    ) ?? null;

  return (
    <div className={FRAME}>
      <WhatsAppMessageEditor
        messageKey={messageKey}
        locale={locale}
        saved={saved}
        templates={templates.templates}
        canTest={templates.configured}
      />
    </div>
  );
}
