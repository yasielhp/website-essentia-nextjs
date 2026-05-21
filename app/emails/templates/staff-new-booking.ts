import { emailBase } from "./_base";

export function staffNewBookingEmail({
  clientName,
  clientEmail,
  clientPhone,
  service,
  sessionType,
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
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  bookingId: string;
  dashboardUrl: string;
}): string {
  const rows: [string, string][] = [
    ["Client", clientName],
    ["Email", clientEmail],
    ...(clientPhone ? [["Phone", clientPhone] as [string, string]] : []),
    ["Service", service],
    ...(sessionType ? [["Session type", sessionType] as [string, string]] : []),
    ["Date", date],
    ["Time", time],
    ...(duration ? [["Duration", duration] as [string, string]] : []),
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
    preheader: `New booking request from ${clientName} for ${service} on ${date}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">New booking</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        New booking request received.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        You have received a new booking request. Review it and confirm it from the dashboard.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
        <tr>
          <td style="padding:20px 24px;">
            <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Details</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${rowsHtml}
            </table>
          </td>
        </tr>
      </table>

      <a href="${dashboardUrl}/dashboard/bookings/${bookingId}"
         style="display:inline-block;background-color:#103838;color:#ffffff;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        View booking in dashboard
      </a>
    `,
  });
}
