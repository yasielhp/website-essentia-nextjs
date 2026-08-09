import {
  emailBase,
  bookingDetailsCard,
  googleCalendarUrl,
  calendarButton,
  cancellationLink,
} from "./_base";

/**
 * The nudge two days out.
 *
 * Its job is not to be read for pleasure: it is the last comfortable moment to
 * cancel, which is why the link is here and why it goes out before the
 * 24-hour window closes. A freed slot two days ahead can still be sold; a
 * no-show cannot.
 */
export function bookingReminderEmail({
  name,
  service,
  sessionType,
  date,
  time,
  duration,
  dateIso,
  cancelUrl,
  locale = "en",
}: {
  name: string;
  service: string;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  dateIso?: string;
  cancelUrl?: string | null;
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
  const cancelBlock = cancelUrl ? cancellationLink(cancelUrl, locale) : "";

  if (locale === "es") {
    return emailBase({
      locale,
      preheader: `Tu sesión de ${service} es el ${date} a las ${time}.`,
      body: `
        <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Tu próxima sesión</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
          Te esperamos pronto, ${name}.
        </h1>
        <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
          Un recordatorio de tu cita. Ven con ropa cómoda y, si puedes, llega cinco minutos antes.
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
        ${cancelBlock}
      `,
    });
  }

  return emailBase({
    locale,
    preheader: `Your ${service} session is on ${date} at ${time}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Your next session</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        See you soon, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        A reminder of your appointment. Wear something comfortable and, if you can, arrive five minutes early.
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
      ${cancelBlock}
    `,
  });
}
