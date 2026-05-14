export function bookingConfirmationEmail({
  name,
  serviceName,
  date,
  time,
  duration,
}: {
  name: string;
  serviceName: string;
  date: string;
  time: string;
  duration: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Booking Confirmed</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#f5f2ed;font-family:'DM Sans',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7dbd9;">

          <!-- Header -->
          <tr>
            <td style="background-color:#103838;padding:24px 32px;text-align:center;">
              <span style="font-family:'DM Sans',sans-serif;font-size:18px;font-weight:600;color:#ffffff;letter-spacing:4px;text-transform:uppercase;">ESSENTIA</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Booking Confirmed</p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
                Your booking is confirmed, ${name}
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
                We look forward to seeing you. Here are the details of your upcoming session.
              </p>

              <!-- Booking details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Session details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;color:#4a6767;width:40%;">Service</td>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;font-weight:500;color:#103838;">${serviceName}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;color:#4a6767;">Date</td>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;font-weight:500;color:#103838;">${date}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;color:#4a6767;">Time</td>
                        <td style="padding:6px 0;border-bottom:1px solid #d7dbd9;font-size:14px;font-weight:500;color:#103838;">${time}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:14px;color:#4a6767;">Duration</td>
                        <td style="padding:6px 0;font-size:14px;font-weight:500;color:#103838;">${duration}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Location -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="padding:0;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Location</p>
                    <p style="margin:0;font-size:15px;color:#103838;line-height:1.5;">
                      C/ La Noria 14<br />
                      Santa Cruz de Tenerife
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
                If you need to cancel or reschedule, please contact us at least 24 hours before your session.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #d7dbd9;">
              <p style="margin:0;font-size:13px;color:#4a6767;line-height:1.5;">
                Essentia &mdash; Longevity Center &amp; Social Wellness Club, Tenerife<br />
                C/ La Noria 14, Santa Cruz de Tenerife
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
