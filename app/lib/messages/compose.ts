import { defaultContent } from "@/emails/defaults";
import { emailBase } from "@/emails/templates/_base";
import { renderBodyFragment } from "@/emails/templates/campaign";
import { escapeHtml, renderVariables } from "@/lib/campaigns/body-html";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import {
  MESSAGE_CATALOG,
  type MessageKey,
  type MessageVariable,
} from "./catalog";

/**
 * What the admin saved for one message in one language: the part of a
 * `message_templates` row the email channel uses. `enabled` and the
 * `whatsapp_*` columns are read by the callers that need them, not here.
 */
export type MessageRow = {
  subject: string | null;
  preheader: string | null;
  title: string | null;
  doc: EmailDoc | null;
  enabled: boolean;
};

/**
 * What to do with a message right now.
 *
 * - `legacy`: nobody edited it, so the email that has always gone out goes out
 *   again, byte for byte.
 * - `custom`: the admin's version.
 * - `skip`: switched off. Only a message that `canDisable` can be: for every
 *   other one `enabled` is ignored, because a paid client must never be left
 *   without their email by a toggle.
 */
export type Delivery = "legacy" | "custom" | "skip";

export function chooseDelivery(
  key: MessageKey,
  row: MessageRow | null,
): Delivery {
  if (!row) return "legacy";
  if (!row.enabled && MESSAGE_CATALOG[key].canDisable) return "skip";
  // A row that only carries the switch (the reminder turned off and on again)
  // has no text of its own to send: the legacy email is still the right one.
  const edited =
    row.doc != null ||
    row.title != null ||
    row.preheader != null ||
    (row.subject ?? "").trim() !== "";
  return edited ? "custom" : "legacy";
}

export type MessageVars = Partial<Record<MessageVariable, string>>;

const H1_STYLE =
  "margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;";

/** The shell `booking_paid` has always been sent in: not the shared one. */
function paidShell({
  locale,
  preheader,
  body,
}: {
  locale: CampaignLocale;
  preheader: string;
  body: string;
}): string {
  const address = "C/ La Noria 14, Santa Cruz de Tenerife";
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Confirmed</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#f5f2ed;font-family:'DM Sans',sans-serif;">${
    preheader
      ? `
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>`
      : ""
  }
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7dbd9;">

          <!-- Header -->
          <tr>
            <td style="background-color:#103838;padding:24px 32px;text-align:center;">
              <span style="font-family:'DM Sans',sans-serif;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:4px;text-transform:uppercase;">ESSENTIA</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #d7dbd9;">
              <p style="margin:0;font-size:13px;color:#4a6767;line-height:1.5;">
                Essentia &mdash; Longevity Center &amp; Social Wellness Club, Tenerife<br />
                ${address}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The admin's version of a message, ready to send.
 *
 * Same shell as the email it replaces (`emailBase`, or `booking_paid`'s own),
 * the body the admin wrote, then the fixed blocks the code adds. Anything the
 * row leaves null falls back to the default text, so a half-filled row never
 * sends an empty subject.
 *
 * Variables are escaped into the HTML and only the ones this message offers
 * exist: a token the catalogue does not list comes out empty, as in campaigns,
 * and never throws.
 */
export async function composeMessageEmail({
  key,
  locale,
  row,
  vars,
  fixedHtml,
}: {
  key: MessageKey;
  locale: CampaignLocale;
  row: MessageRow;
  vars: MessageVars;
  fixedHtml: string;
}): Promise<{ subject: string; html: string }> {
  const fallback = defaultContent(key, locale);
  const offered = new Set<string>(MESSAGE_CATALOG[key].variables);
  const values: Record<string, string> = {};
  for (const [name, value] of Object.entries(vars)) {
    if (offered.has(name) && value != null) values[name] = value;
  }

  const subject =
    (row.subject ?? "").trim() !== "" ? row.subject! : fallback.subject;
  const rawTitle = row.title ?? fallback.title;
  const rawPreheader = row.preheader ?? fallback.preheader;
  const doc = row.doc ?? fallback.doc;

  const title = renderVariables(escapeHtml(rawTitle), values);
  const preheader = renderVariables(
    escapeHtml(rawPreheader || rawTitle),
    values,
  );
  // The paid confirmation has never had a preheader, so it only prints one the
  // admin wrote rather than borrowing the title.
  const paidPreheader = renderVariables(escapeHtml(rawPreheader), values);
  const fragment = renderVariables(
    await renderBodyFragment(doc, values),
    values,
  );

  const body = `
      ${title ? `<h1 style="${H1_STYLE}">${title}</h1>` : ""}
      ${fragment}
      ${fixedHtml}`;

  return {
    subject: renderVariables(subject, values, { escape: false }),
    html:
      key === "booking_paid"
        ? paidShell({ locale, preheader: paidPreheader, body })
        : emailBase({ locale, preheader, body }),
  };
}
