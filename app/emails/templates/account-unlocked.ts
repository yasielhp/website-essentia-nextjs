import { emailBase } from "./_base";

/**
 * The receipt for an unlock.
 *
 * Short and deliberately without a link. Its whole job is to reach the account
 * holder if somebody else followed the one in the lock email — a confirmation
 * they did not expect is the signal that the mailbox itself is compromised.
 */
export function accountUnlockedEmail({
  name,
  time,
  locale = "en",
}: {
  name: string;
  /** Already formatted for the recipient's locale. */
  time: string;
  locale?: "en" | "es";
}): string {
  if (locale === "es") {
    return emailBase({
      locale,
      preheader: "Tu cuenta vuelve a estar disponible.",
      body: `
        <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Cuenta desbloqueada</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
          Ya puedes entrar, ${name}.
        </h1>
        <p style="margin:0 0 16px;font-size:16px;color:#335554;line-height:1.6;">
          Tu cuenta se desbloqueó a las ${time} y vuelve a estar disponible con tu contraseña de siempre.
        </p>
        <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
          Si no has sido tú quien la ha desbloqueado, cambia la contraseña ahora desde <a href="https://www.essentiawellnessclub.com/forgot-password" style="color:#335554;">¿Olvidaste tu contraseña?</a> y avísanos.
        </p>
      `,
    });
  }

  return emailBase({
    locale,
    preheader: "Your account is available again.",
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Account unlocked</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        You can sign in again, ${name}.
      </h1>
      <p style="margin:0 0 16px;font-size:16px;color:#335554;line-height:1.6;">
        Your account was unlocked at ${time} and is available again with your usual password.
      </p>
      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        If you were not the one who unlocked it, change your password now from <a href="https://www.essentiawellnessclub.com/forgot-password" style="color:#335554;">Forgot password?</a> and let us know.
      </p>
    `,
  });
}
