import {
  emailBase,
  bookingDetailsCard,
  googleCalendarUrl,
  calendarButton,
} from "./_base";

export function bookingConfirmedEmail({
  name,
  service,
  sessionType,
  date,
  time,
  duration,
  dateIso,
  locale = "en",
}: {
  name: string;
  service: string;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  dateIso?: string;
  locale?: "en" | "es";
}): string {
  const calBtn = dateIso
    ? calendarButton(
        googleCalendarUrl({
          dateIso,
          time,
          service,
          duration,
          location: "Baobab Suites, Costa Adeje, Tenerife",
        }),
        locale,
      )
    : "";
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
                Baobab Suites<br />Costa Adeje, Tenerife
              </p>
            </td>
          </tr>
        </table>

        ${calBtn}

        <p style="margin:${calBtn ? "20px" : "0"} 0 0;font-size:14px;color:#4a6767;line-height:1.6;">
          Si necesitas cancelar o cambiar la fecha, por favor contáctanos con al menos 24 horas de antelación.
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
              Baobab Suites<br />Costa Adeje, Tenerife
            </p>
          </td>
        </tr>
      </table>

      ${calBtn}

      <p style="margin:${calBtn ? "20px" : "0"} 0 0;font-size:14px;color:#4a6767;line-height:1.6;">
        If you need to cancel or reschedule, please contact us at least 24 hours before your session.
      </p>
    `,
  });
}
