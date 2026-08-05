import { emailBase } from "./_base";

const interestLabels: Record<string, string> = {
  membership: "Membership",
  wellness: "Wellness programmes",
  medicine: "Medicine protocols",
  community: "Community & events",
  other: "Something else",
};

/** Escapes the visitor's text: it lands in an HTML email unaltered otherwise. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function contactMessageEmail({
  firstName,
  lastName,
  email,
  interest,
  message,
}: {
  firstName: string;
  lastName: string;
  email: string;
  interest: string;
  message: string;
}): string {
  const name = `${firstName} ${lastName}`.trim();
  const rows: [string, string][] = [
    ["Name", escapeHtml(name)],
    [
      "Email",
      `<a href="mailto:${encodeURI(email)}" style="color:#335554;">${escapeHtml(email)}</a>`,
    ],
    ["Interested in", interestLabels[interest] ?? interest],
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
    preheader: `${name} wrote from the contact form about ${interestLabels[interest] ?? interest}.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Contact form</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        ${escapeHtml(name)} has written to you.
      </h1>
      <p style="margin:0 0 24px;font-size:16px;color:#335554;line-height:1.6;">
        Replying to this email answers ${escapeHtml(firstName)} directly.
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

      <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Message</p>
      <p style="margin:0;font-size:15px;color:#103838;line-height:1.6;white-space:pre-wrap;">${escapeHtml(message)}</p>
    `,
  });
}
