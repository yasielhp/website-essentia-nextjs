import { contact } from "@/constants/contact";
import type { EmailDoc } from "@/types/campaign";
import { content, withOutro, type MessageDefaults } from "./_content";

/**
 * The closing sentence carries a `mailto:` link, which the plain-text block
 * syntax does not allow (it takes https links only), so its document is built
 * node by node.
 */
function closing(before: string, after: string): EmailDoc {
  return {
    type: "doc",
    content: [
      {
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
      },
    ],
  };
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
  es: withOutro(
    es,
    closing(
      "Para reservar tus sesiones con el bono, escríbenos a ",
      ` o llámanos al ${contact.phone}, y las acordamos contigo.`,
    ),
  ),
  en: withOutro(
    en,
    closing(
      "To book your sessions with the voucher, write to us at ",
      ` or call ${contact.phone}, and we will arrange them with you.`,
    ),
  ),
};
