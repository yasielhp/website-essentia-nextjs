import { defaultContent } from "@/emails/defaults";
import { EMAIL_ADDRESS, emailBase } from "@/emails/templates/_base";
import { renderBodyFragment } from "@/emails/templates/campaign";
import { escapeHtml, renderVariables } from "@/lib/campaigns/body-html";
import { docIsEmpty } from "@/lib/campaigns/doc";
import type { CampaignLocale, EmailDoc } from "@/types/campaign";
import {
  SPECIAL_NODES,
  blockKindOf,
  convertOldShape,
  docTitle,
  isBlockNode,
  isTitleNode,
  repairForSending,
  titleText,
} from "./email-doc";
import { sameDoc } from "./editor-state";
import type { FixedBlocksByKind } from "./fixed-blocks";
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
  locale: CampaignLocale,
): Delivery {
  if (!row) return "legacy";
  // Strictly false: a null or an odd value in the column is not "off".
  if (row.enabled === false && MESSAGE_CATALOG[key].canDisable) return "skip";
  // A row that only carries the switch (the reminder turned off and on again)
  // has no text of its own to send: the legacy email is still the right one.
  // Nor has one whose document says exactly what the default says: saving the
  // default is not an edit.
  const edited =
    !sameDoc(effectiveDoc(key, locale, row), defaultContent(key, locale).doc) ||
    row.preheader != null ||
    (row.subject ?? "").trim() !== "";
  return edited ? "custom" : "legacy";
}

/**
 * The document of a row, whole: the saved one if it is in the current shape,
 * the one a row saved before the title and the blocks were in the document
 * converts to (`convertOldShape`), and the default one when the row has no body
 * of its own.
 */
export function effectiveDoc(
  key: MessageKey,
  locale: CampaignLocale,
  row: Pick<MessageRow, "title" | "doc">,
): EmailDoc {
  const fallback = defaultContent(key, locale);
  return convertOldShape({ title: row.title, doc: usableDoc(row.doc) }, key, {
    title: fallback.title,
    doc: fallback.doc,
  });
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
    (node) =>
      typeof node?.type === "string" &&
      (ALLOWED_NODES.has(node.type) || SPECIAL_NODES.has(node.type)),
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
 * and the body is the message's document, in the order it has: the editor's own
 * nodes are drawn by the renderer (sanitised first, a run at a time), the title
 * by the same style the email has always had, and each block by the code from
 * the booking's data (`blocks`, by kind). A block whose condition does not hold
 * prints nothing. Anything the row leaves null falls back to the default, so a
 * half-filled row never sends an empty subject. Nor does a subject that is
 * nothing once its variables are filled (`{{session_type}}` on a booking that
 * has none): the default subject goes out instead. The subject and the
 * preheader are always one line.
 *
 * A document that is missing what an email needs (a title, a block that cannot
 * be removed) is repaired before it is drawn (`repairForSending`): no email goes
 * out without them.
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
  blocks,
}: {
  key: MessageKey;
  locale: CampaignLocale;
  row: MessageRow;
  vars: MessageVars;
  /** The HTML of each block of the message, by kind (see `fixedBlocksByKind`). */
  blocks: FixedBlocksByKind;
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

  // The whole email, in the order it has, whatever shape the row was saved in.
  const doc = repairForSending(
    effectiveDoc(key, locale, row),
    key,
    fallback.title,
  );
  const titleNode = docTitle(doc);
  const fill = (raw: string) => renderVariables(escapeHtml(raw), values);
  // A title that comes out empty (a variable this booking has no value for, or
  // one saved before it was refused) is the message's own default title: an
  // email never goes out without its heading.
  let rawTitle = titleText(titleNode);
  let title = fill(rawTitle);
  if (title.trim() === "") {
    rawTitle = fallback.title;
    title = fill(rawTitle);
  }
  const rawPreheader = row.preheader ?? fallback.preheader;
  const preheader = oneLine(
    renderVariables(escapeHtml(rawPreheader || rawTitle), values),
  );
  // The paid confirmation has never had a preheader, so it only prints one the
  // admin wrote rather than borrowing the title.
  const paidPreheader = oneLine(
    renderVariables(escapeHtml(rawPreheader), values),
  );

  const fragment = async (nodes: EmailDoc[]): Promise<string> => {
    const clean = sanitizeDoc({ type: "doc", content: nodes }, values);
    if (docIsEmpty(clean)) return "";
    return renderVariables(await renderBodyFragment(clean, values), values);
  };

  // A run of the editor's own nodes is drawn together; the title and each block
  // are drawn where they stand.
  const pieces: string[] = [];
  let run: EmailDoc[] = [];
  const flush = async () => {
    if (run.length === 0) return;
    const html = await fragment(run);
    run = [];
    if (html !== "") pieces.push(html);
  };
  for (const node of doc.content ?? []) {
    if (isTitleNode(node)) {
      await flush();
      if (title) pieces.push(`<h1 style="${H1_STYLE}">${title}</h1>`);
    } else if (isBlockNode(node)) {
      await flush();
      const kind = blockKindOf(node);
      const html = kind
        ? (blocks as Record<string, string | undefined>)[kind]
        : "";
      if (html) pieces.push(html);
    } else {
      run.push(node);
    }
  }
  await flush();

  const body = `
      ${pieces.join("\n      ")}`;

  return {
    subject,
    html:
      key === "booking_paid"
        ? paidShell({ locale, preheader: paidPreheader, body })
        : emailBase({ locale, preheader, body }),
  };
}
