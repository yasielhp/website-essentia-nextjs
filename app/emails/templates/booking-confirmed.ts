import {
  emailBase,
  bookingDetailsCard,
  googleCalendarUrl,
  calendarButton,
  cancellationLink,
  consentBlock,
  EMAIL_ADDRESS,
} from "./_base";

export function bookingConfirmedEmail({
  name,
  service,
  sessionType,
  date,
  time,
  duration,
  dateIso,
  cancelUrl,
  consentUrl,
  locale = "en",
}: {
  name: string;
  service: string;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  dateIso?: string;
  /** Link that cancels this booking without signing in. */
  cancelUrl?: string | null;
  /** Where a client who has not signed yet fills in their consent. */
  consentUrl?: string | null;
  locale?: "en" | "es";
}): string {
  const calBtn = dateIso
    ? calendarButton(
        googleCalendarUrl({
          dateIso,
          time,
          service,
          duration,
          location: EMAIL_ADDRESS,
        }),
        locale,
      )
    : "";
  const cancelBlock = cancelUrl ? cancellationLink(cancelUrl, locale) : "";
  if (locale === "es") {
    return emailBase({
      locale,
      preheader: `Tu reserva de ${service} el ${date} ha sido confirmada.`,
      body: `
        <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Reserva confirmada</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
          Tu reserva ha sido confirmada, ${name}.
        </h1>
        <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
          Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión.
        </p>

        ${bookingDetailsCard({ service, sessionType, date, time, duration, locale })}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Ubicación</p>
              <p style="margin:0;font-size:15px;color:#103838;line-height:1.5;">
                Rambla de Santa Cruz, 83<br />38004 Santa Cruz de Tenerife
              </p>
            </td>
          </tr>
        </table>

        ${calBtn}
        ${consentBlock(consentUrl, locale)}
        ${cancelBlock}

        <p style="margin:${calBtn ? "20px" : "0"} 0 0;font-size:14px;color:#4a6767;line-height:1.6;">
          Para cambiar o cancelar tu cita, escríbenos hasta 24 horas antes de la sesión; si la cancelas, te devolvemos el importe pagado. Dentro de las 24 horas previas, o si no acudes, no hay reembolso.
        </p>
      `,
    });
  }

  return emailBase({
    locale,
    preheader: `Your ${service} booking on ${date} is confirmed.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Booking confirmed</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Your booking is confirmed, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        We look forward to seeing you. Here are the details of your upcoming session.
      </p>

      ${bookingDetailsCard({ service, sessionType, date, time, duration, locale })}

        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
          <tr>
            <td>
              <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Location</p>
              <p style="margin:0;font-size:15px;color:#103838;line-height:1.5;">
                Rambla de Santa Cruz, 83<br />38004 Santa Cruz de Tenerife
              </p>
            </td>
          </tr>
        </table>

      ${calBtn}
      ${consentBlock(consentUrl, locale)}
      ${cancelBlock}

      <p style="margin:${calBtn ? "20px" : "0"} 0 0;font-size:14px;color:#4a6767;line-height:1.6;">
        To change or cancel your appointment, write to us up to 24 hours before the session; if you cancel, we refund what you paid. Within the last 24 hours, or if you do not turn up, there is no refund.
      </p>
    `,
  });
}
