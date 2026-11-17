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

/**
 * The only language registered with Meta.
 *
 * A send names the language it wants and Meta rejects it outright if the
 * template carries no such version, so this is not a preference: it is the one
 * value that works. It stays a constant rather than an argument so no caller
 * can pass a language nobody has registered. Adding English means approving the
 * English body first, then widening this.
 */
export const WHATSAPP_TEMPLATE_LANGUAGE = "es";

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

/** What one template message needs, whichever template it is. */
export type TemplateSend = {
  to: string;
  name: string;
  /** Meta language code: `es`, `en`, `en_US`… */
  language: string;
  bodyParams: string[];
  /** One entry per URL button with a dynamic suffix, by button index. */
  buttonUrlParams?: { index: number; text: string }[];
};

/**
 * The JSON Meta receives for one template message. Pure, so a test can pin the
 * exact shape the staff notification has always sent.
 */
export function buildTemplateBody(send: TemplateSend) {
  const components: unknown[] = [];
  // A template with no placeholders has no body component: Meta rejects an
  // empty parameter list.
  if (send.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: send.bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  for (const button of send.buttonUrlParams ?? []) {
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.index),
      parameters: [{ type: "text", text: button.text }],
    });
  }
  return {
    messaging_product: "whatsapp",
    to: send.to,
    type: "template",
    template: {
      name: send.name,
      language: { code: send.language },
      components,
    },
  };
}

/**
 * Sends one approved template message, whichever template it is.
 *
 * Never throws: a WhatsApp outage must not take a booking down with it, so
 * every failure comes back as a value the caller stores and moves on from.
 */
export async function sendTemplateMessage(
  send: TemplateSend,
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) return { status: "skipped" };

  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  const body = buildTemplateBody(send);

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

/**
 * The staff notification, on the one template registered for it. Same
 * signature and behaviour as before the client learned to send any template.
 */
export async function sendTemplate(opts: {
  to: string;
  params: string[];
  /** Appended to the template's dynamic URL button. */
  buttonUrlParam: string;
}): Promise<WhatsAppSendResult> {
  return sendTemplateMessage({
    to: opts.to,
    name: whatsAppTemplateName(),
    language: WHATSAPP_TEMPLATE_LANGUAGE,
    bodyParams: opts.params,
    buttonUrlParams: [{ index: 0, text: opts.buttonUrlParam }],
  });
}

/** Whether the account's templates can be listed and submitted. */
export function isTemplateApiConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
  );
}

type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  rejected_reason?: string;
  components: {
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    format?: string;
    text?: string;
    buttons?: { type: string; text: string; url?: string }[];
    example?: { body_text?: string[][] };
  }[];
};

export type RemoteTemplate = {
  metaId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  headerText: string | null;
  body: string;
  footerText: string | null;
  buttons: { type: string; text: string; url?: string }[];
  exampleParams: string[];
  rejectionReason: string | null;
};

function flatten(t: MetaTemplate): RemoteTemplate {
  const find = (type: MetaTemplate["components"][number]["type"]) =>
    t.components.find((c) => c.type === type);
  const header = find("HEADER");
  const body = find("BODY");
  return {
    metaId: t.id,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    headerText: header?.format === "TEXT" ? (header.text ?? null) : null,
    body: body?.text ?? "",
    footerText: find("FOOTER")?.text ?? null,
    buttons: find("BUTTONS")?.buttons ?? [],
    exampleParams: body?.example?.body_text?.[0] ?? [],
    rejectionReason: t.rejected_reason ?? null,
  };
}

/**
 * The next page is an absolute URL taken from Meta's answer, and the request
 * that follows it carries the access token. Anything that is not the Graph API
 * over HTTPS is refused, so a strange answer cannot send the token elsewhere.
 */
function assertGraphUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Meta returned an invalid pagination URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") {
    throw new Error("Meta returned a pagination URL on an unexpected host");
  }
}

/** Every template on the account, flattened. Throws on a network/API error. */
export async function listRemoteTemplates(): Promise<RemoteTemplate[]> {
  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const out: RemoteTemplate[] = [];
  let url: string | null =
    `https://graph.facebook.com/${version}/${waba}/message_templates?fields=id,name,language,category,status,rejected_reason,components&limit=100`;
  while (url) {
    const response: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Meta ${response.status}`);
    const page = (await response.json()) as {
      data: MetaTemplate[];
      paging?: { next?: string };
    };
    out.push(...page.data.map(flatten));
    url = page.paging?.next ?? null;
    if (url) assertGraphUrl(url);
  }
  return out;
}

export type CreateTemplateInput = {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY";
  headerText?: string | null;
  body: string;
  footerText?: string | null;
  buttons: { type: "URL" | "QUICK_REPLY"; text: string; url?: string }[];
  exampleParams: string[];
};

/** Submits a template for review. Returns Meta's id and initial status. */
export async function createRemoteTemplate(
  input: CreateTemplateInput,
): Promise<{ id: string; status: string }> {
  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const waba = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const components: unknown[] = [];
  if (input.headerText) {
    components.push({ type: "HEADER", format: "TEXT", text: input.headerText });
  }
  components.push({
    type: "BODY",
    text: input.body,
    ...(input.exampleParams.length > 0
      ? { example: { body_text: [input.exampleParams] } }
      : {}),
  });
  if (input.footerText) {
    components.push({ type: "FOOTER", text: input.footerText });
  }
  if (input.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: input.buttons });
  }
  const response = await fetch(
    `https://graph.facebook.com/${version}/${waba}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: input.name,
        language: input.language,
        category: input.category,
        components,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    status?: string;
    error?: { message?: string; error_user_msg?: string };
  } | null;
  if (!response.ok || !payload?.id) {
    throw new Error(
      payload?.error?.error_user_msg ??
        payload?.error?.message ??
        `Meta ${response.status}`,
    );
  }
  return { id: payload.id, status: payload.status ?? "PENDING" };
}
