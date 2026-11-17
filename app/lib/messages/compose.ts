import { defaultContent } from "@/emails/defaults";
import { EMAIL_ADDRESS, emailBase } from "@/emails/templates/_base";
import { renderBodyFragment } from "@/emails/templates/campaign";
import { escapeHtml, renderVariables } from "@/lib/campaigns/body-html";
import { docIsEmpty } from "@/lib/campaigns/doc";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import { OUTRO_MARKER } from "./fixed-blocks";
import { ALLOWED_NODES, sanitizeDoc } from "./safe-doc";
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
  // Strictly false: a null or an odd value in the column is not "off".
  if (row.enabled === false && MESSAGE_CATALOG[key].canDisable) return "skip";
  // A row that only carries the switch (the reminder turned off and on again)
  // has no text of its own to send: the legacy email is still the right one.
  const edited =
    usableDoc(row.doc) != null ||
    row.title != null ||
    row.preheader != null ||
    (row.subject ?? "").trim() !== "";
  return edited ? "custom" : "legacy";
}

/**
 * The body document of a row, or null when it does not hold one worth sending:
 * not a document at all (a string, `{}`, an array), or one with nothing in it.
 * Such a row's body is "not edited" and the default one is used.
 */
export function usableDoc(doc: unknown): EmailDoc | null {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) {
    return null;
  }
  const candidate = doc as EmailDoc;
  if (candidate.type !== "doc" || !Array.isArray(candidate.content)) {
    return null;
  }
  if (
    candidate.content.some((node) => typeof node !== "object" || node === null)
  ) {
    return null;
  }
  // Nothing the renderer would draw (only unknown nodes, say) is not a body.
  const drawable = candidate.content.some(
    (node) => typeof node?.type === "string" && ALLOWED_NODES.has(node.type),
  );
  return drawable && !docIsEmpty(candidate) ? candidate : null;
}

export type MessageVars = Partial<Record<MessageVariable, string>>;

// Every control character and Unicode's own line and paragraph separators.
const BREAKS = /[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g;

/**
 * A text as one line: line breaks, tabs and the like become a space, runs of
 * spaces become one, the ends are trimmed. The subject is a mail header and
 * the variables in it come from what a client typed, so it is cleaned AFTER
 * they are filled in.
 */
export const oneLine = (text: string): string =>
  text.replace(BREAKS, " ").replace(/ {2,}/g, " ").trim();

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
                ${EMAIL_ADDRESS}
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
 * sends an empty subject. Nor does a subject that is nothing once its
 * variables are filled (`{{session_type}}` on a booking that has none): the
 * default subject goes out instead. The subject and the preheader are always
 * one line.
 *
 * THROWS when even the default subject comes out empty (none does today):
 * `renderMessageEmail` turns that into `legacy`, never into an email with no
 * subject.
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

  const filledSubject = (raw: string) =>
    oneLine(renderVariables(raw, values, { escape: false }));
  const subject =
    filledSubject(row.subject ?? "") || filledSubject(fallback.subject);
  if (subject === "") {
    throw new Error(`[messages] ${key}/${locale}: the subject is empty`);
  }
  const rawTitle = row.title ?? fallback.title;
  const rawPreheader = row.preheader ?? fallback.preheader;
  const title = renderVariables(escapeHtml(rawTitle), values);
  const preheader = oneLine(
    renderVariables(escapeHtml(rawPreheader || rawTitle), values),
  );
  // The paid confirmation has never had a preheader, so it only prints one the
  // admin wrote rather than borrowing the title.
  const paidPreheader = oneLine(
    renderVariables(escapeHtml(rawPreheader), values),
  );

  const fragment = async (doc: EmailDoc | null): Promise<string> =>
    doc
      ? renderVariables(
          await renderBodyFragment(sanitizeDoc(doc, values), values),
          values,
        )
      : "";

  // The fixed blocks carry a marker where the legacy email prints its closing
  // sentence. Without a body of the admin's own the default intro, the blocks
  // and the default closing go out in the legacy order. With one, their
  // document goes first, whole (its closing included), and then the blocks.
  const at = fixedHtml.indexOf(OUTRO_MARKER);
  const blocksBefore = at === -1 ? fixedHtml : fixedHtml.slice(0, at);
  const blocksAfter =
    at === -1 ? "" : fixedHtml.slice(at + OUTRO_MARKER.length);
  // The admin's body, if what is left of it after sanitising is worth sending.
  const sanitised = usableDoc(row.doc);
  const edited =
    sanitised && !docIsEmpty(sanitizeDoc(sanitised, values)) ? sanitised : null;
  const content = edited
    ? `${await fragment(edited)}
      ${blocksBefore}
      ${blocksAfter}`
    : `${await fragment(fallback.intro)}
      ${blocksBefore}
      ${await fragment(fallback.outro)}
      ${blocksAfter}`;

  const body = `
      ${title ? `<h1 style="${H1_STYLE}">${title}</h1>` : ""}
      ${content}`;

  return {
    subject,
    html:
      key === "booking_paid"
        ? paidShell({ locale, preheader: paidPreheader, body })
        : emailBase({ locale, preheader, body }),
  };
}
