import { emailBase, bookingDetailsCard } from "./_base";

/**
 * To the client: her payment arrived, but the hour she had chosen was taken by
 * another booking before hers was confirmed (it was still a form in progress,
 * or it had been released for not being paid in time). Nothing is lost: the
 * centre calls her to find another hour or returns the money.
 *
 * A system message for a rare case, NOT in the catalogue of Messages: it must
 * go out whatever an edited message says, because the client has paid and
 * has no booking.
 */
export function bookingSlotTakenEmail({
  name,
  service,
  date,
  time,
  duration,
  amount,
  locale = "es",
}: {
  name: string;
  service: string;
  /** Already written out for the client. */
  date: string;
  time: string;
  duration?: string | null;
  /** Already formatted, e.g. `81,00 €`. */
  amount: string;
  locale?: "es" | "en";
}): string {
  const esc = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const card = bookingDetailsCard({
    service: esc(service),
    date: esc(date),
    time: esc(time),
    duration: duration ? esc(duration) : null,
    locale,
  });
  const copy =
    locale === "en"
      ? {
          preheader: `We received your payment of ${amount}; we will call you about the hour.`,
          kicker: "Payment received",
          title: `${esc(name)}, we received your payment, but that hour was just taken`,
          body: `We received your payment of <strong>${esc(amount)}</strong>, but before your booking was confirmed another booking took that hour with the same professional. You have lost nothing: we will contact you shortly to offer you another hour or, if you prefer, return the full amount.`,
          close:
            "If you would rather write to us first, just reply to this email.",
        }
      : {
          preheader: `Hemos recibido tu pago de ${amount}; te llamaremos por la hora.`,
          kicker: "Pago recibido",
          title: `${esc(name)}, hemos recibido tu pago, pero esa hora se acaba de ocupar`,
          body: `Hemos recibido tu pago de <strong>${esc(amount)}</strong>, pero antes de que se confirmara tu reserva otra reserva ocupó esa hora con la misma profesional. No has perdido nada: nos pondremos en contacto contigo muy pronto para ofrecerte otra hora o, si lo prefieres, devolverte el importe íntegro.`,
          close: "Si prefieres escribirnos antes, responde a este correo.",
        };
  return emailBase({
    locale,
    preheader: esc(copy.preheader),
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${copy.kicker}</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        ${copy.title}
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        ${copy.body}
      </p>

      ${card}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        ${copy.close}
      </p>
    `,
  });
}
