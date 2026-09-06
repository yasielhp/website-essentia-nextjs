import { Maily } from "@maily-to/render";
import type {
  CampaignLocale,
  CampaignLocaleContent,
  EmailDoc,
} from "@/types/campaign";
import { escapeHtml, renderVariables } from "@/lib/campaigns/body-html";
import { emptyDoc } from "@/lib/campaigns/doc";

/**
 * The email a campaign sends to one recipient.
 *
 * The body is what the admin built in the Maily editor; this wraps it in the
 * two things that are ours on every campaign — the logo at the top and, at
 * the bottom, the reason the recipient hears from us and the way out — and
 * hands the whole document to Maily's renderer, which knows how to turn it
 * into HTML every mail client agrees on.
 *
 * Variables come in two forms: Maily's own variable nodes, filled by the
 * renderer, and plain `{{first_name}}` text (what the templates and the
 * subject carry), filled afterwards on the HTML with the value escaped.
 */

const LOGO_URL = "https://www.essentiawellnessclub.com/logo-email.png";

const THEME = {
  colors: {
    heading: "#103838",
    paragraph: "#335554",
    horizontal: "#d7dbd9",
    footer: "#4a6767",
  },
  fontSize: {
    paragraph: "16px",
    footer: { size: "12px", lineHeight: "18px" },
  },
};

const FOOTER: Record<CampaignLocale, { reason: string; link: string }> = {
  es: {
    reason: "Recibes este email porque eres cliente de Essentia.",
    link: "Darse de baja",
  },
  en: {
    reason:
      "You are receiving this email because you are a client of Essentia.",
    link: "Unsubscribe",
  },
};

/** The house lines under every email, whatever the campaign says. */
const ADDRESS = [
  "Essentia — Longevity Center & Social Wellness Club, Tenerife",
  "Baobab Suites, Costa Adeje, Tenerife",
];

/**
 * The full document: the dark band with the logo that every Essentia email
 * opens with, the title, the admin's body, and the footer with the centre's
 * name and address and the way out.
 */
export function assembleDoc({
  content,
  unsubscribeUrl,
  locale,
}: {
  content: CampaignLocaleContent;
  unsubscribeUrl: string;
  locale: CampaignLocale;
}): EmailDoc {
  const body = content.doc ?? emptyDoc();
  const footer = FOOTER[locale];
  return {
    type: "doc",
    content: [
      {
        type: "section",
        attrs: {
          backgroundColor: "#103838",
          borderRadius: 16,
          borderWidth: 0,
          paddingTop: 24,
          paddingBottom: 24,
          paddingLeft: 32,
          paddingRight: 32,
          marginBottom: 24,
          align: "center",
        },
        content: [
          {
            type: "logo",
            attrs: {
              src: LOGO_URL,
              alt: "Essentia",
              size: "md",
              alignment: "center",
            },
          },
        ],
      },
      ...(content.title.trim()
        ? [
            {
              type: "heading",
              attrs: { level: 1 },
              content: [{ type: "text", text: content.title }],
            },
          ]
        : []),
      ...(body.content ?? []),
      { type: "horizontalRule" },
      {
        type: "footer",
        attrs: { textAlign: "left" },
        content: [
          { type: "text", text: ADDRESS[0]! },
          { type: "hardBreak" },
          { type: "text", text: ADDRESS[1]! },
          { type: "hardBreak" },
          { type: "hardBreak" },
          { type: "text", text: `${footer.reason} ` },
          {
            type: "text",
            text: footer.link,
            marks: [{ type: "link", attrs: { href: unsubscribeUrl } }],
          },
        ],
      },
    ],
  };
}

export async function campaignEmail({
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
}): Promise<{ subject: string; html: string }> {
  const vars: Record<string, string> = { ...extraVars, first_name: firstName };

  const maily = new Maily(
    assembleDoc({ content, unsubscribeUrl, locale }) as never,
  );
  maily.setTheme(THEME as never);
  maily.setVariableValues(vars);
  maily.setShouldReplaceVariableValues(true);
  const rendered = await maily.render();

  // The renderer escapes what it renders, so a plain-text token is filled
  // with an escaped value; the subject is plain text and takes the raw one.
  const html = renderVariables(rendered, vars);
  const preheader = renderVariables(content.preheader, vars, {
    escape: false,
  });

  return {
    subject: renderVariables(content.subject, vars, { escape: false }),
    html: preheader ? withPreheader(html, preheader) : html,
  };
}

/** Inbox apps show the first text they find; this puts the preheader there. */
function withPreheader(html: string, preheader: string): string {
  const hidden = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`;
  const at = html.indexOf("<body");
  if (at === -1) return html;
  const close = html.indexOf(">", at);
  return close === -1
    ? html
    : html.slice(0, close + 1) + hidden + html.slice(close + 1);
}
