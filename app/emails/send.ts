import { insforge } from "@/lib/insforge";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail({ to, subject, html }: SendEmailParams) {
  return insforge.emails.send({ to, subject, html });
}
