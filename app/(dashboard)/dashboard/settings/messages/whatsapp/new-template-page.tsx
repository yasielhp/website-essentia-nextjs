"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { listWhatsAppTemplates } from "@/actions/whatsapp-templates";
import { getAccessToken } from "@/lib/client-session";
import { whatsappTemplatesHref } from "@/lib/messages/message-route";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import { MessagePageHeader } from "../email/page-parts";
import { useActionToast } from "./action-error";
import { TemplateForm } from "./template-form";

type Loaded =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      templates: WhatsAppTemplateRow[];
      configured: boolean;
    };

/**
 * The page of a new WhatsApp template. It reads the account's templates first:
 * their names (to offer a free one when a name is taken), whether the server
 * can send to Meta at all (if not, the form says it keeps a draft) and, with
 * `fromId`, the rejected template being rewritten. Cancel and a sent template
 * both go back to the templates card of Settings, which reads its list afresh.
 */
export function NewTemplatePage({ fromId }: { fromId: string | null }) {
  const t = useTranslations("dashboard.messages.whatsapp");
  const router = useRouter();
  const showError = useActionToast();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listWhatsAppTemplates(getAccessToken())
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setLoaded({
            status: "ready",
            templates: result.templates,
            configured: result.configured,
          });
        } else {
          setLoaded({ status: "error" });
          showError(result);
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // `showError` is a new function each render; the read repeats on `attempt`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const title = t(fromId ? "form.rewriteTitle" : "form.title");
  const backToList = () => router.push(whatsappTemplatesHref());

  if (loaded.status !== "ready") {
    return (
      <div className="flex flex-col gap-6">
        <MessagePageHeader title={title} />
        {loaded.status === "error" ? (
          <div className="border-sand-200 flex flex-col items-center gap-4 rounded-2xl border bg-white px-6 py-16 text-center">
            <p className="text-petroleum-400 text-sm">{t("loadFailed")}</p>
            <Button
              variant="outline"
              onClick={() => {
                setLoaded({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              {t("retry")}
            </Button>
          </div>
        ) : (
          <div
            role="status"
            aria-label={title}
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
          >
            <div className="bg-sand-100 h-96 animate-pulse rounded-2xl" />
            <div className="bg-sand-100 h-64 animate-pulse rounded-2xl" />
          </div>
        )}
      </div>
    );
  }

  // A rewrite only of a template that is there; an id that is not one is a
  // blank form, not an error.
  const seed = fromId
    ? (loaded.templates.find((template) => template.id === fromId) ?? null)
    : null;

  return (
    <TemplateForm
      seed={seed}
      configured={loaded.configured}
      takenNames={loaded.templates.map((template) => template.name)}
      onClose={backToList}
      onCreated={backToList}
    />
  );
}
