import { emailBase, bookingDetailsCard } from "./_base";

export function bookingCancelledEmail({
  name,
  service,
  sessionType,
  date,
  time,
  duration,
}: {
  name: string;
  service: string;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
}): string {
  return emailBase({
    preheader: `Your ${service} booking on ${date} has been cancelled.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Booking cancelled</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Your booking has been cancelled, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Your booking has been cancelled. If you believe this is a mistake or would like to make a new reservation, please contact us.
      </p>

      ${bookingDetailsCard({ service, sessionType, date, time, duration })}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        To reschedule or for any enquiries, please call us at <strong style="color:#103838;">+34 683 240 986</strong> at least 24 hours in advance. We hope to welcome you soon.
      </p>
    `,
  });
}
