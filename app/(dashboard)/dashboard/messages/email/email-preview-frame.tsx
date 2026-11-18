"use client";

import { useTranslations } from "next-intl";
import { previewSrcDoc } from "@/lib/messages/preview-frame";

/**
 * The email, drawn by the server, in an iframe that is sandboxed with nothing
 * allowed: no script runs in it, and its styles stay out of the dashboard (and
 * the dashboard's out of it). One view, as wide as its column, with a fixed
 * height so the editor does not jump while the preview reloads. The subject is
 * the form's own field, not repeated here, and the note on what the example
 * shows is the frame's description for a screen reader.
 */
export function EmailPreviewFrame({
  html,
  failed,
  failure,
}: {
  /** Null while the first one is being prepared. */
  html: string | null;
  /** The last draft could not be drawn: what is shown is the last one that could. */
  failed: boolean;
  /** Why it failed when the draft was not the cause, already in words. */
  failure: string | null;
}) {
  const t = useTranslations("dashboard.messages.email.editor.preview");

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-petroleum-500 text-xs font-medium">{t("title")}</h3>
      <p id="message-preview-note" className="sr-only">
        {t("note")}
      </p>
      {failed && (
        <p role="status" className="text-xs text-yellow-800">
          {failure ?? t("failed")}
        </p>
      )}
      <div className="border-sand-200 bg-sand-50 overflow-hidden rounded-2xl border p-3">
        {html === null ? (
          <div className="text-petroleum-400 flex h-160 items-center justify-center text-sm">
            {t("loading")}
          </div>
        ) : (
          <iframe
            title={t("title")}
            aria-describedby="message-preview-note"
            srcDoc={previewSrcDoc(html)}
            sandbox=""
            className="h-160 w-full rounded-xl border-0 bg-white"
          />
        )}
      </div>
    </div>
  );
}
