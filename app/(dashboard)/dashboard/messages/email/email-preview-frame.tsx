"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { previewSrcDoc } from "@/lib/messages/preview-frame";

/**
 * The email, drawn by the server, in an iframe that is sandboxed with nothing
 * allowed: no script runs in it, and its styles stay out of the dashboard (and
 * the dashboard's out of it). A fixed height, so the editor does not jump while
 * the preview reloads.
 */
export function EmailPreviewFrame({
  html,
  subject,
  failed,
  failure,
}: {
  /** Null while the first one is being prepared. */
  html: string | null;
  subject: string | null;
  /** The last draft could not be drawn: what is shown is the last one that could. */
  failed: boolean;
  /** Why it failed when the draft was not the cause, already in words. */
  failure: string | null;
}) {
  const t = useTranslations("dashboard.messages.email.editor.preview");
  const [width, setWidth] = useState<"mobile" | "desktop">("desktop");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-petroleum-500 text-sm font-semibold">
          {t("title")}
        </h3>
        <div
          role="group"
          aria-label={t("title")}
          className="bg-sand-100 flex rounded-full p-0.5 text-xs"
        >
          {(["mobile", "desktop"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={width === option}
              onClick={() => setWidth(option)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                width === option
                  ? "text-petroleum-700 bg-white shadow-sm"
                  : "text-petroleum-400"
              }`}
            >
              {t(option)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-petroleum-400 text-xs">{t("note")}</p>
      {subject && (
        <p className="text-petroleum-700 text-sm font-medium">
          {t("subject", { subject })}
        </p>
      )}
      {failed && (
        <p role="status" className="text-xs text-yellow-800">
          {failure ?? t("failed")}
        </p>
      )}
      <div className="border-sand-200 bg-sand-50 flex justify-center overflow-hidden rounded-2xl border p-3">
        {html === null ? (
          <div className="text-petroleum-400 flex h-160 items-center text-sm">
            {t("loading")}
          </div>
        ) : (
          <iframe
            title={t("title")}
            srcDoc={previewSrcDoc(html)}
            sandbox=""
            className="h-160 rounded-xl border-0 bg-white transition-[width]"
            style={{ width: width === "mobile" ? 375 : "100%" }}
          />
        )}
      </div>
    </div>
  );
}
