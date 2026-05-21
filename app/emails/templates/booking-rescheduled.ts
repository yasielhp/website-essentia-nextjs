import { emailBase, bookingDetailsCard } from "./_base";

export function bookingRescheduledEmail({
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
    preheader: `Your ${service} booking has been rescheduled to ${date}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Booking rescheduled</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        Your booking has been rescheduled, ${name}.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        We have updated the date and/or time of your session. Here are the new details:
      </p>

      ${bookingDetailsCard({ service, sessionType, date, time, duration })}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        If this date does not work for you, please call us at <strong style="color:#103838;">+34 683 240 986</strong> and we will be happy to help.
      </p>
    `,
  });
}
