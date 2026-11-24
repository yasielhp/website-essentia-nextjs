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
  campaignChannelSchema,
  campaignKindSchema,
  channelChangeAllowed,
  requiredLocales,
  sendLocaleOf,
  segmentSchema,
  validateCampaign,
  validateCampaignDraft,
  whatsappContentSchema,
} from "@/lib/schemas";
import { loadCandidates, resolveAudience } from "@/lib/campaigns/audience";
import { docIsEmpty } from "@/lib/campaigns/doc";
import { filterAudience } from "@/lib/campaigns/audience-filter";
import { deadlineFrom } from "@/lib/campaigns/deadline";
import { dispatchCampaign, retryFailed } from "@/lib/campaigns/dispatch";
import { SENT_STATUSES } from "@/lib/campaigns/report";
import { loadWhatsAppTemplate } from "@/lib/campaigns/dispatch-whatsapp";
import { kindSwitchAllowed } from "@/lib/campaigns/appointment-form";
import {
  countPicked,
  normalizeSegmentConditions,
  segmentKindOf,
} from "@/lib/campaigns/segment-conditions";
import { toSegmentPerson } from "@/lib/campaigns/segment-people";
import { createRateLimiter } from "@/lib/campaigns/rate-limit";
import { templateGate } from "@/lib/campaigns/template-gate";
import { whatsappContentErrors } from "@/lib/campaigns/whatsapp-eligibility";
import { prepareTestSend } from "@/lib/campaigns/whatsapp-test-send";
import { sendTemplateMessage } from "@/lib/whatsapp/client";
import {
  sendOutcome,
  type SendFailure,
  type SendOutcome,
} from "@/lib/campaigns/send-outcome";
import {
  isSuppressionTableMissing,
  WHATSAPP_NOT_READY,
} from "@/lib/campaigns/audience-reach";
import { readAllPages } from "@/lib/campaigns/paged-read";
import { incompleteError } from "@/lib/campaigns/languages";
import { refusalOfSave, saveStrictness } from "@/lib/campaigns/save-mode";
import { sendEmail } from "@/emails/send";
import { campaignEmail } from "@/emails/templates/campaign";
import {
  EMPTY_LOCALE_CONTENT,
  type AudiencePreview,
  type CampaignAudience,
  type SegmentPerson,
  type CampaignChannel,
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
  consentPurposeOf,
  type CampaignKind,
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

type Failure = SendFailure;

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
  options: {
    status?: CampaignStatus | "";
    /** Only the campaigns of this channel; absent or empty means both. */
    channel?: CampaignChannel | "";
    page: number;
    pageSize: number;
  },
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
  if (options.channel) {
    const channel = campaignChannelSchema.safeParse(options.channel);
    if (!channel.success) return { campaigns: [], total: 0 };
    query = query.eq("channel", channel.data);
  }

  const { data, count, error } = await query;
  if (error) {
    console.error("[campaigns] list failed:", error);
    return { campaigns: [], total: 0 };
  }
  const campaigns = (data ?? []) as CampaignRow[];
  await addSentCounts(campaigns);
  return { campaigns, total: count ?? 0 };
}

/** The WhatsApp states in which `recipients_count` still includes rows not yet sent. */
const UNFINISHED: CampaignStatus[] = ["sending", "failed", "paused", "active"];

/**
 * Gives each unfinished WhatsApp campaign of a page its real `sent_count`, from
 * its rows (one small count each, for at most a page of them). Every other
 * campaign keeps `recipients_count - failed_count`, which is right once the
 * send is over and cheap. A count that fails leaves the row without one.
 */
async function addSentCounts(campaigns: CampaignRow[]): Promise<void> {
  const open = campaigns.filter(
    (c) => c.channel === "whatsapp" && UNFINISHED.includes(c.status),
  );
  if (open.length === 0) return;
  const db = getAdminClient().database;
  await Promise.all(
    open.map(async (campaign) => {
      try {
        const { count, error } = await db
          .from("campaign_recipients")
          .select("id", { count: "exact" })
          .eq("campaign_id", campaign.id)
          .in("status", [...SENT_STATUSES])
          .range(0, 0);
        if (!error && count !== null) campaign.sent_count = count;
      } catch {
        // The list still shows the campaign, with the approximate count.
      }
    }),
  );
}

/**
 * One count per status, for the cards that double as the list's filter. Null
 * when it could not be counted (the session, the database): zeros would read as
 * "no campaigns", so the cards say they could not be read instead.
 */
export async function fetchCampaignStatusCounts(
  accessToken: string | null,
  /** Count only this channel's campaigns; absent or empty means both. */
  channel?: CampaignChannel | "",
): Promise<CampaignStatusCounts | null> {
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
    if (err instanceof AuthError) return null;
    throw err;
  }
  let channelFilter: CampaignChannel | null = null;
  if (channel) {
    const parsed = campaignChannelSchema.safeParse(channel);
    if (!parsed.success) return null;
    channelFilter = parsed.data;
  }
  // The database gives a thousand rows at most: read to the end, or not at all.
  let data: { status: CampaignStatus }[];
  try {
    data = await readAllPages<{ status: CampaignStatus }>(
      "[fetchCampaignStatusCounts] campaigns",
      (from, to) => {
        let query = getAdminClient()
          .database.from("campaigns")
          .select("status")
          .order("id", { ascending: true });
        if (channelFilter) query = query.eq("channel", channelFilter);
        return query.range(from, to) as unknown as PromiseLike<{
          data: { status: CampaignStatus }[] | null;
          error: { message: string } | null;
        }>;
      },
    );
  } catch {
    return null;
  }
  return data.reduce(
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
  const RECIPIENT_COLUMNS =
    "id, contact_id, email, phone, language, status, cycle, variant, error, vars, sent_at, delivered_at, opened_at, clicked_at, read_at";
  // Page by page: the database gives a thousand rows at most, and a report of
  // a bigger campaign must not stop at the first thousand.
  const readRecipients = (columns: string) =>
    readAllPages<Record<string, unknown>>(
      "[fetchCampaign] recipients",
      (from, to) =>
        db
          .from("campaign_recipients")
          .select(columns)
          .eq("campaign_id", id)
          .order("email", { ascending: true })
          // WhatsApp rows have no email, so they tie on it: the phone settles the
          // order, or the list would shuffle between two reloads. The id closes
          // the order, so one page ends where the next begins.
          .order("phone", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to) as unknown as PromiseLike<{
          data: Record<string, unknown>[] | null;
          error: { message: string } | null;
        }>,
    );
  // The name comes with the row through the contact it points to (one read,
  // no list of ids). If that embedding is refused, the report is the same
  // as before, without names: a name is never worth losing the report.
  const recipientRows = (async () => {
    try {
      return await readRecipients(
        `${RECIPIENT_COLUMNS}, contacts(first_name, last_name)`,
      );
    } catch {
      return readRecipients(RECIPIENT_COLUMNS);
    }
  })();
  const [campaignResult, recipientData] = await Promise.all([
    db.from("campaigns").select("*").eq("id", id).maybeSingle(),
    recipientRows.then(
      (data) => ({ data, failed: false }),
      () => ({ data: [] as Record<string, unknown>[], failed: true }),
    ),
  ]);

  if (campaignResult.error || !campaignResult.data) return nothing;
  // A report that could not read all its rows is not a shorter report: the
  // page is told it failed (and offers to try again), never shown a part.
  if (recipientData.failed) {
    throw new Error("[fetchCampaign] the recipients could not be read");
  }

  type JoinedContact = { first_name: string | null; last_name: string | null };
  const recipients = (
    recipientData.data as unknown as (CampaignRecipientRow & {
      contacts?: JoinedContact | JoinedContact[] | null;
    })[]
  )
    .map(({ contacts, ...row }) => {
      const contact = Array.isArray(contacts) ? contacts[0] : contacts;
      const name = [contact?.first_name, contact?.last_name]
        .filter((part) => part && part.trim() !== "")
        .join(" ");
      return { ...row, contact_name: name === "" ? null : name };
    })
    .sort(
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
  return ((data ?? []) as CampaignContentSummary[]).filter(
    (row) =>
      !docIsEmpty(row.content?.es?.doc) || !docIsEmpty(row.content?.en?.doc),
  );
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
  channel: CampaignChannel = "email",
): Promise<SegmentList> {
  // Every way out that is not the list says it failed: an empty answer would
  // read as "no segments" or "0 people".
  const empty: SegmentList = { failed: true, everyone: 0, segments: [] };
  try {
    await admin(accessToken);
  } catch (err) {
    if (err instanceof AuthError) return empty;
    throw err;
  }
  if (!campaignChannelSchema.safeParse(channel).success) return empty;
  const { data, error } = await getAdminClient()
    .database.from("campaign_segments")
    .select(SEGMENT_FIELDS)
    .order("name", { ascending: true })
    .range(0, 499);
  if (error) return empty;

  try {
    const candidates = await loadCandidates(channel);
    const now = new Date();
    // A saved list carries its people and `manualOnly`: they are counted as the
    // send will resolve them, exclusions included. A filter has neither key.
    const count = (
      conditions: Omit<CampaignAudience, "manualIds" | "sendLocale"> &
        Partial<Pick<CampaignAudience, "manualIds">>,
    ) =>
      filterAudience(
        candidates,
        { ...conditions, manualIds: conditions.manualIds ?? [] },
        now,
        channel,
      ).length;
    const saved = (data ?? []) as CampaignSegment[];
    // The people of a list that are still contacts, counted as the page of the
    // list counts them (everyone with an address or a phone), not by the ids
    // stored, which may include somebody deleted since. One light read, only
    // when there is a list to count.
    const existing = saved.some((s) => segmentKindOf(s.conditions) === "list")
      ? new Set(
          (
            await readAllPages<{ id: string }>(
              "[listSegments] contacts",
              (from, to) =>
                getAdminClient()
                  .database.from("contacts")
                  .select("id")
                  .or("email.not.is.null,phone.not.is.null")
                  .order("id", { ascending: true })
                  .range(from, to) as unknown as PromiseLike<{
                  data: { id: string }[] | null;
                  error: { message: string } | null;
                }>,
            )
          ).map((c) => c.id),
        )
      : null;
    return {
      everyone: count(EMPTY_AUDIENCE),
      segments: saved.map((segment) => ({
        ...segment,
        count: count(segment.conditions),
        ...(existing && segmentKindOf(segment.conditions) === "list"
          ? { picked: countPicked(segment.conditions.manualIds, existing) }
          : {}),
      })),
    };
  } catch (err) {
    console.error("[campaigns] segment counts failed:", err);
    // The names are here but the counts are not: a count of 0 would be a lie.
    return {
      failed: true,
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

  // A list is stored with the other conditions at their neutral value, a
  // filter with no list: what is saved is what the segment is.
  parsed.data.conditions = normalizeSegmentConditions(parsed.data.conditions);

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
  // A saved list keeps its people: they are listed as the send would resolve
  // them, so one who unsubscribed or was deleted is not shown as reachable.
  const given =
    typeof conditions === "object" && conditions
      ? (conditions as { manualIds?: unknown })
      : {};
  const parsed = campaignAudienceSchema.safeParse({
    ...given,
    manualIds: Array.isArray(given.manualIds) ? given.manualIds : [],
  });
  if (!parsed.success) return [];

  // Everything the page shows travels with the recipient: a second query
  // filtered by a hundred ids is the kind of URL the gateway refuses.
  // A read that fails throws: the page says so, instead of an empty list that
  // would read as "nobody".
  const recipients = await resolveAudience(parsed.data);
  return recipients
    .map((r) => ({
      id: r.id,
      first_name: r.firstName || null,
      last_name: r.lastName ?? null,
      email: r.email ?? "",
      phone: r.phone ?? null,
      language: r.language,
      newsletter: r.newsletter ?? false,
    }))
    .sort((a, b) =>
      `${a.first_name ?? ""} ${a.last_name ?? ""}`.localeCompare(
        `${b.first_name ?? ""} ${b.last_name ?? ""}`,
      ),
    );
}

/**
 * Everyone a segment can be made of: every contact with an address or a phone,
 * with what the filters read and what already keeps a channel from reaching her.
 * One read, filtered on the screen with the engine's own rule. A read that fails
 * says so: it is never an empty list, which would read as "nobody".
 */
export async function listSegmentPeople(
  accessToken: string | null,
): Promise<{ ok: true; people: SegmentPerson[] } | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }
  try {
    const candidates = await loadCandidates("any");
    const people = candidates
      .map(toSegmentPerson)
      .sort((a, b) =>
        `${a.firstName} ${a.lastName ?? ""}`.localeCompare(
          `${b.firstName} ${b.lastName ?? ""}`,
        ),
      );
    return { ok: true, people };
  } catch (err) {
    console.error("[campaigns] segment people failed:", err);
    return { ok: false, error: "db" };
  }
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

  // A loose "draft" save of a campaign that is active or scheduled would let
  // it go out incomplete: for those the full rules apply, and a refusal asks
  // for a pause. The state is read before validating, which is what decides.
  let savedStatus: CampaignStatus | null = null;
  if (options.draft && input.id) {
    const { data, error } = await getAdminClient()
      .database.from("campaigns")
      .select("status")
      .eq("id", input.id)
      .maybeSingle();
    // Without the state there is no knowing how strict to be: a campaign that
    // may be live must not be validated loosely on a guess.
    if (error) return { ok: false, error: "db" };
    savedStatus = (data as { status: CampaignStatus } | null)?.status ?? null;
  }
  const strictness = saveStrictness(options.draft === true, savedStatus);
  const check =
    strictness === "draft" ? validateCampaignDraft : validateCampaign;
  const validated = check({
    name: input.name,
    channel: input.channel,
    kind: input.kind,
    trigger: input.trigger,
    audience: input.audience,
    content: input.content,
  });
  if (!validated.ok) {
    return {
      ok: false,
      error: refusalOfSave(options.draft === true, strictness),
      fieldErrors: validated.errors,
    };
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

  // A draft may point at any template, or none; anything that can go out must
  // point at one that can be sent now, in the campaign's language, with the
  // parameters it declares. The form offers only such templates, but the
  // template may have been paused since, and the browser is not trusted.
  if (strictness === "full" && validated.data.channel === "whatsapp") {
    const block = validated.data.content.whatsapp;
    let template: Awaited<ReturnType<typeof loadWhatsAppTemplate>>;
    try {
      template = await loadWhatsAppTemplate(db, block?.templateId);
    } catch (err) {
      console.error("[campaigns] template lookup failed:", err);
      return { ok: false, error: "db" };
    }
    const templateErrors = whatsappContentErrors(
      template,
      sendLocaleOf(validated.data.audience),
      block?.params ?? [],
      validated.data.kind,
    );
    if (templateErrors) {
      return { ok: false, error: "invalid", fieldErrors: templateErrors };
    }
  }

  if (input.id) {
    // Editing a cancelled or failed campaign brings it back as a draft; a
    // draft or a scheduled one keeps its state, the schedule included.
    const { data, error } = await db
      .from("campaigns")
      .select("status, channel, kind")
      .eq("id", input.id)
      .maybeSingle();
    const saved = data as {
      status: CampaignStatus;
      channel: CampaignChannel;
      kind: CampaignKind;
    } | null;
    const status = saved?.status;
    if (error || !saved || !status) return { ok: false, error: "not_found" };
    if (!EDITABLE.includes(status)) return { ok: false, error: "locked" };
    if (!channelChangeAllowed(saved.channel, validated.data.channel)) {
      return { ok: false, error: "locked" };
    }
    // An appointment notice counts bookings under another consent: a saved
    // campaign cannot become one, or stop being one.
    if (!kindSwitchAllowed(saved.kind, validated.data.kind)) {
      return { ok: false, error: "locked" };
    }

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
    .select("name, channel, kind, trigger, audience, content")
    .eq("id", id)
    .maybeSingle();
  if (error || !source) return { ok: false, error: "not_found" };

  const original = source as Pick<
    CampaignRow,
    "name" | "channel" | "kind" | "trigger" | "audience" | "content"
  >;

  // "(copia)", then "(copia 2)", and so on: the name index refuses repeats.
  let copyName = `${original.name} (copia)`;
  for (let n = 2; (await nameTaken(copyName, null)) && n < 50; n += 1) {
    copyName = `${original.name} (copia ${n})`;
  }

  const { data, error: insertError } = await db
    .from("campaigns")
    .insert({
      name: copyName,
      // The channel, kind and trigger are part of what the copy is a copy of:
      // without them a WhatsApp or automated campaign came back an email.
      channel: original.channel,
      kind: original.kind,
      trigger: original.trigger,
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
  channel: CampaignChannel = "email",
  /**
   * What the campaign is, when the count depends on it: a notice about her
   * appointment is counted with the consent to appointment notices, not the one
   * to news. Absent, or any other kind, the count is what it always was.
   */
  kind?: CampaignKind,
): Promise<AudiencePreview | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const parsed = campaignAudienceSchema.safeParse(audience);
  const parsedChannel = campaignChannelSchema.safeParse(channel);
  const parsedKind = campaignKindSchema.optional().safeParse(kind);
  if (!parsed.success || !parsedChannel.success || !parsedKind.success) {
    return { ok: false, error: "invalid" };
  }

  try {
    // Only an appointment notice has a purpose of its own; every other call is
    // resolved with the same three arguments as ever.
    const recipients =
      parsedKind.data === "appointment"
        ? await resolveAudience(parsed.data, new Date(), parsedChannel.data, {
            purpose: consentPurposeOf("appointment"),
          })
        : await resolveAudience(parsed.data, new Date(), parsedChannel.data);
    return {
      count: recipients.length,
      byLanguage: {
        en: recipients.filter((r) => r.language === "en").length,
        es: recipients.filter((r) => r.language === "es").length,
      },
      sample: recipients.slice(0, 20).map((r) => ({
        id: r.id,
        name: r.firstName,
        email: r.email ?? "",
        phone: r.phone ?? null,
        language: r.language,
      })),
    };
  } catch (err) {
    console.error("[campaigns] preview failed:", err);
    return {
      ok: false,
      error: isSuppressionTableMissing(err) ? WHATSAPP_NOT_READY : "db",
    };
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

  try {
    const { html } = await campaignEmail({
      content: withDefaults(content),
      firstName: locale === "es" ? "Ana" : "Anna",
      unsubscribeUrl: "#",
      locale,
    });
    return { html };
  } catch (err) {
    console.error("[campaigns] preview render failed:", err);
    return { ok: false, error: "generic" };
  }
}

function withDefaults(
  content: Partial<CampaignLocaleContent> | undefined,
): CampaignLocaleContent {
  const out: CampaignLocaleContent = { ...EMPTY_LOCALE_CONTENT, doc: null };
  for (const key of ["subject", "subjectB", "preheader", "title"] as const) {
    const value = content?.[key];
    if (typeof value === "string") out[key] = value;
  }
  const doc = content?.doc;
  out.doc = doc && typeof doc === "object" && doc.type === "doc" ? doc : null;
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
    const { subject, html } = await campaignEmail({
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

/**
 * Five WhatsApp tests an hour per administrator. Each one is a real message
 * from the centre's number, so a stuck button must not be able to send dozens.
 * Best-effort: it lives in this process's memory, and every serverless
 * instance has its own, so it is a brake and not a guarantee.
 */
const whatsappTestLimiter = createRateLimiter({
  max: 5,
  windowMs: 60 * 60 * 1000,
});

/**
 * Sends the campaign's template, as it would go out, to the administrator who
 * asked: the template's own example values, to the phone on that admin's
 * profile. Nothing is recorded and no campaign is needed.
 *
 * The phone is read here from the caller's profile, never taken from the
 * browser, so this cannot message anyone else. Failures are keys the form
 * translates; Meta's own words travel in `detail` for `meta` only, since they
 * are about the template or the account and name nothing of ours.
 */
export async function sendTestWhatsAppCampaign(
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
  const parsed = campaignAudienceSchema
    .pick({ language: true, sendLocale: true })
    .safeParse(audience);
  // The template id comes from the browser: it must be a uuid (or nothing,
  // which is then "no template") before it reaches a query.
  const block = whatsappContentSchema.safeParse(
    content?.whatsapp ?? {
      templateId: null,
      params: [],
    },
  );
  if (!parsed.success || !block.success) return { ok: false, error: "invalid" };

  const db = getAdminClient().database;
  let phone: string | null = null;
  let template: Awaited<ReturnType<typeof loadWhatsAppTemplate>>;
  try {
    const { data, error } = await db
      .from("profiles")
      .select("phone")
      .eq("id", caller.userId)
      .maybeSingle();
    if (error) return { ok: false, error: "db" };
    phone = (data as { phone: string | null } | null)?.phone ?? null;
    template = await loadWhatsAppTemplate(db, block.data.templateId);
  } catch (err) {
    console.error("[campaigns] whatsapp test lookup failed:", err);
    return { ok: false, error: "db" };
  }

  const plan = prepareTestSend(template, sendLocaleOf(parsed.data), phone);
  if (!plan.ok) {
    return {
      ok: false,
      error: plan.error,
      ...(plan.detail ? { detail: plan.detail } : {}),
    };
  }

  // Counted only here, once everything that could be refused without costing
  // a message has been: a profile with no phone does not use up the hour.
  if (!whatsappTestLimiter.take(caller.userId)) {
    return { ok: false, error: "test_rate_limited" };
  }
  // The admin and the template, never the phone.
  console.info("[campaigns] whatsapp test", {
    admin: caller.userId,
    template: template?.id,
  });

  const result = await sendTemplateMessage(plan.send);
  if (result.status === "sent") return { ok: true, to: plan.to };
  if (result.status === "skipped") {
    return { ok: false, error: "whatsapp_not_configured" };
  }
  return { ok: false, error: "meta", detail: result.error.slice(0, 300) };
}

// ─── Sending ────────────────────────────────────────────────────

/** What the full rules read of a saved campaign. */
const SENDABLE_FIELDS = "name, channel, kind, trigger, audience, content";
type SendableRow = Pick<
  CampaignRow,
  "name" | "channel" | "kind" | "trigger" | "audience" | "content"
>;

/**
 * Why a saved campaign may not leave yet, or null. The form holds a campaign
 * to the full rules before it sends, schedules or switches it on, but the
 * list does all three to a saved draft without the form, and a draft may be
 * half written: the version of one language missing, say. So the rules are
 * asked again here, of what is stored, and the refusal says which version is
 * missing when that is the reason.
 */
function notReadyToGoOut(row: SendableRow): Failure | null {
  const check = validateCampaign({
    name: row.name,
    channel: row.channel,
    kind: row.kind,
    trigger: row.trigger,
    audience: row.audience,
    content: row.content,
  });
  return check.ok ? null : { ok: false, error: incompleteError(check.errors) };
}

export async function sendCampaignNow(
  accessToken: string | null,
  id: string,
): Promise<SendOutcome | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  // An automated kind is switched on, not sent: an appointment notice sent in
  // one go would reach everybody with the consent at once, with no appointment
  // to talk about. `dispatchCampaign` holds the same rule for the cron.
  const { data: saved, error: readError } = await getAdminClient()
    .database.from("campaigns")
    .select(SENDABLE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: "db" };
  if (saved && isAutomatedKind((saved as { kind: CampaignKind }).kind)) {
    return { ok: false, error: "locked" };
  }
  // The list sends a saved draft without going through the form.
  const unfinished = saved ? notReadyToGoOut(saved as SendableRow) : null;
  if (unfinished) return unfinished;

  // The page this is called from allows 60 s; a WhatsApp send stops before
  // that and says how many rows are left for the cron to finish.
  const result = await dispatchCampaign(id, {
    deadlineAt: deadlineFrom(Date.now()),
  });
  revalidatePath(LIST_PATH);
  return sendOutcome(result);
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

  // A WhatsApp campaign's template may have been paused since it was saved.
  const db = getAdminClient().database;
  const { data: saved, error: readError } = await db
    .from("campaigns")
    .select(SENDABLE_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: "db" };
  if (saved) {
    // An automated kind is switched on, never scheduled.
    if (isAutomatedKind((saved as { kind: CampaignKind }).kind)) {
      return { ok: false, error: "locked" };
    }
    const unfinished = notReadyToGoOut(saved as SendableRow);
    if (unfinished) return unfinished;
    const gate = await templateGate(
      saved as Pick<CampaignRow, "channel" | "audience" | "content" | "kind">,
      db,
    );
    if (gate) return gate;
  }

  const { data, error } = await db
    .from("campaigns")
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

  const unfinished = notReadyToGoOut(row);
  if (unfinished) return unfinished;

  // The campaign sheet switches a saved campaign on without a save, so the
  // template is checked again here.
  const gate = await templateGate(row, db);
  if (gate) return gate;

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
): Promise<SendOutcome | Failure> {
  try {
    await admin(accessToken);
  } catch (err) {
    return authFailure(err);
  }

  const result = await retryFailed(id, {
    deadlineAt: deadlineFrom(Date.now()),
  });
  revalidatePath(LIST_PATH);
  return sendOutcome(result);
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
    .select("id, status, sent_at, campaigns(id, name, sent_at, channel)")
    .eq("contact_id", contactId)
    .order("sent_at", { ascending: false, nullsFirst: false });
  if (error) return [];

  type Joined = {
    id: string;
    name: string;
    sent_at: string | null;
    channel: CampaignChannel;
  };
  type Row = Omit<ContactCampaignRow, "campaign" | "channel"> & {
    campaigns: Joined | Joined[] | null;
  };
  return ((data ?? []) as Row[]).map((row) => {
    const joined = Array.isArray(row.campaigns)
      ? (row.campaigns[0] ?? null)
      : row.campaigns;
    return {
      id: row.id,
      // Matched by contact id, which every campaign row carries (the send
      // writes it for both channels), so an email row and a WhatsApp row of
      // the same person are both here.
      channel: joined?.channel ?? "email",
      status: row.status,
      sent_at: row.sent_at,
      campaign: joined
        ? { id: joined.id, name: joined.name, sent_at: joined.sent_at }
        : null,
    };
  });
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
