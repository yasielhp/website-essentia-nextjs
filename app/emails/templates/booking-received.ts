import { emailBase, bookingDetailsCard } from "./_base";

export function bookingReceivedEmail({
  name,
  service,
  date,
  time,
  duration,
}: {
  name: string;
  service: string;
  date: string;
  time: string;
  duration?: string | null;
}): string {
  return emailBase({
    preheader: `Hemos recibido tu solicitud de reserva para ${service} el ${date}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Solicitud recibida</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Gracias, ${name}. Hemos recibido tu solicitud.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Estamos revisando tu solicitud y te confirmaremos la reserva en breve. Si tienes alguna pregunta, no dudes en contactarnos.
      </p>

      ${bookingDetailsCard({ service, date, time, duration })}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        Si necesitas cancelar o modificar tu solicitud, contáctanos con al menos 24 horas de antelación.
      </p>
    `,
  });
}
