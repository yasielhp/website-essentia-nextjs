export function welcomeMemberEmail({
  name,
  email,
  tempPassword,
}: {
  name: string;
  email: string;
  tempPassword: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Essentia</title>
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
              <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Membership Active</p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
                Welcome to Essentia, ${name}
              </h1>
              <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
                Your membership is now active. You now have access to your member area, where you can book sessions, explore our wellness programmes, and manage your profile.
              </p>

              <!-- Credentials box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f2ed;border-radius:8px;border:1px solid #d7dbd9;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Your access credentials</p>
                    <p style="margin:0 0 6px;font-size:15px;color:#103838;">
                      <strong>Email:</strong>&nbsp;${email}
                    </p>
                    <p style="margin:0;font-size:15px;color:#103838;">
                      <strong>Password:</strong>&nbsp;${tempPassword}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:14px;color:#4a6767;line-height:1.6;">
                For security, please change your password after your first login.
              </p>

              <!-- CTA button -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background-color:#103838;">
                    <a href="https://essentia.club/sign-in" style="display:inline-block;padding:12px 24px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Access your member area
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #d7dbd9;">
              <p style="margin:0;font-size:13px;color:#4a6767;line-height:1.5;">
                Essentia &mdash; Longevity Center &amp; Social Wellness Club, Tenerife<br />
                If you did not request this membership, please contact us immediately.
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
