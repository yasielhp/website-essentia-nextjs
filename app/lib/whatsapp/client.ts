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
 *
 * Contract: `sendTemplate` and `sendTemplateMessage` never throw, every failure
 * comes back as a value. `listRemoteTemplates` and `createRemoteTemplate` throw
 * an `Error` whose message is fit to show to the staff.
 */

const DEFAULT_API_VERSION = "v21.0";
const DEFAULT_TEMPLATE = "essentia_booking_update";
const TIMEOUT_MS = 10_000;
const GRAPH_ORIGIN = "https://graph.facebook.com";
/** 100 templates a page: far above any real account, and a ceiling on a loop. */
const MAX_TEMPLATE_PAGES = 50;
/** Stands in for `{{1}}` in a dynamic button URL when no example is given. */
const DEFAULT_URL_EXAMPLE = "ejemplo";

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

type MetaError = {
  message?: string;
  error_user_msg?: string;
  error_data?: { details?: string };
};

type MetaResponse = {
  messages?: { id?: string }[];
  error?: MetaError;
};

/**
 * Meta's explanation of a failure, most specific first. `error_user_msg` is the
 * one written for people, `details` narrows `message`, and the status is what
 * is left when the body is not JSON at all (a gateway page, say).
 */
function metaErrorMessage(
  payload: { error?: MetaError } | null,
  status: number,
): string {
  return (
    payload?.error?.error_user_msg ??
    payload?.error?.error_data?.details ??
    payload?.error?.message ??
    `Meta ${status}`
  );
}

/** Raised before any request is made, so its message is already readable. */
class UnsafeUrlError extends Error {}

/**
 * An absolute URL taken from Meta's answer is followed with the access token
 * attached. Anything that is not the Graph API over HTTPS is refused, so a
 * strange answer cannot send the token elsewhere.
 */
function assertGraphUrl(raw: string): void {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("Meta returned an invalid pagination URL");
  }
  if (url.protocol !== "https:" || url.hostname !== "graph.facebook.com") {
    throw new UnsafeUrlError(
      "Meta returned a pagination URL on an unexpected host",
    );
  }
}

/**
 * Every call to the Graph API goes through here: API version, bearer token,
 * timeout and no caching. `target` is a path under the version, or an absolute
 * URL that must still be the Graph API.
 *
 * `strictRedirects` makes a redirect an error instead of replaying the token at
 * wherever it points. It is off for the message POST on purpose: that request
 * must stay exactly what the staff notification has always sent.
 */
function graphFetch(
  target: string,
  init: { method?: "POST"; body?: string; strictRedirects?: boolean } = {},
): Promise<Response> {
  const version = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;
  const isAbsolute = /^https?:/i.test(target);
  const url = isAbsolute ? target : `${GRAPH_ORIGIN}/${version}/${target}`;
  if (isAbsolute) assertGraphUrl(url);

  return fetch(url, {
    ...(init.method ? { method: init.method } : {}),
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    ...(init.body === undefined ? {} : { body: init.body }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
    ...(init.strictRedirects ? { redirect: "error" as const } : {}),
  });
}

/** `graphFetch` for the calls that throw: a network failure gets a readable message. */
async function graphRequest(
  target: string,
  init?: { method?: "POST"; body?: string },
): Promise<Response> {
  try {
    return await graphFetch(target, { ...init, strictRedirects: true });
  } catch (err) {
    if (err instanceof UnsafeUrlError) throw err;
    throw new Error(
      `Could not reach WhatsApp: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}

/** What one template message needs, whichever template it is. */
export type TemplateSend = {
  /** Already in E.164 (`+34600112233`); see `toE164`. Not normalised here. */
  to: string;
  name: string;
  /** Meta language code: `es`, `en`, `en_US`… */
  language: string;
  bodyParams: string[];
  /**
   * One entry per URL button with a dynamic suffix, by button index. `index`
   * must be an integer >= 0 or the message is not built.
   */
  buttonUrlParams?: { index: number; text: string }[];
};

type TemplateParameters = { type: "text"; text: string }[];

export type TemplateMessageComponent =
  | { type: "body"; parameters: TemplateParameters }
  | {
      type: "button";
      sub_type: "url";
      index: string;
      parameters: TemplateParameters;
    };

/** The JSON Meta receives for one template message. */
export type TemplateMessageBody = {
  messaging_product: "whatsapp";
  to: string;
  type: "template";
  template: {
    name: string;
    language: { code: string };
    components: TemplateMessageComponent[];
  };
};

/**
 * The JSON Meta receives for one template message. Pure, so a test can pin the
 * exact shape the staff notification has always sent. Throws on a button index
 * that is not a non-negative integer.
 */
export function buildTemplateBody(send: TemplateSend): TemplateMessageBody {
  const components: TemplateMessageComponent[] = [];
  // A template with no placeholders has no body component: Meta rejects an
  // empty parameter list.
  if (send.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: send.bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  for (const button of send.buttonUrlParams ?? []) {
    if (!Number.isInteger(button.index) || button.index < 0) {
      throw new Error(`Invalid button index: ${button.index}`);
    }
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
 *
 * A `failed` caused by a timeout or a dropped connection does not prove Meta
 * did not send the message, so a caller that retries can deliver it twice.
 */
export async function sendTemplateMessage(
  send: TemplateSend,
): Promise<WhatsAppSendResult> {
  if (!isWhatsAppConfigured()) return { status: "skipped" };

  try {
    const response = await graphFetch(
      `${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      { method: "POST", body: JSON.stringify(buildTemplateBody(send)) },
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

const NOT_CONFIGURED = "WhatsApp template API is not configured";

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
  components?: {
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

function flattenTemplate(t: MetaTemplate): RemoteTemplate {
  const components = t.components ?? [];
  const find = (
    type: NonNullable<MetaTemplate["components"]>[number]["type"],
  ) => components.find((c) => c.type === type);
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
 * Every template on the account, flattened. Throws an `Error` with a message
 * fit for the staff when the API is not configured or Meta cannot be read.
 */
export async function listRemoteTemplates(): Promise<RemoteTemplate[]> {
  if (!isTemplateApiConfigured()) throw new Error(NOT_CONFIGURED);

  const out: RemoteTemplate[] = [];
  const seen = new Set<string>();
  let target: string | null =
    `${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates?fields=id,name,language,category,status,rejected_reason,components&limit=100`;

  for (let pages = 0; target; pages += 1) {
    if (pages >= MAX_TEMPLATE_PAGES) {
      throw new Error(
        `Meta returned more than ${MAX_TEMPLATE_PAGES} pages of templates`,
      );
    }
    if (seen.has(target)) {
      throw new Error("Meta returned the same templates page twice");
    }
    seen.add(target);

    const response: Response = await graphRequest(target);
    if (!response.ok) {
      const failure = (await response.json().catch(() => null)) as {
        error?: MetaError;
      } | null;
      throw new Error(metaErrorMessage(failure, response.status));
    }
    const page = (await response.json().catch(() => null)) as {
      data?: MetaTemplate[];
      paging?: { next?: string };
    } | null;
    if (!page) throw new Error("Meta returned an unreadable response");

    out.push(...(page.data ?? []).map(flattenTemplate));
    target = page.paging?.next ?? null;
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
  buttons: {
    type: "URL" | "QUICK_REPLY";
    text: string;
    url?: string;
    /**
     * For a URL with a `{{1}}` suffix: the value Meta's reviewers see in its
     * place. Defaults to a placeholder word on the same domain.
     */
    example?: string;
  }[];
  exampleParams: string[];
};

/** A button as Meta wants it: a dynamic URL carries an example of itself. */
function toMetaButton(button: CreateTemplateInput["buttons"][number]) {
  const { example, ...rest } = button;
  if (button.type !== "URL" || !button.url?.includes("{{")) return rest;
  return {
    ...rest,
    example: [
      button.url.replace(/\{\{[^}]*\}\}/, () => example ?? DEFAULT_URL_EXAMPLE),
    ],
  };
}

/**
 * Submits a template for review. Returns Meta's id and initial status. Throws
 * an `Error` with a message fit for the staff.
 */
export async function createRemoteTemplate(
  input: CreateTemplateInput,
): Promise<{ id: string; status: string }> {
  if (!isTemplateApiConfigured()) throw new Error(NOT_CONFIGURED);

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
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map(toMetaButton),
    });
  }

  const response = await graphRequest(
    `${process.env.WHATSAPP_BUSINESS_ACCOUNT_ID}/message_templates`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        language: input.language,
        category: input.category,
        components,
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    id?: string;
    status?: string;
    error?: MetaError;
  } | null;
  if (!response.ok) throw new Error(metaErrorMessage(payload, response.status));
  if (!payload?.id) {
    throw new Error("Meta accepted the template but returned no id for it");
  }
  return { id: payload.id, status: payload.status ?? "PENDING" };
}
