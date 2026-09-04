import { sendEmail } from "@/emails/send";
import { accountLockedEmail } from "@/emails/templates/account-locked";
import { accountUnlockedEmail } from "@/emails/templates/account-unlocked";
import { getAppUrl } from "@/lib/env";
import { LOCK_MINUTES, type Account } from "@/lib/login-security";

/**
 * The two emails the lock sends, kept apart from the counting so that module
 * stays about rows and windows.
 *
 * Neither throws. A lock that failed to save because its notice could not be
 * sent would leave the account open, which is the opposite of the point.
 */

/** Madrid, because that is where the centre and its clients are. */
function localTime(locale: "en" | "es"): string {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Madrid",
  }).format(new Date());
}

/**
 * The link that opens the account.
 *
 * Spanish speakers get the `/es` prefix: `localePrefix` is `as-needed`, so
 * English lives at the root and only Spanish carries one.
 */
function unlockUrl(token: string, locale: "en" | "es"): string {
  const prefix = locale === "es" ? "/es" : "";
  return `${getAppUrl()}${prefix}/unlock-account?token=${token}`;
}

export async function notifyAccountLocked(
  account: Account,
  attempts: number,
  token: string,
): Promise<void> {
  try {
    await sendEmail({
      to: account.email,
      subject:
        account.locale === "es"
          ? "Tu cuenta de Essentia se ha bloqueado"
          : "Your Essentia account has been locked",
      // Never blind-copied: the body carries the link that opens the account.
      blindCopy: false,
      html: accountLockedEmail({
        name: account.name,
        attempts,
        time: localTime(account.locale),
        unlockUrl: unlockUrl(token, account.locale),
        minutes: LOCK_MINUTES,
        locale: account.locale,
      }),
    });
  } catch (err) {
    console.error("[login-security] lock email failed:", err);
  }
}

export async function notifyAccountUnlocked(account: Account): Promise<void> {
  try {
    await sendEmail({
      to: account.email,
      subject:
        account.locale === "es"
          ? "Tu cuenta de Essentia se ha desbloqueado"
          : "Your Essentia account has been unlocked",
      blindCopy: false,
      html: accountUnlockedEmail({
        name: account.name,
        time: localTime(account.locale),
        locale: account.locale,
      }),
    });
  } catch (err) {
    console.error("[login-security] unlock email failed:", err);
  }
}
