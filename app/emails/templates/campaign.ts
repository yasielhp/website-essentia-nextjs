import { Maily } from "@maily-to/render";
import type {
  CampaignLocale,
  CampaignLocaleContent,
  EmailDoc,
} from "@/types/campaign";
import { escapeHtml, renderVariables } from "@/lib/campaigns/body-html";
import { emptyDoc } from "@/lib/campaigns/doc";
import { emailBase } from "./_base";

/**
 * The email a campaign sends to one recipient.
 *
 * Same shell as every Essentia email — `emailBase`: sand background, white
 * card, the dark header with the logo, the footer with the centre's name and
 * address. Inside it, the body the admin built in the Maily editor: Maily
 * renders that document on its own and the inline-styled fragment it produces
 * is lifted out of its page and set into ours, so a campaign and a booking
 * confirmation are unmistakably the same sender.
 *
 * Variables come in two forms: Maily's own variable nodes, filled by the
 * renderer, and plain `{{first_name}}` text (what the templates and the
 * subject carry), filled afterwards on the HTML with the value escaped.
 */

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

/**
 * Maily's rendering of the body alone, as a fragment: the inner HTML of the
 * page it produces, minus React's stream markers. Everything in it is
 * inline-styled, so it needs nothing from Maily's `<head>`.
 */
export async function renderBodyFragment(
  doc: EmailDoc | null,
  vars: Record<string, string>,
): Promise<string> {
  const maily = new Maily((doc ?? emptyDoc()) as never);
  maily.setTheme(THEME as never);
  maily.setVariableValues(vars);
  maily.setShouldReplaceVariableValues(true);
  const page = await maily.render();

  const bodyAt = page.indexOf("<body");
  const open = bodyAt === -1 ? -1 : page.indexOf(">", bodyAt);
  const close = page.lastIndexOf("</body>");
  const inner =
    open === -1 || close === -1 ? page : page.slice(open + 1, close);
  // Only React's stream markers go; Outlook's `<!--[if mso]>` blocks stay,
  // they are how the buttons keep their padding there.
  return inner.replace(/<!--\/?\$-->|<!--(?:html|head|body)-->/g, "").trim();
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
  const footer = FOOTER[locale];

  // The name is already escaped by `renderVariables`; escaping the text first
  // and filling the token afterwards is what keeps the two from stacking.
  const title = renderVariables(escapeHtml(content.title), vars);
  const preheader = renderVariables(
    escapeHtml(content.preheader || content.title),
    vars,
  );
  const fragment = renderVariables(
    await renderBodyFragment(content.doc, vars),
    vars,
  );

  const body = `
        ${title ? `<h1 style="margin:0 0 20px;font-size:26px;font-weight:600;color:#103838;line-height:1.3;">${title}</h1>` : ""}
        ${fragment}`;

  // Under the address, in the footer every Essentia email already has.
  const footerExtra = `
              <p style="margin:12px 0 0;font-size:12px;color:#4a6767;line-height:1.6;">
                ${footer.reason}
                <a href="${escapeHtml(unsubscribeUrl)}" style="color:#335554;text-decoration:underline;">${footer.link}</a>
              </p>`;

  return {
    subject: renderVariables(content.subject, vars, { escape: false }),
    html: emailBase({ locale, preheader, body, footerExtra }),
  };
}
