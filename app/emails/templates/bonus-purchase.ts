import { emailBase } from "./_base";
import { contact } from "../../constants/contact";

/** The text goes into HTML, and part of it was typed by a stranger. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Confirms a bonus bought on the website: what was bought, what was paid and
 * until when it can be used. Says how to book with it without promising a
 * channel the site does not have: sessions with a bonus are arranged with the
 * centre.
 */
export function bonusPurchaseEmail({
  name,
  service,
  sessions,
  amount,
  expiresOn,
  locale = "es",
}: {
  name: string;
  /** The session type the bonus is for. */
  service: string;
  sessions: number;
  /** Already formatted for the reader, currency included. */
  amount: string;
  /** Already formatted for the reader. */
  expiresOn: string;
  locale?: "en" | "es";
}): string {
  const es = locale === "es";
  const rows: [string, string][] = es
    ? [
        ["Servicio", service],
        ["Sesiones", String(sessions)],
        ["Importe pagado", amount],
        ["Válido hasta", expiresOn],
      ]
    : [
        ["Service", service],
        ["Sessions", String(sessions)],
        ["Amount paid", amount],
        ["Valid until", expiresOn],
      ];

  const rowsHtml = rows
    .map(
      ([label, value], i) => `
        <tr>
          <td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;color:#4a6767;width:40%;">${esc(label)}</td>
          <td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;font-weight:500;color:#103838;">${esc(value)}</td>
        </tr>`,
    )
    .join("");

  const t = es
    ? {
        preheader: `Tu bono de ${sessions} sesiones está confirmado.`,
        kicker: "Bono confirmado",
        heading: `Gracias, ${esc(name)}. Tu bono está confirmado.`,
        intro: "Ya tienes tu bono. Estos son sus datos.",
        section: "Tu bono",
        how: `Para reservar tus sesiones con el bono, escríbenos a <a href="mailto:${contact.email}" style="color:#335554;">${contact.email}</a> o llámanos al ${contact.phone}, y las acordamos contigo.`,
      }
    : {
        preheader: `Your ${sessions}-session voucher is confirmed.`,
        kicker: "Voucher confirmed",
        heading: `Thank you, ${esc(name)}. Your voucher is confirmed.`,
        intro: "You now have your voucher. Here are its details.",
        section: "Your voucher",
        how: `To book your sessions with the voucher, write to us at <a href="mailto:${contact.email}" style="color:#335554;">${contact.email}</a> or call ${contact.phone}, and we will arrange them with you.`,
      };

  return emailBase({
    locale,
    preheader: t.preheader,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${t.kicker}</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">${t.heading}</h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">${t.intro}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${t.section}</p>
            <table width="100%" cellpadding="0" cellspacing="0">${rowsHtml}
            </table>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">${t.how}</p>
    `,
  });
}
