/**
 * What a signed notification from Redsys is about.
 *
 * The online notification is not only sent for the payment the client made:
 * Redsys notifies every operation on the terminal that has the notification
 * configured, and a refund is made on the SAME order number as the payment it
 * returns. Its manual ("Manual integración para conexión por Redirección",
 * v2.1, annex "Datos de la notificación on-line") lists:
 *
 * - `Ds_TransactionType`: `0` authorisation (the only one this site sends, see
 *   `RedsysProvider.buildFormData`), `1` pre-authorisation, `2` its
 *   confirmation, `3` automatic refund (devolución), `9` cancellation of a
 *   pre-authorisation, `O`/`P`/`Q` deferred authorisation and its
 *   confirmation and cancellation.
 * - `Ds_Response`: `0000`–`0099` an authorised payment or pre-authorisation,
 *   `0900` an authorised REFUND or confirmation, `0400` an authorised
 *   cancellation; anything else is a refusal (`0190` declined by the issuer,
 *   `0950` refund not allowed, `9xxx` errors…).
 *
 * Read as a number with "below 100 is paid, the rest failed", a refund of a
 * paid booking (`0900`) became a declined payment: the booking went `failed`
 * and the history said "Pago rechazado por Redsys". Here only an authorisation
 * of a payment is a payment or a refusal; everything else is `ignored` and the
 * webhook writes nothing for it. Whether Redsys does send the notification for
 * a refund made by hand in its portal depends on the terminal's configuration
 * and is not documented either way, so the webhook is made safe for both.
 */

export type RedsysNotice =
  | { kind: "paid" }
  | { kind: "declined"; response: string }
  | {
      kind: "ignored";
      reason: "not_an_authorisation" | "refund_or_cancellation";
      transactionType: string | null;
      response: string | null;
    };

/** `Ds_TransactionType` of an authorisation, the only operation we start. */
export const AUTHORISATION = "0";

const read = (value: unknown): string | null => {
  if (value == null) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
};

export function classifyRedsysNotification(
  payload: Record<string, unknown>,
): RedsysNotice {
  const transactionType = read(
    payload.Ds_TransactionType ?? payload.DS_TRANSACTIONTYPE,
  );
  const response = read(payload.Ds_Response ?? payload.DS_RESPONSE);

  // A refund, a confirmation, a cancellation: never the client paying. A
  // notification that does not say its type is read as ours (Redsys always
  // echoes the type of the request, and ours is always an authorisation).
  if (transactionType !== null && transactionType !== AUTHORISATION) {
    return {
      kind: "ignored",
      reason: "not_an_authorisation",
      transactionType,
      response,
    };
  }

  const code = response === null ? Number.NaN : Number.parseInt(response, 10);
  if (Number.isFinite(code) && code >= 0 && code < 100) return { kind: "paid" };
  // Authorised refunds and confirmations (0900) and cancellations (0400) are
  // operations that went through, not a payment that was refused.
  if (code === 900 || code === 400) {
    return {
      kind: "ignored",
      reason: "refund_or_cancellation",
      transactionType,
      response,
    };
  }
  return { kind: "declined", response: response ?? "" };
}
