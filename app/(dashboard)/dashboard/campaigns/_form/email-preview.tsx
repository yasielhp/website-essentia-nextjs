"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { renderCampaignPreview } from "@/actions/campaigns";
import type { CampaignLocale, CampaignLocaleContent } from "@/types/campaign";

/**
 * The email as it will look, drawn by the same template that sends it.
 *
 * Rendered on the server and shown in a sandboxed iframe: the HTML is ours,
 * but an iframe keeps the email's styles from bleeding into the dashboard and
 * the dashboard's from bleeding into the email.
 */
export function EmailPreview({
  content,
  locale,
}: {
  content: CampaignLocaleContent;
  locale: CampaignLocale;
}) {
  const t = useTranslations("dashboard.campaigns.content");
  const [html, setHtml] = useState<string | null>(null);
  const [width, setWidth] = useState<"mobile" | "desktop">("desktop");

  const contentKey = JSON.stringify(content);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void renderCampaignPreview(
        getAccessToken(),
        JSON.parse(contentKey),
        locale,
      )
        .catch(() => ({ ok: false as const, error: "generic" }))
        .then((result) => {
          if (!cancelled && "html" in result) setHtml(result.html);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [contentKey, locale]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-petroleum-500 text-sm font-semibold">
          {t("preview")}
        </h3>
        <div className="bg-sand-100 flex rounded-full p-0.5 text-xs">
          {(["mobile", "desktop"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setWidth(option)}
              className={`rounded-full px-3 py-1 font-medium transition-colors ${
                width === option
                  ? "text-petroleum-700 bg-white shadow-sm"
                  : "text-petroleum-400"
              }`}
            >
              {option === "mobile" ? t("previewMobile") : t("previewDesktop")}
            </button>
          ))}
        </div>
      </div>
      <div className="border-sand-200 bg-sand-50 flex justify-center overflow-hidden rounded-2xl border p-3">
        {html === null ? (
          <div className="text-petroleum-400 flex h-160 items-center text-sm">
            {t("previewLoading")}
          </div>
        ) : (
          <iframe
            title={t("preview")}
            srcDoc={html}
            sandbox=""
            className="h-160 rounded-xl border-0 bg-white transition-[width]"
            style={{ width: width === "mobile" ? 375 : "100%" }}
          />
        )}
      </div>
    </div>
  );
}
