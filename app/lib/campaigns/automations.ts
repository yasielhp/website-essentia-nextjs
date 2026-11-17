import { getAdminClient } from "@/lib/insforge-admin";
type Db = ReturnType<typeof getAdminClient>["database"];
import { getAppUrl } from "@/lib/env";
import type { CampaignRow } from "@/types/campaign";
import { resolveAudience as defaultResolveAudience } from "./audience";
import {
  haltMessage,
  reconcileInterrupted,
  refusalStreak,
  type WhatsAppDeps,
} from "./dispatch-whatsapp";
import { conflictTarget, recipientRow } from "./recipient-rows";
import { LATE_ERROR, RUN_FAILED_ERROR } from "./run-markers";
import { dueRecipients, type BlogPostSummary } from "./automation-rules";
import {
  loadQueued,
  refreshCounts,
  sendQueued,
  type QueuedRow,
} from "./dispatch";

/**
 * One run of an active campaign: who newly qualifies gets queued and sent.
 *
 * SERVER ONLY, called by the cron. Idempotent by construction — the unique
 * index on (campaign_id, email, cycle), or (campaign_id, phone, cycle) on
 * WhatsApp, swallows a repeat, so two overlapping runs cannot message the same
 * person twice for the same occasion. A queued row left behind by a timeout or
 * the shared deadline is picked up by the next run, except an appointment
 * notice whose moment has passed by then: that one is closed, not sent.
 *
 * On WhatsApp a run first fails what a dead process left `sending`, and an
 * automation Meta keeps refusing is paused with the reason.
 */
/** What a run reads and calls out to; a test passes doubles. */
export type AutomationDeps = {
  db?: Db;
  resolveAudience?: typeof defaultResolveAudience;
  whatsapp?: WhatsAppDeps;
  /** Epoch ms by which the caller's whole invocation must be over. */
  deadlineAt?: number;
};

export async function runAutomation(
  campaign: CampaignRow,
  now = new Date(),
  deps: AutomationDeps = {},
): Promise<{
  queued: number;
  sent: number;
  failed: number;
  /**
   * Appointment notices closed without being sent: their moment had passed,
   * or the booking was cancelled or moved, while they waited in the queue.
   */
  late?: number;
  /** Why the run paused the automation, when Meta kept refusing it. */
  halted?: string;
}> {
  const db = deps.db ?? getAdminClient().database;
  const resolveAudience = deps.resolveAudience ?? defaultResolveAudience;

  // What a process that died left `sending` is failed (unconfirmed) before the
  // run counts or sends anything, so it is neither lost nor sent twice.
  if (campaign.channel === "whatsapp") {
    await reconcileInterrupted(db, campaign.id, now.getTime());
  }

  // A notice about her appointment is resolved on its own terms: transactional
  // consent, and each client's bookings loaded for the rules to count hours
  // around. Every other kind is resolved exactly as it always was, with no
  // fourth argument at all.
  const recipients =
    campaign.kind === "appointment"
      ? await resolveAudience(campaign.audience, now, campaign.channel, {
          purpose: "appointment",
          appointments: true,
        })
      : await resolveAudience(campaign.audience, now, campaign.channel);
  const posts =
    campaign.trigger.event === "new_blog_post" ? await recentPosts() : [];

  const due = dueRecipients({
    trigger: campaign.trigger,
    recipients,
    activatedAt: campaign.activated_at ?? campaign.created_at,
    now,
    posts,
    // The appointment notices filter the bookings by it, not the client.
    services: campaign.audience.services,
  });

  let queued = 0;
  if (due.length > 0) {
    const { error } = await db.from("campaign_recipients").upsert(
      due.map(({ recipient, cycle, vars }) =>
        recipientRow({
          campaignId: campaign.id,
          recipient,
          channel: campaign.channel,
          audience: campaign.audience,
          cycle,
          extra: { vars: vars ?? null },
        }),
      ),
      { onConflict: conflictTarget(campaign.channel), ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    queued = due.length;
  }

  // An appointment notice is only sent while it is still owed. The margin in
  // the rules bounds when a notice is QUEUED; a row can then wait in the queue
  // (its template paused by Meta, no credentials, a consent or STOP-list read
  // that failed, a tick out of time, the campaign paused) and would otherwise
  // go out on the first tick the cause is gone, with the visit begun or days
  // after it. So of what is queued, only the rows this very tick still owes
  // are sent: the same booking, to the same number. The rest are closed as
  // late and never sent, which is also what happens to a booking cancelled or
  // moved out of its window while its notice waited.
  let rows = await loadQueued(campaign.id, db);
  let late = 0;
  if (campaign.kind === "appointment") {
    const owed = new Set(
      due.map(({ recipient, cycle }) => noticeKey(recipient.phone, cycle)),
    );
    const isOwed = (row: QueuedRow) =>
      owed.has(noticeKey(row.phone, row.cycle));
    late = await closeLate(
      db,
      rows.filter((row) => !isOwed(row)),
    );
    rows = rows.filter(isOwed);
  }

  const outcome =
    rows.length > 0
      ? await sendQueued(campaign, rows, {
          db,
          deadlineAt: deps.deadlineAt,
          ...deps.whatsapp,
        })
      : { sent: 0, failed: 0, lastError: null, halted: null };
  const { sent, failed, lastError } = outcome;

  // The sender stops itself after three whole batches refused for one reason,
  // which an automation never fills: it sends a few rows a tick, an appointment
  // notice one or two. So after a send in which Meta refused something, the
  // campaign's last finished rows are looked at across ticks: three in a row
  // refused for that reason is the account or the template, and it is paused
  // just the same.
  const halted =
    outcome.halted ??
    (campaign.channel === "whatsapp" &&
    outcome.refusal &&
    (await refusalStreak(db, campaign.id, outcome.refusal))
      ? outcome.refusal
      : null);

  // Meta refuses the template or the account: pause the automation with the
  // reason so it stops hitting the number. The admin resumes it once fixed.
  //
  // A run that got this far with no error of its own also takes back the mark
  // the cron left when an earlier run threw. Any other `last_error` is not
  // this run's to clear: a template still paused says so on a tick with
  // nothing queued too.
  await refreshCounts(
    campaign.id,
    {
      last_run_at: now.toISOString(),
      ...(halted
        ? { status: "paused", last_error: haltMessage(halted) }
        : lastError
          ? { last_error: lastError }
          : campaign.last_error === RUN_FAILED_ERROR
            ? { last_error: null }
            : {}),
    },
    db,
  );

  return {
    queued,
    sent,
    failed,
    ...(late > 0 ? { late } : {}),
    ...(halted ? { halted } : {}),
  };
}

/** One appointment notice: a booking, to a number. */
const noticeKey = (
  phone: string | null | undefined,
  cycle: string | undefined,
): string => `${phone ?? ""}\n${cycle ?? ""}`;

/**
 * Closes the notices whose moment has passed as `failed` with `LATE_ERROR`,
 * and answers how many it closed. Only a row still `queued` is touched. A
 * write that fails is logged and nothing else: the caller does not send those
 * rows either way, and the next run finds them again.
 */
async function closeLate(db: Db, rows: QueuedRow[]): Promise<number> {
  let closed = 0;
  // In chunks: the ids travel in the URL.
  for (let i = 0; i < rows.length; i += 100) {
    const { data, error } = await db
      .from("campaign_recipients")
      .update({ status: "failed", error: LATE_ERROR })
      .in(
        "id",
        rows.slice(i, i + 100).map((row) => row.id),
      )
      .eq("status", "queued")
      .select("id");
    if (error) {
      console.error("[campaigns] late notices not closed:", error.message);
      continue;
    }
    closed += ((data ?? []) as unknown[]).length;
  }
  return closed;
}

type PostRow = {
  id: string;
  slug: string;
  slug_es: string | null;
  title: string | null;
  title_es: string | null;
  excerpt: string | null;
  excerpt_es: string | null;
  published_at: string | null;
};

/** The last few published posts, shaped for the template in both languages. */
async function recentPosts(): Promise<BlogPostSummary[]> {
  const { data, error } = await getAdminClient()
    .database.from("blog_posts")
    .select(
      "id, slug, slug_es, title, title_es, excerpt, excerpt_es, published_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  const base = getAppUrl();
  return ((data ?? []) as PostRow[])
    .filter((post) => post.published_at)
    .map((post) => ({
      id: post.id,
      publishedAt: post.published_at as string,
      title: { en: post.title ?? "", es: post.title_es ?? post.title ?? "" },
      excerpt: {
        en: post.excerpt ?? "",
        es: post.excerpt_es ?? post.excerpt ?? "",
      },
      url: {
        en: `${base}/blog/${post.slug}`,
        es: `${base}/es/blog/${post.slug_es ?? post.slug}`,
      },
    }));
}
