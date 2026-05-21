import { Resend } from "resend";
import { createClient } from "@insforge/sdk";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

async function getAdminEmail(): Promise<string | null> {
  try {
    const adminClient = createClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_URL!,
      anonKey: process.env.INSFORGE_SERVICE_KEY!,
    });
    const { data } = await adminClient.database
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .limit(1)
      .single();
    return (data as { email: string | null } | null)?.email ?? null;
  } catch {
    return null;
  }
}

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!to.includes("@")) throw new Error("Invalid recipient address");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[sendEmail] RESEND_API_KEY not set — email skipped");
    return { error: null };
  }

  const resend = new Resend(apiKey);
  const from =
    process.env.RESEND_FROM_EMAIL ??
    "Essentia <noreply@essentiawellnessclub.com>";

  const adminBcc = await getAdminEmail();

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    ...(adminBcc && adminBcc !== to ? { bcc: adminBcc } : {}),
  });

  if (error) {
    console.error("[sendEmail] Failed to send to", to, ":", error.message);
  }

  return { error };
}
