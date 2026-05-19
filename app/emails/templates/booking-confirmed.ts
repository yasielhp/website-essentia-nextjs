import { emailBase, bookingDetailsCard } from "./_base";

export function bookingConfirmedEmail({
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
    preheader: `Tu reserva de ${service} para el ${date} está confirmada.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Reserva confirmada</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Tu reserva está confirmada, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Estamos deseando verte. Aquí tienes los detalles de tu próxima sesión.
      </p>

      ${bookingDetailsCard({ service, date, time, duration })}

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td>
            <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Ubicación</p>
            <p style="margin:0;font-size:15px;color:#103838;line-height:1.5;">
              C/ La Noria 14<br />Santa Cruz de Tenerife
            </p>
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        Si necesitas cancelar o reprogramar, contáctanos con al menos 24 horas de antelación.
      </p>
    `,
  });
}
