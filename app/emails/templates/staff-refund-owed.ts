import { emailBase } from "./_base";

/**
 * To the office: a booking paid online was cancelled and its money has to be
 * returned by hand in the Redsys portal. Staff only and NOT editable (it is
 * not in the catalogue of Messages): it carries the order number, which is
 * what the portal asks for, and the link to the booking, where the refund is
 * marked as made once it is.
 */

export type RefundOwedSource = "client_link" | "dashboard" | "assistant";

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const COPY = {
  es: {
    kicker: "Reembolso pendiente",
    title: (amount: string, client: string) =>
      `Hay que devolver ${amount} a ${client}`,
    body: "Esta reserva se pagó online y se ha cancelado. Devuelve el importe desde el portal de Redsys con el número de pedido y, cuando esté hecho, márcala como reembolsada en la reserva.",
    late: "Se canceló dentro de las 24 horas previas: el equipo ha decidido devolverlo.",
    details: "Detalles",
    rows: {
      client: "Cliente",
      email: "Email",
      service: "Servicio",
      session: "Sesión",
      amount: "Importe a devolver",
      order: "Pedido Redsys",
      by: "Cancelada",
    },
    by: {
      client_link: "por el cliente, desde el enlace del correo",
      dashboard: "por el equipo, desde el panel",
      assistant: "por el equipo, desde un asistente",
    },
    noOrder: "sin número (búscalo por fecha e importe)",
    button: "Abrir la reserva",
    preheader: (amount: string, client: string) =>
      `Reembolso pendiente de ${amount} para ${client}.`,
  },
  en: {
    kicker: "Refund pending",
    title: (amount: string, client: string) =>
      `${amount} must be returned to ${client}`,
    body: "This booking was paid online and has been cancelled. Return the amount from the Redsys portal with the order number and, once done, mark it as refunded on the booking.",
    late: "It was cancelled within the last 24 hours: the team decided to refund it.",
    details: "Details",
    rows: {
      client: "Client",
      email: "Email",
      service: "Service",
      session: "Session",
      amount: "Amount to return",
      order: "Redsys order",
      by: "Cancelled",
    },
    by: {
      client_link: "by the client, from the email link",
      dashboard: "by the team, from the dashboard",
      assistant: "by the team, from an assistant",
    },
    noOrder: "no number (look it up by date and amount)",
    button: "Open the booking",
    preheader: (amount: string, client: string) =>
      `Refund pending of ${amount} for ${client}.`,
  },
} as const;

export function staffRefundOwedEmail({
  locale = "es",
  clientName,
  clientEmail,
  service,
  session,
  amount,
  orderId,
  source,
  late,
  bookingUrl,
}: {
  locale?: "es" | "en";
  clientName: string;
  clientEmail: string | null;
  service: string;
  /** Date and hour, already written out. */
  session: string;
  /** Already formatted, e.g. `100,00 €`. */
  amount: string;
  orderId: string | null;
  source: RefundOwedSource;
  /** Cancelled inside the last 24 hours and refunded by the team's choice. */
  late: boolean;
  bookingUrl: string;
}): string {
  const c = COPY[locale];
  const rows: [string, string][] = [
    [c.rows.client, clientName],
    ...(clientEmail ? [[c.rows.email, clientEmail] as [string, string]] : []),
    [c.rows.service, service],
    [c.rows.session, session],
    [c.rows.amount, amount],
    [c.rows.order, orderId ?? c.noOrder],
    [c.rows.by, c.by[source]],
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

  return emailBase({
    locale,
    preheader: esc(c.preheader(amount, clientName)),
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${esc(c.kicker)}</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        ${esc(c.title(amount, clientName))}
      </h1>
      <p style="margin:0 0 ${late ? "12px" : "24px"};font-size:16px;color:#335554;line-height:1.6;">
        ${esc(c.body)}
      </p>${
        late
          ? `
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        ${esc(c.late)}
      </p>`
          : ""
      }

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${esc(c.details)}</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
            </table>
          </td>
        </tr>
      </table>

      <a href="${esc(bookingUrl)}"
         style="display:inline-block;background-color:#103838;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        ${esc(c.button)}
      </a>
    `,
  });
}
