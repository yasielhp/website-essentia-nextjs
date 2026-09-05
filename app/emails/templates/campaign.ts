import type {
  CampaignLocale,
  CampaignLocaleContent,
  ContentBlock,
} from "@/types/campaign";
import {
  bodyToHtml,
  escapeHtml,
  renderVariables,
} from "@/lib/campaigns/body-html";
import { emailBase } from "./_base";

/**
 * The email a campaign sends to one recipient.
 *
 * Unlike the booking templates, the words here are the admin's, typed into the
 * dashboard as a stack of blocks, so every field is escaped before it meets
 * the shell — paragraph text goes through `bodyToHtml`, which knows the three
 * constructs it may carry. Only the footer is ours: the reason the recipient
 * hears from us and the way out, present on every campaign whatever the admin
 * writes.
 */
export function campaignEmail({
  content,
  firstName,
  vars: extraVars,
  unsubscribeUrl,
  locale,
}: {
  content: CampaignLocaleContent;
  firstName: string;
  /** Per-send values beyond the name: a blog post's title and link, say. */
  vars?: Record<string, string>;
  unsubscribeUrl: string;
  locale: CampaignLocale;
}): { subject: string; html: string } {
  const vars: Record<string, string> = { ...extraVars, first_name: firstName };
  // The name is already escaped by `renderVariables`; escaping the text first
  // and filling the token afterwards is what keeps the two from stacking.
  const title = renderVariables(escapeHtml(content.title), vars);
  const preheader = renderVariables(
    escapeHtml(content.preheader || content.title),
    vars,
  );

  const body = `
        <h1 style="margin:0 0 20px;font-size:26px;font-weight:600;color:#103838;line-height:1.3;">${title}</h1>
        ${content.blocks.map((block) => renderBlock(block, vars)).join("\n")}
        ${footer(unsubscribeUrl, locale)}
      `;

  return {
    subject: renderVariables(content.subject, vars, { escape: false }),
    html: emailBase({ locale, preheader, body }),
  };
}

/** One block, as email HTML. Unknown shapes render nothing rather than throw. */
export function renderBlock(
  block: ContentBlock,
  vars: Record<string, string>,
): string {
  switch (block.type) {
    case "paragraph":
      return renderVariables(bodyToHtml(block.text), vars);
    case "heading":
      return `<h2 style="margin:24px 0 12px;font-size:20px;font-weight:600;color:#103838;line-height:1.3;">${renderVariables(escapeHtml(block.text), vars)}</h2>`;
    case "image":
      return image(block.url, block.alt);
    case "button":
      return button(block.text, block.url);
    case "divider":
      return `<hr style="border:0;border-top:1px solid #d7dbd9;margin:24px 0;" />`;
    default:
      return "";
  }
}

function image(url: string, alt: string): string {
  if (!url) return "";
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:12px;margin:0 0 24px;" />`;
}

// A label without a link, or a link without a label, is a half-filled form,
// not a button; the email simply goes out without one.
function button(text: string, url: string): string {
  if (!text || !url) return "";
  return `
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
          <tr>
            <td align="center">
              <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
                 style="display:inline-block;padding:14px 32px;background-color:#103838;color:#f0ede6;text-decoration:none;border-radius:999px;font-size:15px;font-weight:500;letter-spacing:0.02em;">
                ${escapeHtml(text)}
              </a>
            </td>
          </tr>
        </table>`;
}

function footer(unsubscribeUrl: string, locale: CampaignLocale): string {
  const copy =
    locale === "es"
      ? {
          reason: "Recibes este email porque eres cliente de Essentia.",
          link: "Darse de baja",
        }
      : {
          reason:
            "You are receiving this email because you are a client of Essentia.",
          link: "Unsubscribe",
        };
  return `
        <p style="margin:32px 0 0;font-size:12px;color:#4a6767;line-height:1.6;">
          ${copy.reason}
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#335554;text-decoration:underline;">${copy.link}</a>
        </p>`;
}
