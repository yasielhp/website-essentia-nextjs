import { emailBase } from "./_base";

/**
 * The email a lock sends.
 *
 * It says the number of attempts and the time out loud, because that is the
 * only way the account holder can tell their own fat-fingered password from
 * somebody else's attempt on their account — and the difference decides
 * whether they follow the link or change the password.
 */
export function accountLockedEmail({
  name,
  attempts,
  time,
  unlockUrl,
  minutes,
  locale = "en",
}: {
  name: string;
  attempts: number;
  /** Already formatted for the recipient's locale. */
  time: string;
  unlockUrl: string;
  minutes: number;
  locale?: "en" | "es";
}): string {
  const button = (label: string) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0;">
    <tr>
      <td align="center">
        <a href="${unlockUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;padding:12px 28px;background-color:#103838;color:#f5f2ed;text-decoration:none;border-radius:8px;font-size:14px;font-weight:500;letter-spacing:0.02em;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;

  if (locale === "es") {
    return emailBase({
      locale,
      preheader: `Tu cuenta se ha bloqueado tras ${attempts} intentos fallidos.`,
      body: `
        <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Cuenta bloqueada</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
          Hemos bloqueado tu cuenta, ${name}.
        </h1>
        <p style="margin:0 0 16px;font-size:16px;color:#335554;line-height:1.6;">
          Se han hecho ${attempts} intentos fallidos de acceso a tu cuenta, el último a las ${time}. Por seguridad la hemos bloqueado temporalmente.
        </p>
        <p style="margin:0;font-size:16px;color:#335554;line-height:1.6;">
          Si has sido tú, pulsa el botón para desbloquearla ahora mismo. Si prefieres esperar, el bloqueo se levanta solo en ${minutes} minutos.
        </p>

        ${button("Desbloquear mi cuenta")}

        <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
          <strong style="color:#103838;">Si no has sido tú</strong>, no pulses el botón: alguien está intentando entrar en tu cuenta. Cambia la contraseña desde <a href="https://www.essentiawellnessclub.com/forgot-password" style="color:#335554;">¿Olvidaste tu contraseña?</a> y escríbenos si necesitas ayuda.
        </p>
      `,
    });
  }

  return emailBase({
    locale,
    preheader: `Your account was locked after ${attempts} failed attempts.`,
    body: `
      <p style="margin:0 0 8px;font-size:14px;color:#4a6767;text-transform:uppercase;letter-spacing:1px;">Account locked</p>
      <h1 style="margin:0 0 16px;font-size:24px;font-weight:600;color:#103838;line-height:1.3;">
        We have locked your account, ${name}.
      </h1>
      <p style="margin:0 0 16px;font-size:16px;color:#335554;line-height:1.6;">
        There were ${attempts} failed attempts to sign in to your account, the last one at ${time}. We have locked it temporarily as a precaution.
      </p>
      <p style="margin:0;font-size:16px;color:#335554;line-height:1.6;">
        If that was you, use the button below to unlock it straight away. If you would rather wait, the lock lifts on its own in ${minutes} minutes.
      </p>

      ${button("Unlock my account")}

      <p style="margin:0;font-size:14px;color:#4a6767;line-height:1.6;">
        <strong style="color:#103838;">If it was not you</strong>, do not use the button: somebody is trying to reach your account. Change your password from <a href="https://www.essentiawellnessclub.com/forgot-password" style="color:#335554;">Forgot password?</a> and write to us if you need a hand.
      </p>
    `,
  });
}
