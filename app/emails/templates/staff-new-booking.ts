import { emailBase } from "./_base";

export function staffNewBookingEmail({
  clientName,
  clientEmail,
  clientPhone,
  service,
  date,
  time,
  duration,
  bookingId,
  dashboardUrl,
}: {
  clientName: string;
  clientEmail: string;
  clientPhone?: string | null;
  service: string;
  date: string;
  time: string;
  duration?: string | null;
  bookingId: string;
  dashboardUrl: string;
}): string {
  const rows: [string, string][] = [
    ["Cliente", clientName],
    ["Email", clientEmail],
    ...(clientPhone ? [["Teléfono", clientPhone] as [string, string]] : []),
    ["Servicio", service],
    ["Fecha", date],
    ["Hora", time],
    ...(duration ? [["Duración", duration] as [string, string]] : []),
  ];

  const rowsHtml = rows
    .map(
      ([label, value], i) => `
    <tr>
      <td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;color:#4a6767;width:40%;">${label}</td>
      <td style="padding:6px 0;${i < rows.length - 1 ? "border-bottom:1px solid #d7dbd9;" : ""}font-size:14px;font-weight:500;color:#103838;">${value}</td>
    </tr>`,
    )
    .join("");

  return emailBase({
    preheader: `Nueva solicitud de reserva de ${clientName} para ${service} el ${date}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Nueva reserva</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Nueva solicitud de reserva recibida.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Has recibido una nueva solicitud de reserva. Revísala y confírmala desde el panel de administración.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Detalles</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
            </table>
          </td>
        </tr>
      </table>

      <a href="${dashboardUrl}/dashboard/bookings/${bookingId}"
         style="display:inline-block;background-color:#103838;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        Ver reserva en el panel
      </a>
    `,
  });
}
