import { z } from "zod";
import { docIsEmpty } from "@/lib/campaigns/doc";
import { docNode, whatsappParamSchema } from "@/lib/schemas";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";
import type { EmailDoc } from "@/types/campaign";
import { MESSAGE_CATALOG, MESSAGE_KEYS, unknownVariables } from "./catalog";
import { defaultContent } from "@/emails/defaults";
import { MAX_DOC_DEPTH, docDepth } from "./doc-depth";
import { sameDoc } from "./editor-state";
import { structureProblems, withoutSpecialNodes } from "./email-doc";
import { allowedParamFields } from "./param-fields";
import { findForbiddenNodes } from "./safe-doc";

/**
 * What an admin may save for a message, over plain values.
 *
 * SERVER ONLY. This module imports `safe-doc.ts` and, through the catalogue and
 * the sample data, the email templates, which drag in the Maily renderer. Do
 * NOT import it from a client component: it would put the renderer in the
 * browser bundle. A client form that wants to validate validates the minimum
 * (limits, the switch) with its own light functions, and the server action
 * repeats the full check; if one needs this module's rules in the browser,
 * extract a light version rather than importing this.
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

/** What the shape check (zod) can say; anything else it says is `invalidInput`. */
const KNOWN_KEYS = new Set([
  "subjectTooLong",
  "preheaderTooLong",
  "titleTooLong",
  "templateRequired",
  "paramTooLong",
]);

/**
 * Every key a save can answer with, in `fieldErrors`: this module's and the
 * action's (the two that need the database). A test checks each one has a
 * translation in both languages, and that this module never says another.
 */
export const MESSAGE_VALIDATION_KEYS = [
  "invalidInput",
  ...KNOWN_KEYS,
  "docTooLarge",
  "docTooDeep",
  "docNotRenderable",
  // The structure of the whole email: one title, and the blocks it must carry.
  "titleOne",
  "titleEmpty",
  "blockRequired",
  "blockRepeated",
  "cannotDisable",
  "unknownVariable",
  "linkNotAllowed",
  "blockNotAllowed",
  "channelNotAllowed",
  "paramFieldNotOffered",
  // From the action, after reading the template:
  "templateUnavailable",
  "templateButtonValue",
  "paramCountMismatch",
] as const;

// A line break of any kind (Unicode's included). The subject is a mail
// header; the preheader and the title are one line by nature.
const LINE_BREAK = /[\r\n\u000b\u000c\u0085\u2028\u2029]/;

/**
 * One line of text. A break at either end goes with the trim; one inside is
 * refused (`invalidInput`: the dashboard's inputs cannot type one, so only a
 * hand-made request carries it).
 */
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .refine((value) => !LINE_BREAK.test(value), "lineBreak")
    .nullable()
    .optional();

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

/**
 * What a save says about the body of an email, field by field. A key that is
 * absent was not sent and its column is not touched; `null` clears it.
 */
export type EmailContentWrite = {
  subject?: string | null;
  preheader?: string | null;
  title?: string | null;
  doc?: EmailDoc | null;
};

/** The same for a WhatsApp message: absent is not touched, `null` clears. */
export type WhatsAppContentWrite = {
  templateId?: string | null;
  params?: WhatsAppParamSource[];
};

/**
 * A validated save. `content` / `whatsapp` are null when the input carried
 * none of the channel's fields: only the switch was touched, and the row's
 * text or template must be left exactly as it is.
 */
export type MessageTemplateWrite = {
  key: (typeof MESSAGE_KEYS)[number];
  locale: "en" | "es";
  /**
   * Undefined when the input did not carry the switch: saving a text must not
   * touch it, or a reminder the admin switched off would come back on. A new
   * row then takes the column's default (on), which is "no row" behaviour.
   */
  enabled?: boolean;
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

/** The heading levels the editor offers and `@maily-to/render` has a size for. */
const HEADING_LEVELS = new Set(["1", "2", "3"]);

/**
 * Where the document carries an attribute value the renderer throws on, as
 * the path to that attribute. Only what was found to throw: a heading whose
 * `level` is not 1, 2 or 3 (the renderer looks its size up by level and
 * fails destructuring `undefined`). Everything else the renderer does with a
 * node is caught by the trial render the save runs before it writes.
 *
 * Recursive, and safe to be: the depth was capped before this is reached.
 */
function* unrenderableAttrs(node: EmailDoc, path: string): Generator<string> {
  if (node.type === "heading" && node.attrs && "level" in node.attrs) {
    const level = node.attrs.level;
    const ok =
      (typeof level === "number" || typeof level === "string") &&
      HEADING_LEVELS.has(String(level));
    if (!ok) yield `${path}.attrs.level`;
  }
  for (const [i, child] of (node.content ?? []).entries()) {
    yield* unrenderableAttrs(child, `${path}.content.${i}`);
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
  // The default document, saved as it is, is not an edit: the row keeps no body
  // of its own, and the email stays the one that has always gone out.
  const isDefault =
    doc !== null && sameDoc(doc, defaultContent(key, data.locale).doc);

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
    // very function it uses, so saving and sending cannot disagree. The title
    // and the blocks of the system are not the renderer's: they are checked
    // for their own rules, and the rest of the document is read with them
    // out of the way (the indices stay, so the paths still point right).
    for (const problem of findForbiddenNodes(withoutSpecialNodes(doc))) {
      errors[dottedPath(problem.path)] ??= problem.kind;
    }
    // One title, no block of another message, none twice, and every block the
    // message cannot do without. Saved a block short, an email would go out
    // without its cancellation link or its consent button.
    for (const problem of structureProblems(doc, key)) {
      switch (problem.kind) {
        case "titleOne":
          errors["doc.title"] ??= "titleOne";
          break;
        case "titleEmpty":
          errors["doc.title"] ??= "titleEmpty";
          break;
        case "blockRequired":
          errors[`doc.blocks.${problem.block}`] ??= "blockRequired";
          break;
        default:
          errors[dottedPath(problem.path)] ??= problem.kind;
      }
    }
    // Attribute values the renderer throws on, found before it is asked.
    for (const path of unrenderableAttrs(doc, "doc")) {
      errors[path] ??= "docNotRenderable";
    }
  }

  // Partial by design: a field that was not sent is not in the result, so the
  // row keeps it. One that was sent empty (or null) is cleared.
  const content: EmailContentWrite = {};
  for (const field of ["subject", "preheader", "title"] as const) {
    if (data[field] === undefined) continue;
    content[field] = blank(data[field]) ? null : data[field]!;
  }
  if (data.doc !== undefined) {
    content.doc = isDefault ? null : doc;
    // The title now lives inside the document. An old row's `title` column
    // must not outlive the body it belonged to (a default document would leave
    // the row to come back as custom with the old title), so saving a body
    // clears it unless the caller sent one on purpose.
    if (data.title === undefined) content.title = null;
  }
  return Object.keys(content).length > 0 ? content : null;
}

function checkWhatsApp(
  data: z.infer<typeof messageTemplateSchema>,
  enabled: boolean | undefined,
  errors: Errors,
): WhatsAppContentWrite | null {
  const content: WhatsAppContentWrite = {};
  if (data.whatsappTemplateId !== undefined) {
    content.templateId = data.whatsappTemplateId;
    // A switched-off message may carry no template: it will not be sent. When
    // the template is not mentioned at all the row keeps its own, and the
    // action checks that one exists.
    if (data.whatsappTemplateId === null && enabled !== false) {
      errors.whatsappTemplateId ??= "templateRequired";
    }
  }
  if (data.whatsappParams !== undefined) {
    content.params = data.whatsappParams;
    const allowed = new Set<string>(allowedParamFields(data.key));
    data.whatsappParams.forEach((param, i) => {
      if (param.kind === "field" && !allowed.has(param.field)) {
        errors[`whatsappParams.${i}`] ??= "paramFieldNotOffered";
      }
    });
  }
  return Object.keys(content).length > 0 ? content : null;
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
    // Depth first, and without recursion: nothing below (the size, the shape,
    // the walks) may run over a body nobody has bounded yet.
    if (input.doc != null && docDepth(input.doc) > MAX_DOC_DEPTH) {
      return { ok: false, fieldErrors: { doc: "docTooDeep" } };
    }
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
  const enabled = data.enabled;
  const errors: Errors = {};
  const unknown = new Set<string>();

  // Switching off the confirmation would leave a client who has paid without
  // their email: only the message that `canDisable` may be off.
  if (enabled === false && !def.canDisable) errors.enabled = "cannotDisable";

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
 * Only what the input carried is in the payload. An upsert updates just the
 * columns it names, so a field that was not sent keeps what the row has: the
 * switch alone does not wipe a text, a subject alone does not wipe the body,
 * and on a NEW row every column not named stays NULL (the legacy email), never
 * the default text. A field sent as null or empty is in the payload as null,
 * which is how it is cleared.
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
    // Only when the input carried it: a text saved without the switch leaves
    // the row's switch as it is.
    ...(write.enabled === undefined ? {} : { enabled: write.enabled }),
    updated_by: userId,
    updated_at: now,
  };
  if (write.channel === "email") {
    // Only what was sent: an upsert updates just the columns it names, so the
    // others keep what the row has (and a new row leaves them NULL).
    return { ...base, ...write.content };
  }
  const whatsapp = write.whatsapp;
  return {
    ...base,
    ...(whatsapp?.templateId === undefined
      ? {}
      : { whatsapp_template_id: whatsapp.templateId }),
    ...(whatsapp?.params === undefined
      ? {}
      : { whatsapp_params: whatsapp.params }),
  };
}
