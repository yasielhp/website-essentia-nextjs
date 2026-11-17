"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { defaultContent } from "@/emails/defaults";
import { sendEmail } from "@/emails/send";
import { loadWhatsAppTemplate } from "@/lib/campaigns/dispatch-whatsapp";
import { createRateLimiter } from "@/lib/campaigns/rate-limit";
import { whatsappTemplateEligibility } from "@/lib/campaigns/whatsapp-eligibility";
import { prepareTestSend } from "@/lib/campaigns/whatsapp-test-send";
import {
  ADMIN_ROLES,
  AuthError,
  requireRole,
  type AuthContext,
} from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import { MESSAGE_CATALOG, MESSAGE_KEYS } from "@/lib/messages/catalog";
import type { MessageRow } from "@/lib/messages/compose";
import { toRowPayload, validateMessageTemplate } from "@/lib/messages/schema";
import { buildTestEmail } from "@/lib/messages/test-email";
import type {
  MessageCatalogEntry,
  MessageDefaultEntry,
  MessageTemplateRowView,
} from "@/lib/messages/types";
import { sendTemplateMessage } from "@/lib/whatsapp/client";
import type { WhatsAppParamSource } from "@/lib/whatsapp/types";

const PATH = "/dashboard/messages";
const LOCALES = ["en", "es"] as const;

/**
 * `error` is always a key the dashboard translates. Nothing Postgres or the
 * mailer said reaches the browser: `detail` carries only what is safe to show
 * (eligibility codes, the names the admin typed, Meta's words about the
 * template).
 */
type Failure = {
  ok: false;
  error: string;
  detail?: string;
  fieldErrors?: Record<string, string>;
};

async function admin(accessToken: string | null): Promise<AuthContext> {
  return requireRole(accessToken, ADMIN_ROLES);
}

function authFailure(err: unknown): Failure {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  throw err;
}

const addressSchema = z.object({
  key: z.enum(MESSAGE_KEYS),
  channel: z.enum(["email", "whatsapp"]),
  locale: z.enum(LOCALES),
});

const ROW_COLUMNS =
  "key, channel, locale, enabled, subject, preheader, title, doc, whatsapp_template_id, whatsapp_params, updated_at";

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
    return {
      ok: true,
      // The SDK types rows as `any`; the columns selected are the row type.
      rows: (data ?? []) as MessageTemplateRowView[],
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
 * Saving only the switch (the reminder on or off) creates no content: a new
 * row keeps its text columns NULL, which is "the email that has always gone
 * out", and an existing row keeps the text it has. The default text is never
 * copied into a row, here or by opening the editor.
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

  // It came over the wire: whatever the type says, it is validated as unknown.
  const parsed = validateMessageTemplate(input);
  if (!parsed.ok) {
    return {
      ok: false,
      error: "invalid",
      fieldErrors: parsed.fieldErrors,
      ...(parsed.unknownVariables
        ? { detail: parsed.unknownVariables.join(", ") }
        : {}),
    };
  }
  const write = parsed.data;
  const db = getAdminClient().database;

  if (write.channel === "whatsapp" && write.enabled) {
    // What a database read can add to the schema: the template must exist and
    // be sendable in this language with exactly these parameters.
    const fieldErrors: Record<string, string> = {};
    try {
      let templateId = write.whatsapp?.templateId ?? null;
      let params: WhatsAppParamSource[] = write.whatsapp?.params ?? [];
      if (!write.whatsapp) {
        // Only the switch: it keeps the template the row already has.
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
        templateId = existing?.whatsapp_template_id ?? null;
        params = existing?.whatsapp_params ?? [];
      }
      if (templateId === null) {
        fieldErrors.whatsappTemplateId = "templateRequired";
      } else {
        const template = await loadWhatsAppTemplate(db, templateId);
        const issue = whatsappTemplateEligibility(
          template,
          write.locale,
          params,
        );
        if (issue === "param_count") {
          fieldErrors.whatsappParams = "paramCountMismatch";
        } else if (issue) {
          fieldErrors.whatsappTemplateId = "templateUnavailable";
        }
      }
    } catch (err) {
      console.error("[messages] template lookup failed:", err);
      return { ok: false, error: "db" };
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { ok: false, error: "invalid", fieldErrors };
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
 * Deletes the saved version: the message goes back to the email (or the
 * default) it had before anyone edited it. Idempotent: resetting what was
 * never saved is a success.
 */
export async function resetMessageTemplate(
  accessToken: string | null,
  key: string,
  channel: string,
  locale: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const address = addressSchema.safeParse({ key, channel, locale });
  if (!address.success) return { ok: false, error: "invalid" };
  try {
    const { error } = await getAdminClient()
      .database.from("message_templates")
      .delete()
      .eq("key", address.data.key)
      .eq("channel", address.data.channel)
      .eq("locale", address.data.locale);
    if (error) return { ok: false, error: "db" };
  } catch {
    return { ok: false, error: "db" };
  }
  revalidatePath(PATH);
  return { ok: true };
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

    // Counted only here, once everything that could be refused without
    // costing a send has been.
    if (!testLimiter.take(caller.userId)) {
      return { ok: false, error: "test_rate_limited" };
    }
    log();
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
