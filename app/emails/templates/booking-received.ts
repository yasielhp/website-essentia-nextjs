import { emailBase, bookingDetailsCard } from "./_base";

export function bookingReceivedEmail({
  name,
  service,
  sessionType,
  date,
  time,
  duration,
  locale = "en",
}: {
  name: string;
  service: string;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  locale?: "en" | "es";
}): string {
  if (locale === "es") {
    return emailBase({
      locale,
      preheader: `Hemos recibido tu solicitud de reserva para ${service} el ${date}.`,
      body: `
        <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Solicitud recibida</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
          Gracias, ${name}. Hemos recibido tu solicitud.
        </h1>
        <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
          Estamos revisando tu solicitud y confirmaremos tu reserva en breve. Si tienes alguna pregunta, no dudes en contactarnos.
        </p>

        ${bookingDetailsCard({ service, sessionType, date, time, duration, locale })}

        <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
          Si necesitas cancelar o modificar tu solicitud, por favor contáctanos con al menos 24 horas de antelación.
        </p>
      `,
    });
  }

  return emailBase({
    locale,
    preheader: `We have received your booking request for ${service} on ${date}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Request received</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Thank you, ${name}. We have received your request.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        We are reviewing your request and will confirm your booking shortly. If you have any questions, feel free to contact us.
      </p>

      ${bookingDetailsCard({ service, sessionType, date, time, duration, locale })}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        If you need to cancel or modify your request, please contact us at least 24 hours in advance.
      </p>
    `,
  });
}
