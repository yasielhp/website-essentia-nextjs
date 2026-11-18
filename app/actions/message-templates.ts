"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defaultContent } from "@/emails/defaults";
import { sendEmail } from "@/emails/send";
import { loadWhatsAppTemplate } from "@/lib/campaigns/dispatch-whatsapp";
import { createRateLimiter } from "@/lib/campaigns/rate-limit";
import { prepareTestSend } from "@/lib/campaigns/whatsapp-test-send";
import {
  ADMIN_ROLES,
  AuthError,
  requireRole,
  type AuthContext,
} from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "@/lib/messages/catalog";
import { editableLocales } from "@/lib/messages/editor-state";
import { MESSAGES_PATH } from "@/lib/messages/message-route";
import type { MessageRow } from "@/lib/messages/compose";
import { CLEARED_COLUMNS, resetPlan } from "@/lib/messages/reset";
import { editorIds, editorNames, withEditors } from "@/lib/messages/editors";
import { buildPreviewEmail } from "@/lib/messages/preview";
import { readRows } from "@/lib/messages/rows";
import { rehearseRender } from "@/lib/messages/rehearsal";
import { toRowPayload, validateMessageTemplate } from "@/lib/messages/schema";
import { whatsappSaveIssue } from "@/lib/messages/template-save";
import { buildTestEmail } from "@/lib/messages/test-email";
import type {
  MESSAGE_ACTION_ERROR_KEYS,
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { sendTemplateMessage } from "@/lib/whatsapp/client";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";

const PATH = MESSAGES_PATH;
const LOCALES = ["en", "es"] as const;

/**
 * `error` is always one of `MESSAGE_ACTION_ERROR_KEYS`, which the dashboard
 * translates (a test keeps the list and the translations together). Nothing
 * Postgres, the mailer or the auth guard said reaches the browser: `detail`
 * carries only what is safe to show (eligibility codes, the variable names the
 * admin typed, Meta's words about the template).
 */
type Failure = {
  ok: false;
  error: (typeof MESSAGE_ACTION_ERROR_KEYS)[number];
  detail?: string;
  fieldErrors?: Record<string, string>;
};

async function admin(accessToken: string | null): Promise<AuthContext> {
  return requireRole(accessToken, ADMIN_ROLES);
}

function authFailure(err: unknown): Failure {
  if (err instanceof AuthError) {
    return {
      ok: false,
      error: err.status === 403 ? "forbidden" : "unauthenticated",
    };
  }
  throw err;
}

/** What `detail` may carry of what the admin typed: a name, not a document. */
const DETAIL_MAX = 200;

const addressSchema = z.object({
  key: z.enum(MESSAGE_KEYS),
  channel: z.enum(["email", "whatsapp"]),
  locale: z.enum(LOCALES),
});

const ROW_COLUMNS =
  "key, channel, locale, enabled, subject, preheader, title, doc, whatsapp_template_id, whatsapp_params, updated_at, updated_by";

/**
 * Every saved message, what the editor opens with when nothing is saved (the
 * default text of each message in each language) and what the code guarantees
 * about each one. Plain JSON all of it.
 */
export async function listMessageTemplates(accessToken: string | null): Promise<
  | {
      ok: true;
      rows: MessageTemplateRowView[];
      defaults: MessageDefaultEntry[];
      catalog: MessageCatalogEntry[];
    }
  | Failure
> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  try {
    const { data, error } = await getAdminClient()
      .database.from("message_templates")
      .select(ROW_COLUMNS)
      .order("key", { ascending: true });
    if (error) return { ok: false, error: "db" };

    const defaults: MessageDefaultEntry[] = MESSAGE_KEYS.flatMap((key) =>
      LOCALES.map((locale) => {
        const content = defaultContent(key, locale);
        return {
          key,
          locale,
          subject: content.subject,
          preheader: content.preheader,
          title: content.title,
          doc: content.doc ?? { type: "doc", content: [] },
        };
      }),
    );
    const catalog: MessageCatalogEntry[] = MESSAGE_KEYS.map((key) => ({
      key,
      ...MESSAGE_CATALOG[key],
    }));
    // Who saved each row, by name. A profile that cannot be read leaves the
    // name out; the list is still worth showing.
    const raw = (data ?? []) as Record<string, unknown>[];
    let names = new Map<string, string>();
    const ids = editorIds(raw);
    if (ids.length > 0) {
      const profiles = await getAdminClient()
        .database.from("profiles")
        .select("id, first_name, full_name")
        .in("id", ids);
      if (!profiles.error) {
        names = editorNames(
          (profiles.data ?? []) as {
            id: string;
            first_name: string | null;
            full_name: string | null;
          }[],
        );
      }
    }
    return {
      ok: true,
      // Rows are read, not trusted: a corrupt body is flagged and a row for a
      // key the catalogue does not know is left out.
      rows: withEditors(readRows(raw), raw, names),
      defaults,
      catalog,
    };
  } catch {
    return { ok: false, error: "db" };
  }
}

/**
 * Saves one message in one channel and language.
 *
 * Only what the input carries is written. A field that is absent is not
 * touched: saving the switch alone leaves the text, saving a subject alone
 * leaves the body, and a new row keeps every field it was not given NULL (the
 * email that has always gone out); the default text is never copied into a
 * row, here or by opening the editor. A field sent as `null` or `""` is
 * cleared. So a client must send ONLY what the admin changed: sending the text
 * fields as null would wipe them. `enabled` is ignored here: the switch is
 * `setMessageEnabled`'s, and saving a text never changes it.
 *
 * An email body is also tried through the real renderer before it is written:
 * one it cannot draw would be saved as the admin's and never reach a client.
 */
export async function saveMessageTemplate(
  accessToken: string | null,
  input: unknown,
): Promise<{ ok: true; id: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  // The switch is NOT part of a save: it has its own action (`setMessageEnabled`)
  // and a text saved here never changes it, whatever the browser sent. A message
  // switched off must not come back on because somebody fixed a comma.
  const withoutSwitch =
    typeof input === "object" && input !== null && !Array.isArray(input)
      ? Object.fromEntries(
          Object.entries(input as Record<string, unknown>).filter(
            ([name]) => name !== "enabled",
          ),
        )
      : input;
  // It came over the wire: whatever the type says, it is validated as unknown.
  const parsed = validateMessageTemplate(withoutSwitch);
  if (!parsed.ok) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: parsed.fieldErrors,
      ...(parsed.unknownVariables
        ? {
            detail: parsed.unknownVariables.join(", ").slice(0, DETAIL_MAX),
          }
        : {}),
    };
  }
  const write = parsed.data;
  // With the switch gone from a save there may be nothing left to save: a body
  // with no field of content writes only who and when, and changes nothing.
  if (
    (write.channel === "email" && write.content === null) ||
    (write.channel === "whatsapp" && write.whatsapp === null)
  ) {
    return { ok: false, error: "invalid", fieldErrors: { _: "invalidInput" } };
  }
  const db = getAdminClient().database;

  // A switched-off message is not sent, so its template is not checked. A save
  // that carries neither a template nor the switch changes nothing to check.
  if (write.channel === "whatsapp" && write.whatsapp !== null) {
    // What a database read can add to the schema: the template must exist and
    // be sendable in this language with exactly these parameters. What the
    // save does not mention is what the row already has.
    const fieldErrors: Record<string, string> = {};
    try {
      let templateId = write.whatsapp?.templateId;
      let params = write.whatsapp?.params;
      if (templateId === undefined || params === undefined) {
        const { data, error } = await db
          .from("message_templates")
          .select("whatsapp_template_id, whatsapp_params")
          .eq("key", write.key)
          .eq("channel", "whatsapp")
          .eq("locale", write.locale)
          .maybeSingle();
        if (error) return { ok: false, error: "db" };
        const existing = data as {
          whatsapp_template_id: string | null;
          whatsapp_params: WhatsAppParamSource[] | null;
        } | null;
        templateId ??= existing?.whatsapp_template_id ?? null;
        params ??= existing?.whatsapp_params ?? [];
      }
      if (templateId === null) {
        fieldErrors.whatsappTemplateId = "templateRequired";
      } else {
        const template = await loadWhatsAppTemplate(db, templateId);
        // One judgement, shared with the sender: the template, its buttons
        // and its parameters.
        const issue = whatsappSaveIssue(template, write.locale, params);
        if (issue) fieldErrors[issue.field] = issue.key;
      }
    } catch (err) {
      console.error("[messages] template lookup failed:", err);
      return { ok: false, error: "db" };
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "invalid", fieldErrors };
    }
  }

  // The trial render: the validator caught what it knows the renderer cannot
  // take, this catches the rest, before anything is written.
  if (write.channel === "email" && write.content) {
    const trial = await rehearseRender(write.key, write.locale, write.content);
    if (trial !== "ok") {
      return { ok: false, error: "invalid", fieldErrors: { doc: trial } };
    }
  }

  try {
    const { data, error } = await db
      .from("message_templates")
      .upsert(toRowPayload(write, caller.userId, new Date().toISOString()), {
        onConflict: "key,channel,locale",
      })
      .select("id")
      .single();
    if (error || !data) {
      if (error) console.error("[messages] save failed:", error.message);
      return { ok: false, error: "db" };
    }
    revalidatePath(PATH);
    return { ok: true, id: (data as { id: string }).id };
  } catch (err) {
    console.error("[messages] save failed:", err);
    return { ok: false, error: "db" };
  }
}

/**
 * Sixty previews a minute per administrator: the editor asks half a second
 * after the last keystroke, so a person typing stays far below it, and a loop
 * or a stuck page stops. Each one renders an email on the server. Per process,
 * like the test limiter: a brake, not a guarantee.
 */
const previewLimiter = createRateLimiter({ max: 60, windowMs: 60_000 });

/**
 * The whole email as it would go out with a draft that is not saved, for the
 * editor's live preview: the default text for what the draft leaves out, the
 * admin's for what it carries, the fixed blocks with an example booking. Built
 * by the very function the test email uses, so the two cannot differ.
 *
 * Writes nothing and reads nothing from the database. The draft is validated
 * like a save (what the renderer would refuse, it refuses), and `draft` takes
 * only the four text fields: the switch and the channel are not the preview's.
 * The booking is made up; no personal data is in the answer.
 */
export async function previewMessage(
  accessToken: string | null,
  key: string,
  locale: string,
  draft: unknown,
): Promise<{ ok: true; subject: string; html: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const address = addressSchema
    .pick({ key: true, locale: true })
    .safeParse({ key, locale });
  if (!address.success) return { ok: false, error: "invalid" };
  if (!previewLimiter.take(caller.userId)) {
    return { ok: false, error: "preview_rate_limited" };
  }

  const fields =
    typeof draft === "object" && draft !== null && !Array.isArray(draft)
      ? (draft as Record<string, unknown>)
      : {};
  const parsed = validateMessageTemplate({
    key: address.data.key,
    channel: "email",
    locale: address.data.locale,
    subject: fields.subject,
    preheader: fields.preheader,
    title: fields.title,
    doc: fields.doc,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: parsed.fieldErrors,
      ...(parsed.unknownVariables
        ? { detail: parsed.unknownVariables.join(", ").slice(0, DETAIL_MAX) }
        : {}),
    };
  }
  if (parsed.data.channel !== "email") return { ok: false, error: "invalid" };

  try {
    const built = await buildPreviewEmail(
      address.data.key,
      address.data.locale,
      parsed.data.content,
    );
    return { ok: true, ...built };
  } catch (err) {
    console.error("[messages] preview could not be built:", err);
    return {
      ok: false,
      error: "invalid",
      fieldErrors: { doc: "docNotRenderable" },
    };
  }
}

/**
 * Restores a message to what it was before anyone edited it.
 *
 * A reminder the admin switched off stays off: its row is kept, emptied, with
 * its switch (`kept: "disabled"`), because deleting it would turn the reminder
 * back on without a word. Every other row is deleted. Idempotent: resetting
 * what was never saved is a success with `removed: false`.
 *
 * The switch can be turned between the read and the write, so the read only
 * chooses what to try: the delete of such a row carries `enabled = true`, and
 * when it deletes nothing the row is emptied instead, which never touches the
 * switch. Whatever the other admin did in between, a reset cannot turn a
 * reminder back on.
 */
export async function resetMessageTemplate(
  accessToken: string | null,
  key: string,
  channel: string,
  locale: string,
): Promise<{ ok: true; removed: boolean; kept: "disabled" | null } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const address = addressSchema.safeParse({ key, channel, locale });
  if (!address.success) return { ok: false, error: "invalid" };
  const target = address.data;
  const db = getAdminClient().database;

  try {
    const found = await db
      .from("message_templates")
      .select("enabled")
      .eq("key", target.key)
      .eq("channel", target.channel)
      .eq("locale", target.locale)
      .maybeSingle();
    if (found.error) return { ok: false, error: "db" };
    const row = found.data as { enabled: boolean } | null;
    const plan = resetPlan(target.key, target.channel, row);

    if (plan === "none") return { ok: true, removed: false, kept: null };

    if (plan === "delete") {
      const removal = db
        .from("message_templates")
        .delete()
        .eq("key", target.key)
        .eq("channel", target.channel)
        .eq("locale", target.locale);
      // Only while it is still on: switched off since the read, it is not
      // deleted, and falls through to be emptied with its switch kept.
      const { data, error } = await removal.eq("enabled", true).select("key");
      if (error) return { ok: false, error: "db" };
      if (((data ?? []) as unknown[]).length > 0) {
        revalidatePath(PATH);
        return { ok: true, removed: true, kept: null };
      }
    }

    // Emptied, never deleted, and the switch is not among the columns written.
    const { data, error } = await db
      .from("message_templates")
      .update({
        ...CLEARED_COLUMNS,
        updated_by: caller.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("key", target.key)
      .eq("channel", target.channel)
      .eq("locale", target.locale)
      .select("enabled");
    if (error) return { ok: false, error: "db" };
    const [kept] = (data ?? []) as { enabled: boolean }[];
    revalidatePath(PATH);
    return {
      ok: true,
      removed: false,
      // No row left (somebody deleted it meanwhile), or one that is on again:
      // either way the default email goes out and no switch is being held.
      kept: kept?.enabled === false ? "disabled" : null,
    };
  } catch {
    return { ok: false, error: "db" };
  }
}

const switchSchema = z.object({
  key: z.enum(MESSAGE_KEYS),
  channel: z.enum(["email", "whatsapp"]),
  enabled: z.boolean(),
});

/**
 * The switch of one row of the list of Messages (a message and a channel), for
 * every language the row has. An administrator's act. It writes the switch and
 * NOTHING else: not a text, not a template, not the author or the date of an
 * edit (the list's "saved on" is the text's, not the switch's), and saving a
 * text never changes it.
 *
 * Off is an upsert on the row's address, so a message with no row gets one that
 * holds only the switch, and a row with a text keeps it. On only UPDATES the
 * rows that exist: no row already means on, and turning on never creates one.
 * What each sender does with an off message is in `renderMessageEmail` and
 * `notify-client`.
 */
export async function setMessageEnabled(
  accessToken: string | null,
  key: string,
  channel: string,
  enabled: boolean,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const parsed = switchSchema.safeParse({ key, channel, enabled });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const target = parsed.data;
  // A message that does not go out on WhatsApp has no WhatsApp switch.
  if (
    target.channel === "whatsapp" &&
    !MESSAGE_CATALOG[target.key].whatsappEligible
  ) {
    return { ok: false, error: "invalid" };
  }
  const locales =
    target.channel === "whatsapp"
      ? (["es", "en"] as const)
      : editableLocales(target.key);

  try {
    const db = getAdminClient().database;
    if (target.enabled) {
      const { error } = await db
        .from("message_templates")
        .update({ enabled: true })
        .eq("key", target.key)
        .eq("channel", target.channel)
        .in("locale", [...locales]);
      if (error) return { ok: false, error: "db" };
    } else {
      const { error } = await db.from("message_templates").upsert(
        locales.map((locale) => ({
          key: target.key,
          channel: target.channel,
          locale,
          enabled: false,
        })),
        { onConflict: "key,channel,locale" },
      );
      if (error) return { ok: false, error: "db" };
    }
    revalidatePath(PATH);
    return { ok: true };
  } catch {
    return { ok: false, error: "db" };
  }
}

/**
 * Five tests an hour per administrator, email and WhatsApp together. A WhatsApp
 * test is a real message from the centre's number and an email one is a real
 * send, so a stuck button must not be able to send dozens. Best-effort: it
 * lives in this process's memory and every serverless instance has its own, so
 * it is a brake and not a guarantee. Not shared with the campaign tests, whose
 * limiter is private to that module.
 */
const testLimiter = createRateLimiter({ max: 5, windowMs: 60 * 60 * 1000 });

/**
 * Sends one message, with example data, to the administrator who asked.
 *
 * The address or the phone is read here from the verified session or the
 * caller's own profile, never taken from the browser, so this cannot message
 * anyone else. Nothing is recorded, and the office does not get a blind copy.
 */
export async function sendTestMessage(
  accessToken: string | null,
  key: string,
  channel: string,
  locale: string,
): Promise<{ ok: true; to: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const address = addressSchema.safeParse({ key, channel, locale });
  if (!address.success) return { ok: false, error: "invalid" };
  const test = address.data;
  if (
    test.channel === "whatsapp" &&
    !MESSAGE_CATALOG[test.key].whatsappEligible
  ) {
    return { ok: false, error: "invalid" };
  }

  const db = getAdminClient().database;
  const log = () =>
    console.info("[messages] test", {
      admin: caller.userId,
      key: test.key,
      channel: test.channel,
      locale: test.locale,
    });

  if (test.channel === "email") {
    if (!caller.email) return { ok: false, error: "no_email" };

    let row: MessageRow | null;
    try {
      const { data, error } = await db
        .from("message_templates")
        .select("subject, preheader, title, doc, enabled")
        .eq("key", test.key)
        .eq("channel", "email")
        .eq("locale", test.locale)
        .maybeSingle();
      if (error) return { ok: false, error: "db" };
      row = (data as MessageRow | null) ?? null;
    } catch {
      return { ok: false, error: "db" };
    }

    let built: { subject: string; html: string };
    try {
      built = await buildTestEmail(test.key, test.locale, row);
    } catch (err) {
      console.error("[messages] test email could not be built:", err);
      return { ok: false, error: "email_failed" };
    }

    // Without a Resend key `sendEmail` skips the send and says nothing wrong:
    // a test that reports success and sends nothing would be a lie.
    if (!process.env.RESEND_API_KEY) {
      return { ok: false, error: "email_not_configured" };
    }
    // Counted only here, once everything that could be refused without
    // costing a send has been.
    if (!testLimiter.take(caller.userId)) {
      return { ok: false, error: "test_rate_limited" };
    }
    log();
    try {
      const { error } = await sendEmail({
        to: caller.email,
        subject: `[PRUEBA] ${built.subject}`,
        html: built.html,
        blindCopy: false,
      });
      if (error) {
        console.error("[messages] test email failed:", error.message);
        return { ok: false, error: "email_failed" };
      }
    } catch (err) {
      console.error("[messages] test email threw:", err);
      return { ok: false, error: "email_failed" };
    }
    return { ok: true, to: caller.email };
  }

  let phone: string | null = null;
  let template: Awaited<ReturnType<typeof loadWhatsAppTemplate>>;
  try {
    const profile = await db
      .from("profiles")
      .select("phone")
      .eq("id", caller.userId)
      .maybeSingle();
    if (profile.error) return { ok: false, error: "db" };
    phone = (profile.data as { phone: string | null } | null)?.phone ?? null;

    const saved = await db
      .from("message_templates")
      .select("whatsapp_template_id")
      .eq("key", test.key)
      .eq("channel", "whatsapp")
      .eq("locale", test.locale)
      .maybeSingle();
    if (saved.error) return { ok: false, error: "db" };
    template = await loadWhatsAppTemplate(
      db,
      (saved.data as { whatsapp_template_id: string | null } | null)
        ?.whatsapp_template_id,
    );
  } catch (err) {
    console.error("[messages] whatsapp test lookup failed:", err);
    return { ok: false, error: "db" };
  }

  const plan = prepareTestSend(template, test.locale, phone);
  if (!plan.ok) {
    return {
      ok: false,
      error: plan.error,
      ...(plan.detail ? { detail: plan.detail } : {}),
    };
  }
  if (!testLimiter.take(caller.userId)) {
    return { ok: false, error: "test_rate_limited" };
  }
  log();
  const result = await sendTemplateMessage(plan.send);
  if (result.status === "sent") return { ok: true, to: plan.to };
  if (result.status === "skipped") {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  return { ok: false, error: "meta", detail: result.error.slice(0, 300) };
}
