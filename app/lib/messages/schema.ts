import { z } from "zod";
import { docIsEmpty } from "@/lib/campaigns/doc";
import { docNode, whatsappParamSchema } from "@/lib/schemas";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import type { EmailDoc } from "@/types/campaign";
import { MESSAGE_CATALOG, MESSAGE_KEYS, unknownVariables } from "./catalog";
import { allowedParamFields } from "./param-fields";
import { findForbiddenNodes } from "./safe-doc";

/**
 * What an admin may save for a message, over plain values.
 *
 * Pure, so the rules (and the exact error key each breach gets) are tested
 * rather than found out in the dashboard. Error values are keys under
 * `dashboard.validation`; the dashboard translates them. Anything the schema
 * has no key for becomes `invalidInput`.
 *
 * What it cannot know is in the database: whether the WhatsApp template exists
 * and is approved is checked by the action, with `whatsappTemplateEligibility`.
 */

/** A body above this (serialised) is refused: a mail client would clip it anyway. */
export const MAX_DOC_CHARS = 200_000;

/** The validation keys this module can answer with, besides `invalidInput`. */
const KNOWN_KEYS = new Set([
  "subjectTooLong",
  "preheaderTooLong",
  "titleTooLong",
  "templateRequired",
  "paramTooLong",
]);

const optionalText = (max: number, tooLong: string) =>
  z.string().trim().max(max, tooLong).nullable().optional();

/** The shape alone; what depends on the message is checked after it. */
export const messageTemplateSchema = z.object({
  key: z.enum(MESSAGE_KEYS),
  channel: z.enum(["email", "whatsapp"]),
  locale: z.enum(["en", "es"]),
  enabled: z.boolean().optional(),
  subject: optionalText(120, "subjectTooLong"),
  preheader: optionalText(150, "preheaderTooLong"),
  title: optionalText(200, "titleTooLong"),
  doc: docNode.nullable().optional(),
  whatsappTemplateId: z.uuid("templateRequired").nullable().optional(),
  whatsappParams: z.array(whatsappParamSchema).max(20).optional(),
});

export type EmailContentWrite = {
  subject: string | null;
  preheader: string | null;
  title: string | null;
  doc: EmailDoc | null;
};

export type WhatsAppContentWrite = {
  templateId: string | null;
  params: WhatsAppParamSource[];
};

/**
 * A validated save. `content` / `whatsapp` are null when the input carried
 * none of the channel's fields: only the switch was touched, and the row's
 * text or template must be left exactly as it is.
 */
export type MessageTemplateWrite = {
  key: (typeof MESSAGE_KEYS)[number];
  locale: "en" | "es";
  enabled: boolean;
} & (
  | { channel: "email"; content: EmailContentWrite | null }
  | { channel: "whatsapp"; whatsapp: WhatsAppContentWrite | null }
);

export type MessageTemplateValidation =
  | { ok: true; data: MessageTemplateWrite }
  | {
      ok: false;
      /** Field path → validation key. The first problem of each path. */
      fieldErrors: Record<string, string>;
      /** Every variable name the message does not offer, once each. */
      unknownVariables?: string[];
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const blank = (value: string | null | undefined): value is null | undefined =>
  value == null || value.trim() === "";

/**
 * The attributes that, when the node's flag is set, hold the NAME of a
 * variable instead of an address (Maily's "this link is a variable").
 */
const VARIABLE_FLAGS: Record<string, string> = {
  url: "isUrlVariable",
  href: "isUrlVariable",
  src: "isSrcVariable",
  externalLink: "isExternalLinkVariable",
};

type Found = { path: string; text: string; isVariableName: boolean };

function* attrStrings(
  attrs: Record<string, unknown> | undefined,
  path: string,
  isVariableNode: boolean,
): Generator<Found> {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (typeof value !== "string") continue;
    const flag = VARIABLE_FLAGS[key];
    yield {
      path: `${path}.${key}`,
      text: value,
      isVariableName:
        (isVariableNode && key === "id") ||
        (flag !== undefined && attrs?.[flag] === true),
    };
  }
}

/**
 * Every string a document can carry a `{{token}}` in (its text, the
 * attributes of its nodes and of their marks), with the path it sits at, and
 * whether it is the NAME of a variable (a variable node's `id`, or a link the
 * editor marked as a variable) rather than text.
 */
function* docStrings(node: EmailDoc, path: string): Generator<Found> {
  if (typeof node.text === "string") {
    yield { path: `${path}.text`, text: node.text, isVariableName: false };
  }
  yield* attrStrings(node.attrs, `${path}.attrs`, node.type === "variable");
  for (const [i, mark] of (node.marks ?? []).entries()) {
    yield* attrStrings(mark.attrs, `${path}.marks.${i}.attrs`, false);
  }
  for (const [i, child] of (node.content ?? []).entries()) {
    yield* docStrings(child, `${path}.content.${i}`);
  }
}

/** `content[2].marks[0]` (safe-doc's way) as `doc.content.2.marks.0`. */
const dottedPath = (path: string) =>
  `doc${path === "" ? "" : "."}${path.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "")}`;

type Errors = Record<string, string>;

function checkEmail(
  data: z.infer<typeof messageTemplateSchema>,
  errors: Errors,
  unknown: Set<string>,
): EmailContentWrite | null {
  const { key } = data;
  const provided =
    data.subject !== undefined ||
    data.preheader !== undefined ||
    data.title !== undefined ||
    data.doc !== undefined;
  if (!provided) return null;

  const addUnknown = (path: string, text: string) => {
    const names = unknownVariables(key, text);
    if (names.length === 0) return;
    errors[path] ??= "unknownVariable";
    for (const name of names) unknown.add(name);
  };
  for (const field of ["subject", "preheader", "title"] as const) {
    addUnknown(field, data[field] ?? "");
  }

  let doc: EmailDoc | null = data.doc ?? null;
  if (doc && doc.type !== "doc") {
    errors.doc ??= "invalidInput";
    doc = null;
  }
  if (doc && docIsEmpty(doc)) doc = null;

  if (doc) {
    const offered = new Set<string>(MESSAGE_CATALOG[key].variables);
    for (const { path, text, isVariableName } of docStrings(doc, "doc")) {
      if (isVariableName) {
        const name = text.replace(/^https?:\/\//i, "").trim();
        if (name !== "" && !offered.has(name)) {
          errors[path] ??= "unknownVariable";
          unknown.add(name);
        }
      } else {
        addUnknown(path, text);
      }
    }
    // What the renderer would refuse or rewrite is refused here too, with the
    // very function it uses, so saving and sending cannot disagree.
    for (const problem of findForbiddenNodes(doc)) {
      errors[dottedPath(problem.path)] ??= problem.kind;
    }
  }

  const subject = blank(data.subject) ? null : data.subject!;
  const preheader = blank(data.preheader) ? null : data.preheader!;
  const title = blank(data.title) ? null : data.title!;
  const hasText = subject !== null || preheader !== null || title !== null;
  if (!hasText && doc === null) {
    return { subject: null, preheader: null, title: null, doc: null };
  }
  return {
    subject,
    // With some content, a title or preheader the admin emptied on purpose
    // stays empty rather than falling back to the default.
    preheader: data.preheader == null ? null : data.preheader,
    title: data.title == null ? null : data.title,
    doc,
  };
}

function checkWhatsApp(
  data: z.infer<typeof messageTemplateSchema>,
  enabled: boolean,
  errors: Errors,
): WhatsAppContentWrite | null {
  const provided =
    data.whatsappTemplateId !== undefined || data.whatsappParams !== undefined;
  if (!provided) return null;

  const templateId = data.whatsappTemplateId ?? null;
  // A switched-off message may carry no template: it will not be sent.
  if (templateId === null && enabled)
    errors.whatsappTemplateId ??= "templateRequired";

  const params = data.whatsappParams ?? [];
  const allowed = new Set<string>(allowedParamFields(data.key));
  params.forEach((param, i) => {
    if (param.kind === "field" && !allowed.has(param.field)) {
      errors[`whatsappParams.${i}`] ??= "paramFieldNotOffered";
    }
  });
  return { templateId, params };
}

function readIssues(error: z.ZodError): Errors {
  const fieldErrors: Errors = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "_";
    if (fieldErrors[path]) continue;
    fieldErrors[path] = KNOWN_KEYS.has(issue.message)
      ? issue.message
      : "invalidInput";
  }
  return fieldErrors;
}

export function validateMessageTemplate(
  input: unknown,
): MessageTemplateValidation {
  if (!isRecord(input))
    return { ok: false, fieldErrors: { _: "invalidInput" } };

  try {
    if (input.doc != null) {
      const size = JSON.stringify(input.doc)?.length ?? 0;
      if (size > MAX_DOC_CHARS) {
        return { ok: false, fieldErrors: { doc: "docTooLarge" } };
      }
    }
  } catch {
    // Too deep (or not serialisable at all): not a document we can keep.
    return { ok: false, fieldErrors: { doc: "docTooLarge" } };
  }

  let data: z.infer<typeof messageTemplateSchema>;
  try {
    const parsed = messageTemplateSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, fieldErrors: readIssues(parsed.error) };
    }
    data = parsed.data;
  } catch {
    return { ok: false, fieldErrors: { _: "invalidInput" } };
  }

  const def = MESSAGE_CATALOG[data.key];
  const enabled = data.enabled ?? true;
  const errors: Errors = {};
  const unknown = new Set<string>();

  // Switching off the confirmation would leave a client who has paid without
  // their email: only the message that `canDisable` may be off.
  if (!enabled && !def.canDisable) errors.enabled = "cannotDisable";

  if (data.channel === "whatsapp") {
    if (!def.whatsappEligible) {
      errors.channel = "channelNotAllowed";
      return { ok: false, fieldErrors: errors };
    }
    const whatsapp = checkWhatsApp(data, enabled, errors);
    if (Object.keys(errors).length > 0)
      return { ok: false, fieldErrors: errors };
    return {
      ok: true,
      data: {
        key: data.key,
        locale: data.locale,
        enabled,
        channel: "whatsapp",
        whatsapp,
      },
    };
  }

  const content = checkEmail(data, errors, unknown);
  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      fieldErrors: errors,
      ...(unknown.size > 0 ? { unknownVariables: [...unknown] } : {}),
    };
  }
  return {
    ok: true,
    data: {
      key: data.key,
      locale: data.locale,
      enabled,
      channel: "email",
      content,
    },
  };
}

/**
 * The columns to upsert for a validated save.
 *
 * When the save carried only the switch, the content columns are left out of
 * the payload altogether: an upsert then updates just the columns it names, so
 * switching the reminder off does not wipe a text the admin wrote, and on a new
 * row they stay NULL (the legacy email), never the default text.
 */
export function toRowPayload(
  write: MessageTemplateWrite,
  userId: string,
  now: string,
): Record<string, unknown> {
  const base = {
    key: write.key,
    channel: write.channel,
    locale: write.locale,
    enabled: write.enabled,
    updated_by: userId,
    updated_at: now,
  };
  if (write.channel === "email") {
    return write.content
      ? {
          ...base,
          ...write.content,
          whatsapp_template_id: null,
          whatsapp_params: [],
        }
      : base;
  }
  return write.whatsapp
    ? {
        ...base,
        subject: null,
        preheader: null,
        title: null,
        doc: null,
        whatsapp_template_id: write.whatsapp.templateId,
        whatsapp_params: write.whatsapp.params,
      }
    : base;
}
