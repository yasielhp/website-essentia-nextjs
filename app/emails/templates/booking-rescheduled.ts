import { emailBase, bookingDetailsCard } from "./_base";

export function bookingRescheduledEmail({
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
    preheader: `Tu reserva de ${service} ha sido reprogramada al ${date}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Reserva reprogramada</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Tu reserva ha sido reprogramada, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Hemos actualizado la fecha y/o hora de tu sesión. Aquí tienes los nuevos detalles:
      </p>

      ${bookingDetailsCard({ service, date, time, duration })}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        Si esta fecha no te conviene, contáctanos y lo gestionamos.
      </p>
    `,
  });
}
