import type { SendOutcome } from "./send-outcome";

/**
 * What to tell the admin after a send or a retry. A WhatsApp send can stop
 * early, so "sent" is only true when nothing was left over: `halted` means
 * Meta kept refusing and nothing more will go out until someone looks,
 * `partial` means the cron will finish the remaining rows on its own.
 * `unrecorded` is separate because it can accompany any of them.
 */
export type SendNotice =
  | { kind: "halted"; reason: string; unrecorded: number }
  | { kind: "partial"; sent: number; remaining: number; unrecorded: number }
  | { kind: "done"; unrecorded: number };

export function sendNotice(outcome: SendOutcome): SendNotice {
  const unrecorded = outcome.unrecorded ?? 0;
  if (outcome.halted) {
    return { kind: "halted", reason: outcome.halted, unrecorded };
  }
  if (outcome.remaining && outcome.remaining > 0) {
    return {
      kind: "partial",
      sent: outcome.sent,
      remaining: outcome.remaining,
      unrecorded,
    };
  }
  return { kind: "done", unrecorded };
}
