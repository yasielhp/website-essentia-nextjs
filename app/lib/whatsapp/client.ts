import type { WhatsAppSendResult } from "@/lib/whatsapp/types";

/**
 * The only place that talks to the Meta WhatsApp Cloud API.
 *
 * SERVER ONLY — it reads `WHATSAPP_ACCESS_TOKEN`.
 *
 * The centre has no number registered yet, so the absence of credentials is a
 * normal state, not an error: `sendTemplate` reports `skipped` before touching
 * the network and the caller records the message anyway. Going live is a matter
 * of filling in the environment variables.
 */

const DEFAULT_API_VERSION = "v21.0";
const DEFAULT_TEMPLATE = "essentia_booking_update";
const TIMEOUT_MS = 10_000;

/** Whether Meta can actually be reached with the current configuration. */
export function isWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

export function whatsAppTemplateName(): string {
  return process.env.WHATSAPP_TEMPLATE_NAME || DEFAULT_TEMPLATE;
}

/**
 * Spanish mobile numbers are written half a dozen ways in a profile form —
 * `600 11 22 33`, `600-112-233`, `0034600112233`. Meta accepts only E.164, so
 * the number is reduced to digits and given the Spanish prefix when it carries
 * none. A number that is already international keeps its own country code.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (!hasPlus) {
    // `00` is the other way of writing `+` on this side of the Atlantic.
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (digits.length === 9) digits = `34${digits}`;
  }

  // Shorter than this is a landline extension or a typo, not a mobile.
  if (digits.length < 8) return null;
  return `+${digits}`;
}

type MetaResponse = {
  messages?: { id?: string }[];
  error?: { message?: string; error_data?: { details?: string } };
};

/**
 * Sends one approved template message.
 *
 * Never throws: a WhatsApp outage must not take a booking down with it, so
 * every failure comes back as a value the caller stores and moves on from.
 */
export async function sendTemplate(opts: {
  to: string;
  language: "es" | "en";
  params: string[];
  /** Appended to the template's dynamic URL button. */
  buttonUrlParam: string;
}): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) return { status: "skipped" };

  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const body = {
    messaging_product: "whatsapp",
    to: opts.to,
    type: "template",
    template: {
      name: whatsAppTemplateName(),
      language: { code: opts.language },
      components: [
        {
          type: "body",
          parameters: opts.params.map((text) => ({ type: "text", text })),
        },
        {
          type: "button",
          sub_type: "url",
          index: "0",
          parameters: [{ type: "text", text: opts.buttonUrlParam }],
        },
      ],
    },
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      },
    );

    // Status first: `fetch` resolves on 4xx, and Meta answers both cases with
    // a JSON body, so the two are only told apart by the status.
    if (!response.ok) {
      const failure = (await response
        .json()
        .catch(() => null)) as MetaResponse | null;
      const detail =
        failure?.error?.error_data?.details ??
        failure?.error?.message ??
        `HTTP ${response.status}`;
      return { status: "failed", error: detail };
    }

    const payload = (await response
      .json()
      .catch(() => null)) as MetaResponse | null;

    return { status: "sent", providerId: payload?.messages?.[0]?.id ?? null };
  } catch (err) {
    return {
      status: "failed",
      error: err instanceof Error ? err.message : "Unknown WhatsApp error",
    };
  }
}
