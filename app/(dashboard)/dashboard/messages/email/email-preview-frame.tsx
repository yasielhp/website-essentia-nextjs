"use client";

import { useTranslations } from "next-intl";
import { previewSrcDoc } from "@/lib/messages/preview-frame";

/**
 * As tall as the window leaves room for when the preview sits beside the form
 * (the bar above it, its label and its margins take about 7.5rem), never less
 * than 30rem;
 * a fixed 40rem when it sits under the form.
 */
const FRAME_HEIGHT = "h-160 xl:h-[max(30rem,calc(100dvh-7.5rem))]";

/**
 * The email, drawn by the server, in an iframe that is sandboxed with nothing
 * allowed: no script runs in it, and its styles stay out of the dashboard (and
 * the dashboard's out of it). One view, as wide as its column. Its height does
 * not depend on what it shows, so the editor does not jump while the preview
 * reloads: beside the form (a wide screen, where the column stays in view) it
 * is as tall as the window allows; under the form it is a fixed height. The
 * subject is the form's own field, not repeated here, and the note on what the example
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
          <div
            className={`text-petroleum-400 flex items-center justify-center text-sm ${FRAME_HEIGHT}`}
          >
            {t("loading")}
          </div>
        ) : (
          <iframe
            title={t("title")}
            aria-describedby="message-preview-note"
            srcDoc={previewSrcDoc(html)}
            sandbox=""
            className={`w-full rounded-xl border-0 bg-white ${FRAME_HEIGHT}`}
          />
        )}
      </div>
    </div>
  );
}
