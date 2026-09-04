"use server";

import {
  consumeUnlockToken,
  findAccount,
  recordAuthEvent,
  clientIp,
  userAgent,
} from "@/lib/auth-security";
import { notifyAccountUnlocked } from "@/lib/auth-security-notify";

/**
 * Spends the token from the lock email.
 *
 * It opens the account and nothing else — no session is established. Somebody
 * who reaches the mailbox still has to know the password, which is the whole
 * reason the link is safe to send.
 *
 * Returns a status rather than a sentence, for the same reason the sign-in
 * does: the page is bilingual.
 */
export async function unlockAccount(
  token: string,
): Promise<{ status: "unlocked" | "expired" | "invalid" }> {
  // A uuid or nothing. Anything else never reaches the database, where the
  // column is typed `uuid` and a malformed value is an error rather than a
  // miss.
  const looksLikeToken =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      token,
    );
  if (!looksLikeToken) return { status: "invalid" };

  const result = await consumeUnlockToken(token);
  if (result.status !== "unlocked") return { status: result.status };

  await recordAuthEvent({
    email: result.email,
    outcome: "unlocked",
    ip: await clientIp(),
    userAgent: await userAgent(),
  });

  const account = await findAccount(result.email);
  if (account) await notifyAccountUnlocked(account);

  return { status: "unlocked" };
}
