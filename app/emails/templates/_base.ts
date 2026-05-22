/** Shared HTML shell for all Essentia transactional emails. */
export function emailBase({
  preheader,
  body,
  locale = "en",
}: {
  preheader: string;
  body: string;
  locale?: "en" | "es";
}): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Essentia</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#f5f2ed;font-family:'DM Sans',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d7dbd9;">

          <!-- Header -->
          <tr>
            <td style="background-color:#103838;padding:24px 32px;text-align:center;">
              <img src="https://www.essentiawellnessclub.com/logo-email.png" alt="Essentia" width="200" style="display:block;margin:0 auto;height:auto;border:0;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #d7dbd9;">
              <p style="margin:0;font-size:13px;color:#4a6767;line-height:1.5;">
                Essentia &mdash; Longevity Center &amp; Social Wellness Club, Tenerife<br />
                Baobab Suites, Costa Adeje, Tenerife
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

/** Renders the booking details card (service / session type / date / time / duration). */
export function bookingDetailsCard({
  service,
  sessionType,
  date,
  time,
  duration,
  locale = "en",
}: {
  service: string;
  sessionType?: string | null;
  date: string;
  time: string;
  duration?: string | null;
  locale?: "en" | "es";
}): string {
  const t =
    locale === "es"
      ? {
          sectionLabel: "Detalles de la sesión",
          service: "Servicio",
          sessionType: "Tipo de sesión",
          date: "Fecha",
          time: "Hora",
          duration: "Duración",
        }
      : {
          sectionLabel: "Session details",
          service: "Service",
          sessionType: "Session type",
          date: "Date",
          time: "Time",
          duration: "Duration",
        };

  const rows: [string, string][] = [
    [t.service, service],
    ...(sessionType ? [[t.sessionType, sessionType] as [string, string]] : []),
    [t.date, date],
    [t.time, time],
    ...(duration ? [[t.duration, duration] as [string, string]] : []),
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

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
    <tr>
      <td style="padding:20px 24px;">
        <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">${t.sectionLabel}</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${rowsHtml}
        </table>
      </td>
    </tr>
  </table>`;
}
