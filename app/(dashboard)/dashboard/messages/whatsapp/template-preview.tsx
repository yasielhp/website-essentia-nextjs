"use client";

import { useState } from "react";
import { renderPreview } from "@/lib/whatsapp/templates";
import type { WhatsAppTemplateButton } from "@/lib/whatsapp/types";

/**
 * A WhatsApp bubble with the template filled in with its examples. A
 * placeholder with no example yet stays as `{{n}}`, which is the point: the
 * admin sees what is still missing.
 */
export function TemplatePreview({
  headerText,
  body,
  footerText,
  buttons,
  examples,
}: {
  headerText?: string | null;
  body: string;
  footerText?: string | null;
  buttons: WhatsAppTemplateButton[];
  examples: string[];
}) {
  // The time on a message is when it was sent; for a preview, now.
  const [now] = useState(() => new Date());
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-sand-100 rounded-2xl p-4">
      <div className="ml-auto max-w-[320px] rounded-xl rounded-tr-none bg-[#e7fed6] px-3 py-2 text-sm text-[#111b21] shadow-sm">
        {headerText ? (
          <p className="mb-1 font-semibold break-words">{headerText}</p>
        ) : null}
        <p className="break-words whitespace-pre-wrap">
          {renderPreview(body, examples)}
        </p>
        {footerText ? (
          <p className="mt-1 text-xs break-words text-[#667781]">
            {footerText}
          </p>
        ) : null}
        <p className="mt-1 text-right text-[11px] text-[#667781]">{time}</p>
      </div>
      {buttons.length > 0 && (
        <div className="mt-1 ml-auto flex max-w-[320px] flex-col gap-1">
          {buttons.map((button, i) => (
            <div
              key={i}
              className="rounded-xl bg-white px-3 py-2 text-center text-sm font-medium break-words text-[#027eb5] shadow-sm"
            >
              {button.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
