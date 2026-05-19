import { emailBase, bookingDetailsCard } from "./_base";

export function bookingCancelledEmail({
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
    preheader: `Tu reserva de ${service} del ${date} ha sido cancelada.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Reserva cancelada</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Tu reserva ha sido cancelada, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Tu reserva ha sido cancelada. Si crees que esto es un error o deseas hacer una nueva reserva, contáctanos o visita nuestra web.
      </p>

      ${bookingDetailsCard({ service, date, time, duration })}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        Lamentamos los inconvenientes. Esperamos poder atenderte pronto.
      </p>
    `,
  });
}
