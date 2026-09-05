"use server";

import { revalidatePath } from "next/cache";
import { getAdminClient } from "@/lib/insforge-admin";
import {
  ADMIN_ROLES,
  AuthError,
  requireRole,
  type AuthContext,
} from "@/lib/auth-guard";
import {
  campaignAudienceSchema,
  requiredLocales,
  segmentSchema,
  validateCampaign,
  validateCampaignDraft,
} from "@/lib/schemas";
import { loadCandidates, resolveAudience } from "@/lib/campaigns/audience";
import { filterAudience } from "@/lib/campaigns/audience-filter";
import { dispatchCampaign, retryFailed } from "@/lib/campaigns/dispatch";
import { sendEmail } from "@/emails/send";
import { campaignEmail } from "@/emails/templates/campaign";
import {
  EMPTY_LOCALE_CONTENT,
  type AudiencePreview,
  type CampaignAudience,
  type CampaignContent,
  type CampaignInput,
  type CampaignLocale,
  type CampaignLocaleContent,
  type CampaignRecipientRow,
  type CampaignRow,
  type CampaignSegment,
  type CampaignContentSummary,
  type CampaignStats,
  type CampaignStatusCounts,
  type SegmentList,
  type SegmentMember,
  EMPTY_AUDIENCE,
  isAutomatedKind,
  type CampaignStatus,
  type ContactCampaignRow,
  type ContactSearchHit,
} from "@/types/campaign";

/**
 * Everything the campaigns screens call.
 *
 * Every function takes the caller's access token first and answers only to an
 * administrator: a campaign is the centre writing to every client at once, and
 * that is not a thing the front desk does on its own. Failures come back as
 * values, never as thrown errors, so a screen can show them.
 */

type Failure = { ok: false; error: string };

const LIST_PATH = "/dashboard/campaigns";

/** The statuses a campaign can still be edited or deleted in. */
const EDITABLE: CampaignStatus[] = [
  "draft",
  "scheduled",
  "cancelled",
  "failed",
  "paused",
  "active",
];
const DELETABLE: CampaignStatus[] = ["draft", "cancelled", "failed", "paused"];

async function admin(accessToken: string | null): Promise<AuthContext> {
  return requireRole(accessToken, ADMIN_ROLES);
}

function authFailure(err: unknown): Failure {
  if (err instanceof AuthError) return { ok: false, error: err.message };
  throw err;
}

function message(error: { message?: string } | null | undefined): string {
  return error?.message ?? "unknown";
}

// ─── Reading ────────────────────────────────────────────────────

export async function listCampaigns(
  accessToken: string | null,
  options: { status?: CampaignStatus | ""; page: number; pageSize: number },
): Promise<{ campaigns: CampaignRow[]; total: number }> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return { campaigns: [], total: 0 };
    throw err;
  }

  const page = Math.max(0, Math.floor(options.page));
  const size = Math.min(Math.max(1, Math.floor(options.pageSize)), 100);

  let query = getAdminClient()
    .database.from("campaigns")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * size, page * size + size - 1);
  if (options.status) query = query.eq("status", options.status);

  const { data, count, error } = await query;
  if (error) {
    console.error("[campaigns] list failed:", error);
    return { campaigns: [], total: 0 };
  }
  return { campaigns: (data ?? []) as CampaignRow[], total: count ?? 0 };
}

/** One count per status, for the cards that double as the list's filter. */
export async function fetchCampaignStatusCounts(
  accessToken: string | null,
): Promise<CampaignStatusCounts> {
  const empty: CampaignStatusCounts = {
    all: 0,
    draft: 0,
    scheduled: 0,
    sending: 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    active: 0,
    paused: 0,
  };
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return empty;
    throw err;
  }
  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .select("status")
    .range(0, 9_999);
  if (error) return empty;
  return ((data ?? []) as { status: CampaignStatus }[]).reduce(
    (acc, row) => {
      acc.all += 1;
      if (row.status in acc) acc[row.status] += 1;
      return acc;
    },
    { ...empty },
  );
}

/** Sent campaigns this calendar month, and what happened to their emails. */
export async function fetchCampaignStats(
  accessToken: string | null,
): Promise<CampaignStats> {
  const empty: CampaignStats = {
    sentThisMonth: 0,
    recipients: 0,
    delivered: 0,
    opened: 0,
  };
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return empty;
    throw err;
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .select("recipients_count, failed_count, delivered_count, opened_count")
    .eq("status", "sent")
    .gte("sent_at", monthStart.toISOString());
  if (error) return empty;

  type Row = {
    recipients_count: number;
    failed_count: number;
    delivered_count: number;
    opened_count: number;
  };
  return ((data ?? []) as Row[]).reduce<CampaignStats>(
    (acc, row) => ({
      sentThisMonth: acc.sentThisMonth + 1,
      recipients: acc.recipients + row.recipients_count - row.failed_count,
      delivered: acc.delivered + row.delivered_count,
      opened: acc.opened + row.opened_count,
    }),
    empty,
  );
}

/**
 * The failure states are the ones the admin needs to act on, so the
 * recipient list puts them first and the rest by address.
 */
const RECIPIENT_ORDER: Record<string, number> = {
  bounced: 0,
  complained: 1,
  failed: 2,
};

export async function fetchCampaign(
  accessToken: string | null,
  id: string,
): Promise<{
  campaign: CampaignRow | null;
  recipients: CampaignRecipientRow[];
}> {
  const nothing = { campaign: null, recipients: [] };
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return nothing;
    throw err;
  }

  const db = getAdminClient().database;
  const [campaignResult, recipientsResult] = await Promise.all([
    db.from("campaigns").select("*").eq("id", id).maybeSingle(),
    db
      .from("campaign_recipients")
      .select(
        "id, contact_id, email, language, status, cycle, variant, error, sent_at, delivered_at, opened_at, clicked_at",
      )
      .eq("campaign_id", id)
      .order("email", { ascending: true })
      .range(0, 9_999),
  ]);

  if (campaignResult.error || !campaignResult.data) return nothing;

  const recipients = (
    (recipientsResult.data ?? []) as CampaignRecipientRow[]
  ).sort(
    (a, b) =>
      (RECIPIENT_ORDER[a.status] ?? 9) - (RECIPIENT_ORDER[b.status] ?? 9),
  );

  return { campaign: campaignResult.data as CampaignRow, recipients };
}

// ─── Writing ────────────────────────────────────────────────────

/** Whether another campaign already carries this name, ignoring case. */
async function nameTaken(
  name: string,
  exceptId: string | null,
): Promise<boolean> {
  let query = getAdminClient()
    .database.from("campaigns")
    .select("id", { count: "exact", head: true })
    .ilike("name", name.trim());
  if (exceptId) query = query.neq("id", exceptId);
  const { count } = await query;
  return (count ?? 0) > 0;
}

/**
 * The form asks this as the admin leaves the name field, so the answer comes
 * before anything else is written. The unique index on the table is what
 * holds when two people race; `saveCampaign` translates that refusal too.
 */
export async function isCampaignNameTaken(
  accessToken: string | null,
  name: string,
  exceptId: string | null,
): Promise<boolean> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return false;
    throw err;
  }
  if (name.trim() === "") return false;
  return nameTaken(name, exceptId);
}

const UNIQUE_VIOLATION = "23505";

function isNameCollision(error: { code?: string; message?: string } | null) {
  return (
    error?.code === UNIQUE_VIOLATION ||
    (error?.message ?? "").includes("_unique_name")
  );
}

/** Recent campaigns' words, for "start from a campaign I already wrote". */
export async function listCampaignContents(
  accessToken: string | null,
): Promise<CampaignContentSummary[]> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .select("id, name, kind, sent_at, content")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return ((data ?? []) as CampaignContentSummary[]).filter((row) => {
    const es = row.content?.es;
    const en = row.content?.en;
    return Boolean(es?.blocks?.length || en?.blocks?.length);
  });
}

// ─── Segments ───────────────────────────────────────────────────

const SEGMENT_FIELDS = "id, name, conditions, created_at, updated_at";

/**
 * Every saved segment, by name, each with the number of people it reaches
 * today — plus the count for "everyone". One read of the tables serves all
 * of them.
 */
export async function listSegments(
  accessToken: string | null,
): Promise<SegmentList> {
  const empty: SegmentList = { everyone: 0, segments: [] };
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return empty;
    throw err;
  }
  const { data, error } = await getAdminClient()
    .database.from("campaign_segments")
    .select(SEGMENT_FIELDS)
    .order("name", { ascending: true })
    .range(0, 499);
  if (error) return empty;

  try {
    const candidates = await loadCandidates();
    const now = new Date();
    const count = (conditions: CampaignSegment["conditions"]) =>
      filterAudience(candidates, { ...conditions, manualIds: [] }, now).length;
    return {
      everyone: count(EMPTY_AUDIENCE),
      segments: ((data ?? []) as CampaignSegment[]).map((segment) => ({
        ...segment,
        count: count(segment.conditions),
      })),
    };
  } catch (err) {
    console.error("[campaigns] segment counts failed:", err);
    return {
      everyone: 0,
      segments: ((data ?? []) as CampaignSegment[]).map((s) => ({
        ...s,
        count: 0,
      })),
    };
  }
}

/**
 * Creates or updates a segment. Editing one changes only the segment: the
 * campaigns that already used it keep the copy of the conditions they saved.
 */
export async function saveSegment(
  accessToken: string | null,
  input: { id: string | null; name: string; conditions: unknown },
): Promise<{ ok: true; segment: CampaignSegment } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const parsed = segmentSchema.safeParse({
    name: input.name,
    conditions: input.conditions,
  });
  if (!parsed.success) {
    const nameIssue = parsed.error.issues.find((i) => i.path[0] === "name");
    return { ok: false, error: nameIssue ? nameIssue.message : "invalid" };
  }

  const db = getAdminClient().database;
  let taken = db
    .from("campaign_segments")
    .select("id", { count: "exact", head: true })
    .ilike("name", parsed.data.name);
  if (input.id) taken = taken.neq("id", input.id);
  if (((await taken).count ?? 0) > 0) return { ok: false, error: "nameTaken" };

  const now = new Date().toISOString();
  const query = input.id
    ? db
        .from("campaign_segments")
        .update({ ...parsed.data, updated_at: now })
        .eq("id", input.id)
        .select(SEGMENT_FIELDS)
        .single()
    : db
        .from("campaign_segments")
        .insert({ ...parsed.data, created_by: caller.userId })
        .select(SEGMENT_FIELDS)
        .single();
  const { data, error } = await query;
  if (error || !data) {
    if (isNameCollision(error)) return { ok: false, error: "nameTaken" };
    return { ok: false, error: message(error) };
  }
  return { ok: true, segment: data as CampaignSegment };
}

/** Everyone a segment reaches today, with the details the page shows. */
export async function listSegmentMembers(
  accessToken: string | null,
  conditions: unknown,
): Promise<SegmentMember[]> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
  const parsed = campaignAudienceSchema.safeParse({
    ...(typeof conditions === "object" && conditions ? conditions : {}),
    manualIds: [],
  });
  if (!parsed.success) return [];

  const recipients = await resolveAudience(parsed.data).catch(() => []);
  if (recipients.length === 0) return [];
  const byId = new Map(recipients.map((r) => [r.id, r]));

  const { data, error } = await getAdminClient()
    .database.from("contacts")
    .select("id, first_name, last_name, email, phone, newsletter_subscribed")
    .in("id", [...byId.keys()].slice(0, 5000))
    .order("first_name", { ascending: true });
  if (error) return [];

  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    newsletter_subscribed: boolean | null;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: byId.get(row.id)?.email ?? row.email ?? "",
    phone: row.phone,
    language: byId.get(row.id)?.language ?? "en",
    newsletter: row.newsletter_subscribed === true,
  }));
}

/** Removes a segment; campaigns that used it keep their copied conditions. */
export async function deleteSegment(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  const { error } = await getAdminClient()
    .database.from("campaign_segments")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: message(error) };
  return { ok: true };
}

export async function saveCampaign(
  accessToken: string | null,
  input: CampaignInput,
  /** A draft only needs a name and well-formed fields; a send needs it all. */
  options: { draft?: boolean } = {},
): Promise<
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const check = options.draft ? validateCampaignDraft : validateCampaign;
  const validated = check({
    name: input.name,
    audience: input.audience,
    content: input.content,
  });
  if (!validated.ok) {
    return { ok: false, error: "invalid", fieldErrors: validated.errors };
  }

  const db = getAdminClient().database;
  const now = new Date().toISOString();
  const row = {
    ...validated.data,
    segment_id: input.segmentId ?? null,
    updated_at: now,
  };

  if (await nameTaken(validated.data.name, input.id ?? null)) {
    return { ok: false, error: "invalid", fieldErrors: { name: "nameTaken" } };
  }

  if (input.id) {
    // Editing a cancelled or failed campaign brings it back as a draft; a
    // draft or a scheduled one keeps its state, the schedule included.
    const { data, error } = await db
      .from("campaigns")
      .select("status")
      .eq("id", input.id)
      .maybeSingle();
    const status = (data as { status: CampaignStatus } | null)?.status;
    if (error || !status) return { ok: false, error: "not_found" };
    if (!EDITABLE.includes(status)) return { ok: false, error: "locked" };

    const { error: updateError } = await db
      .from("campaigns")
      .update({
        ...row,
        ...(status === "cancelled" || status === "failed"
          ? { status: "draft", scheduled_at: null, last_error: null }
          : {}),
      })
      .eq("id", input.id);
    if (updateError) {
      if (isNameCollision(updateError)) {
        return {
          ok: false,
          error: "invalid",
          fieldErrors: { name: "nameTaken" },
        };
      }
      return { ok: false, error: message(updateError) };
    }

    revalidatePath(LIST_PATH);
    return { ok: true, id: input.id };
  }

  const { data, error } = await db
    .from("campaigns")
    .insert({ ...row, status: "draft", created_by: caller.userId })
    .select("id")
    .single();
  if (error || !data) {
    if (isNameCollision(error)) {
      return {
        ok: false,
        error: "invalid",
        fieldErrors: { name: "nameTaken" },
      };
    }
    return { ok: false, error: message(error) };
  }

  revalidatePath(LIST_PATH);
  return { ok: true, id: (data as { id: string }).id };
}

export async function deleteCampaign(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .delete()
    .eq("id", id)
    .in("status", DELETABLE)
    .select("id");
  if (error) return { ok: false, error: message(error) };
  if (!data || (data as unknown[]).length === 0) {
    return { ok: false, error: "locked" };
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

export async function duplicateCampaign(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true; id: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const db = getAdminClient().database;
  const { data: source, error } = await db
    .from("campaigns")
    .select("name, audience, content")
    .eq("id", id)
    .maybeSingle();
  if (error || !source) return { ok: false, error: "not_found" };

  const original = source as Pick<CampaignRow, "name" | "audience" | "content">;

  // "(copia)", then "(copia 2)", and so on: the name index refuses repeats.
  let copyName = `${original.name} (copia)`;
  for (let n = 2; (await nameTaken(copyName, null)) && n < 50; n += 1) {
    copyName = `${original.name} (copia ${n})`;
  }

  const { data, error: insertError } = await db
    .from("campaigns")
    .insert({
      name: copyName,
      audience: original.audience,
      content: original.content,
      status: "draft",
      created_by: caller.userId,
    })
    .select("id")
    .single();
  if (insertError || !data) return { ok: false, error: message(insertError) };

  revalidatePath(LIST_PATH);
  return { ok: true, id: (data as { id: string }).id };
}

// ─── Audience ───────────────────────────────────────────────────

export async function previewAudience(
  accessToken: string | null,
  audience: CampaignAudience,
): Promise<AudiencePreview | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const parsed = campaignAudienceSchema.safeParse(audience);
  if (!parsed.success) return { ok: false, error: "invalid" };

  try {
    const recipients = await resolveAudience(parsed.data);
    return {
      count: recipients.length,
      byLanguage: {
        en: recipients.filter((r) => r.language === "en").length,
        es: recipients.filter((r) => r.language === "es").length,
      },
      sample: recipients.slice(0, 20).map((r) => ({
        id: r.id,
        name: r.firstName,
        email: r.email,
        language: r.language,
      })),
    };
  } catch (err) {
    console.error("[campaigns] preview failed:", err);
    return { ok: false, error: "db" };
  }
}

/** Up to twenty contacts matching a name or address, for the manual picker. */
export async function searchContactsForCampaign(
  accessToken: string | null,
  query: string,
): Promise<ContactSearchHit[]> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }

  // PostgREST's filter grammar uses commas and parentheses; a term carrying
  // them would be parsed as syntax rather than searched for.
  const term = query.trim().replace(/[,()*]/g, "");
  if (term.length < 2) return [];

  const { data, error } = await getAdminClient()
    .database.from("contacts")
    .select("id, first_name, last_name, email, preferred_language")
    .not("email", "is", null)
    .is("email_bounced_at", null)
    .or(
      `email.ilike.*${term}*,first_name.ilike.*${term}*,last_name.ilike.*${term}*`,
    )
    .order("first_name", { ascending: true })
    .limit(20);
  if (error) return [];

  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    preferred_language: string | null;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" "),
    email: row.email,
    language: row.preferred_language === "es" ? "es" : "en",
  }));
}

// ─── Content ────────────────────────────────────────────────────

/**
 * The HTML for the preview pane, from whatever the admin has typed so far.
 *
 * Deliberately not validated: a half-written email should still show up in
 * the pane. The template escapes everything, so an unfinished draft cannot
 * render anything the finished one could not.
 */
export async function renderCampaignPreview(
  accessToken: string | null,
  content: Partial<CampaignLocaleContent>,
  locale: CampaignLocale,
): Promise<{ html: string } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const { html } = campaignEmail({
    content: withDefaults(content),
    firstName: locale === "es" ? "Ana" : "Anna",
    unsubscribeUrl: "#",
    locale,
  });
  return { html };
}

function withDefaults(
  content: Partial<CampaignLocaleContent> | undefined,
): CampaignLocaleContent {
  const out: CampaignLocaleContent = { ...EMPTY_LOCALE_CONTENT, blocks: [] };
  for (const key of ["subject", "preheader", "title"] as const) {
    const value = content?.[key];
    if (typeof value === "string") out[key] = value;
  }
  // Only blocks the template knows how to draw; anything else is dropped
  // rather than risk a preview that throws on a half-typed block.
  out.blocks = Array.isArray(content?.blocks)
    ? content.blocks.filter(
        (block): block is CampaignLocaleContent["blocks"][number] =>
          typeof block === "object" && block !== null && "type" in block,
      )
    : [];
  return out;
}

/**
 * Sends the campaign, as written, to the administrator who asked.
 *
 * Nothing is recorded: a test is the admin reading their own draft, not a
 * recipient. The subject is prefixed so it cannot be mistaken for the real
 * send in a busy inbox.
 */
export async function sendTestCampaign(
  accessToken: string | null,
  content: CampaignContent,
  audience: Pick<CampaignAudience, "language" | "sendLocale">,
): Promise<{ ok: true; to: string } | Failure> {
  let caller: AuthContext;
  try {
    caller = await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  if (!caller.email) return { ok: false, error: "no_email" };

  for (const locale of requiredLocales(audience)) {
    const { subject, html } = campaignEmail({
      content: withDefaults(content[locale]),
      firstName: locale === "es" ? "Ana" : "Anna",
      unsubscribeUrl: "#",
      locale,
    });
    const { error } = await sendEmail({
      to: caller.email,
      subject: `[PRUEBA] ${subject}`,
      html,
      blindCopy: false,
    });
    if (error) return { ok: false, error: error.message };
  }

  return { ok: true, to: caller.email };
}

// ─── Sending ────────────────────────────────────────────────────

export async function sendCampaignNow(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true; sent: number; failed: number } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const result = await dispatchCampaign(id);
  revalidatePath(LIST_PATH);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sent: result.sent, failed: result.failed };
}

export async function scheduleCampaign(
  accessToken: string | null,
  id: string,
  scheduledAtIso: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
    return { ok: false, error: "past" };
  }

  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .update({
      status: "scheduled",
      scheduled_at: when.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", EDITABLE)
    .select("id");
  if (error) return { ok: false, error: message(error) };
  if (!data || (data as unknown[]).length === 0) {
    return { ok: false, error: "locked" };
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

/**
 * Switches an automated campaign on. Held to the full rules, like a send:
 * from now on the cron mails whoever qualifies, once per occasion.
 */
export async function activateCampaign(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const db = getAdminClient().database;
  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "not_found" };
  const row = data as CampaignRow;
  if (!isAutomatedKind(row.kind)) return { ok: false, error: "locked" };

  const check = validateCampaign({
    name: row.name,
    kind: row.kind,
    trigger: row.trigger,
    audience: row.audience,
    content: row.content,
  });
  if (!check.ok) return { ok: false, error: "invalid" };

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from("campaigns")
    .update({
      status: "active",
      // A paused campaign resumes where it left off; a fresh one starts now,
      // so nobody who qualified in the past is mailed late.
      activated_at: row.activated_at ?? now,
      updated_at: now,
      last_error: null,
    })
    .eq("id", id)
    .in("status", ["draft", "paused", "failed", "cancelled"])
    .select("id");
  if (updateError) return { ok: false, error: message(updateError) };
  if (!updated || (updated as unknown[]).length === 0) {
    return { ok: false, error: "locked" };
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

/** Switches an automated campaign off; its history stays. */
export async function pauseCampaign(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .update({ status: "paused", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "active")
    .select("id");
  if (error) return { ok: false, error: message(error) };
  if (!data || (data as unknown[]).length === 0) {
    return { ok: false, error: "locked" };
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

/** Only a scheduled campaign can be cancelled; a sent one is already gone. */
export async function cancelCampaign(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const { data, error } = await getAdminClient()
    .database.from("campaigns")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "scheduled")
    .select("id");
  if (error) return { ok: false, error: message(error) };
  if (!data || (data as unknown[]).length === 0) {
    return { ok: false, error: "locked" };
  }

  revalidatePath(LIST_PATH);
  return { ok: true };
}

export async function retryFailedRecipients(
  accessToken: string | null,
  id: string,
): Promise<{ ok: true; sent: number; failed: number } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const result = await retryFailed(id);
  revalidatePath(LIST_PATH);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, sent: result.sent, failed: result.failed };
}

// ─── Contacts ───────────────────────────────────────────────────

export async function fetchContactCampaigns(
  accessToken: string | null,
  contactId: string,
): Promise<ContactCampaignRow[]> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }

  const { data, error } = await getAdminClient()
    .database.from("campaign_recipients")
    .select("id, status, sent_at, campaigns(id, name, sent_at)")
    .eq("contact_id", contactId)
    .order("sent_at", { ascending: false, nullsFirst: false });
  if (error) return [];

  type Row = Omit<ContactCampaignRow, "campaign"> & {
    campaigns:
      | ContactCampaignRow["campaign"]
      | NonNullable<ContactCampaignRow["campaign"]>[]
      | null;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    status: row.status,
    sent_at: row.sent_at,
    campaign: Array.isArray(row.campaigns)
      ? (row.campaigns[0] ?? null)
      : row.campaigns,
  }));
}

/**
 * Lets a bounced address back into campaigns.
 *
 * Staff do this after talking to the client — a corrected address, a full
 * mailbox since emptied. Nothing else clears the flag.
 */
export async function clearContactBounce(
  accessToken: string | null,
  contactId: string,
): Promise<{ ok: true } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const { error } = await getAdminClient()
    .database.from("contacts")
    .update({ email_bounced_at: null })
    .eq("id", contactId);
  if (error) return { ok: false, error: message(error) };
  return { ok: true };
}

/** The names behind a saved campaign's manual picks, for the editor's chips. */
export async function fetchContactsByIds(
  accessToken: string | null,
  ids: string[],
): Promise<ContactSearchHit[]> {
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return [];
    throw err;
  }
  if (ids.length === 0) return [];

  const { data, error } = await getAdminClient()
    .database.from("contacts")
    .select("id, first_name, last_name, email, preferred_language")
    .in("id", ids.slice(0, 5000));
  if (error) return [];

  type Row = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    preferred_language: string | null;
  };
  return ((data ?? []) as Row[]).map((row) => ({
    id: row.id,
    name: [row.first_name, row.last_name].filter(Boolean).join(" "),
    email: row.email ?? "",
    language: row.preferred_language === "es" ? "es" : "en",
  }));
}
