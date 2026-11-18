/**
 * What became of the email to the CLIENT in `notifyBookingCore`, for a caller
 * that has to report it (the assistant's tools): `sent` (the provider took it),
 * `skipped` (the message is switched off in the list of Messages, and the
 * history says so) or `failed` (it could not be sent, or there was nobody to
 * send it to). The callers that only wait for it ignore it.
 */
export type NotifyOutcome = "sent" | "skipped" | "failed";

/** Whether the client really has the email: only a send the provider accepted. */
export const clientWasNotified = (outcome: NotifyOutcome): boolean =>
  outcome === "sent";
