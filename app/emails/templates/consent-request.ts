import { emailBase, consentBlock } from "./_base";

/** Asks a client to fill in their informed consent, with the link to do it. */
export function consentRequestEmail({
  name,
  url,
  locale = "es",
}: {
  name: string;
  url: string;
  locale?: "en" | "es";
}): string {
  const es = locale === "es";
  return emailBase({
    locale,
    preheader: es
      ? "Completa tu consentimiento informado antes de tu sesión."
      : "Please complete your informed consent before your session.",
    body: `
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        ${es ? `Hola, ${name}` : `Hello, ${name}`}
      </h1>
      <p style="margin:0;font-size:16px;color:#335554;line-height:1.6;">
        ${
          es
            ? "Para poder atenderte con seguridad necesitamos que completes tu consentimiento informado. Solo lo haces una vez."
            : "To look after you safely we need you to complete your informed consent. You only do it once."
        }
      </p>
      ${consentBlock(url, locale)}
    `,
  });
}
