"use server";

import { revalidatePath } from "next/cache";
import {
  ADMIN_ROLES,
  AuthError,
  requireRole,
  type AuthContext,
} from "@/lib/auth-guard";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  createRemoteTemplate,
  isTemplateApiConfigured,
  listRemoteTemplates,
} from "@/lib/whatsapp/client";
import { countParams } from "@/lib/whatsapp/templates";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";
import {
  whatsappTemplateSchema,
  type WhatsAppTemplateInput,
} from "@/lib/schemas";

const PATH = "/dashboard/messages";

/** The only categories the dashboard knows how to show and send. */
const KNOWN_CATEGORIES = ["MARKETING", "UTILITY"];

type Failure = {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
};

async function admin(accessToken: string | null): Promise<AuthContext> {
  return requireRole(accessToken, ADMIN_ROLES);
}

function authFailure(err: unknown): Failure {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  throw err;
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : "unknown";
}

export async function listWhatsAppTemplates(
  accessToken: string | null,
): Promise<
  { ok: true; templates: WhatsAppTemplateRow[]; configured: boolean } | Failure
> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  try {
    const { data, error } = await getAdminClient()
      .database.from("whatsapp_templates")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: "db" };
    return {
      ok: true,
      templates: (data ?? []) as WhatsAppTemplateRow[],
      configured: isTemplateApiConfigured(),
    };
  } catch {
    return { ok: false, error: "db" };
  }
}

/**
 * Pulls every template from Meta and upserts it by (name, language).
 *
 * `created_by` and `created_at` are left out of the upsert on purpose, so a
 * template the admin wrote here keeps its author and its date. A template in a
 * category the dashboard cannot send (AUTHENTICATION, say) is skipped rather
 * than stored as MARKETING, which would put it behind the wrong consent rule;
 * `skipped` says how many.
 */
export async function syncWhatsAppTemplates(
  accessToken: string | null,
): Promise<{ ok: true; count: number; skipped: number } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  if (!isTemplateApiConfigured()) {
    return { ok: false, error: "whatsapp_not_configured" };
  }

  let remote;
  try {
    remote = await listRemoteTemplates();
  } catch (err) {
    return { ok: false, error: reason(err) };
  }

  const known = remote.filter((t) => KNOWN_CATEGORIES.includes(t.category));
  const skipped = remote.length - known.length;
  if (known.length === 0) return { ok: true, count: 0, skipped };

  const now = new Date().toISOString();
  try {
    const { error } = await getAdminClient()
      .database.from("whatsapp_templates")
      .upsert(
        known.map((t) => ({
          meta_id: t.metaId,
          name: t.name,
          language: t.language,
          category: t.category,
          status: t.status,
          header_text: t.headerText,
          body: t.body,
          footer_text: t.footerText,
          buttons: t.buttons,
          param_count: countParams(t.body),
          example_params: t.exampleParams,
          rejection_reason: t.rejectionReason,
          synced_at: now,
          updated_at: now,
        })),
        { onConflict: "name,language" },
      );
    if (error) return { ok: false, error: "db" };
  } catch {
    return { ok: false, error: "db" };
  }
  revalidatePath(PATH);
  return { ok: true, count: known.length, skipped };
}

/**
 * Saves the template locally and, when the WABA is configured, submits it to
 * Meta for review. Without the WABA it stays `draft`, visible but unusable.
 *
 * It never overwrites a template that is already past draft: an approved one
 * synced from Meta is the live copy, and replacing its body locally would
 * leave the dashboard showing text Meta never approved.
 */
export async function createWhatsAppTemplate(
  accessToken: string | null,
  input: WhatsAppTemplateInput,
): Promise<{ ok: true; id: string; status: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const parsed = whatsappTemplateSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.map(String).join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "invalid", fieldErrors };
  }
  const value = parsed.data;
  const db = getAdminClient().database;

  try {
    const { data: existing, error: lookupError } = await db
      .from("whatsapp_templates")
      .select("id,status")
      .eq("name", value.name)
      .eq("language", value.language)
      .maybeSingle();
    if (lookupError) return { ok: false, error: "db" };
    if (existing && (existing as { status: string }).status !== "draft") {
      return { ok: false, error: "templateExists" };
    }
  } catch {
    return { ok: false, error: "db" };
  }

  let metaId: string | null = null;
  let status = "draft";
  if (isTemplateApiConfigured()) {
    try {
      const created = await createRemoteTemplate({
        name: value.name,
        language: value.language,
        category: value.category,
        headerText: value.headerText || null,
        body: value.body,
        footerText: value.footerText || null,
        buttons: value.buttons,
        exampleParams: value.exampleParams,
      });
      metaId = created.id;
      status = created.status;
    } catch (err) {
      return { ok: false, error: reason(err) };
    }
  }

  const now = new Date().toISOString();
  try {
    const { data, error } = await db
      .from("whatsapp_templates")
      .upsert(
        {
          meta_id: metaId,
          name: value.name,
          language: value.language,
          category: value.category,
          status,
          header_text: value.headerText || null,
          body: value.body,
          footer_text: value.footerText || null,
          buttons: value.buttons,
          param_count: countParams(value.body),
          example_params: value.exampleParams,
          created_by: caller.userId,
          updated_at: now,
        },
        { onConflict: "name,language" },
      )
      .select("id")
      .single();
    if (error || !data) {
      // Meta already has it, so a retry would be refused as a duplicate; a
      // sync brings the copy in. The admin needs to hear that, not "db".
      return { ok: false, error: metaId ? "submittedNotSaved" : "db" };
    }
    revalidatePath(PATH);
    return { ok: true, id: (data as { id: string }).id, status };
  } catch {
    return { ok: false, error: metaId ? "submittedNotSaved" : "db" };
  }
}

/** Removes the local copy only; Meta keeps its own. */
export async function deleteWhatsAppTemplate(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  try {
    const { error } = await getAdminClient()
      .database.from("whatsapp_templates")
      .delete()
      .eq("id", id);
    if (error) return { ok: false, error: "db" };
  } catch {
    return { ok: false, error: "db" };
  }
  revalidatePath(PATH);
  return { ok: true };
}
