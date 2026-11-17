import { contact } from "@/constants/contact";
import type { EmailDoc } from "@/types/campaign";
import { content, type MessageDefaults } from "./_content";

/**
 * The closing sentence carries a `mailto:` link, which the plain-text block
 * syntax does not allow (it takes https links only), so its document is built
 * node by node.
 */
function withMailto(
  doc: EmailDoc | null,
  before: string,
  after: string,
): EmailDoc | null {
  if (!doc?.content) return doc;
  const closing: EmailDoc = {
    type: "paragraph",
    content: [
      { type: "text", text: before },
      {
        type: "text",
        text: contact.email,
        marks: [
          {
            type: "link",
            attrs: { href: `mailto:${contact.email}`, target: "_blank" },
          },
        ],
      },
      { type: "text", text: after },
    ],
  };
  return { ...doc, content: [...doc.content, closing] };
}

const es = content(
  "Tu bono de {{sessions}} sesiones está confirmado",
  "Tu bono de {{sessions}} sesiones está confirmado.",
  "Gracias, {{first_name}}. Tu bono está confirmado.",
  ["Bono confirmado", "Ya tienes tu bono. Estos son sus datos."],
);
const en = content(
  "Your {{sessions}}-session voucher is confirmed",
  "Your {{sessions}}-session voucher is confirmed.",
  "Thank you, {{first_name}}. Your voucher is confirmed.",
  ["Voucher confirmed", "You now have your voucher. Here are its details."],
);

export const bonusPurchase: MessageDefaults = {
  es: {
    ...es,
    doc: withMailto(
      es.doc,
      "Para reservar tus sesiones con el bono, escríbenos a ",
      ` o llámanos al ${contact.phone}, y las acordamos contigo.`,
    ),
  },
  en: {
    ...en,
    doc: withMailto(
      en.doc,
      "To book your sessions with the voucher, write to us at ",
      ` or call ${contact.phone}, and we will arrange them with you.`,
    ),
  },
};
