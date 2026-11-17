import { getAdminClient } from "@/lib/insforge-admin";
type Db = ReturnType<typeof getAdminClient>["database"];
import { getAppUrl } from "@/lib/env";
import type { CampaignRow } from "@/types/campaign";
import { resolveAudience as defaultResolveAudience } from "./audience";
import {
  haltMessage,
  reconcileInterrupted,
  type WhatsAppDeps,
} from "./dispatch-whatsapp";
import { conflictTarget, recipientRow } from "./recipient-rows";
import { dueRecipients, type BlogPostSummary } from "./automation-rules";
import { loadQueued, refreshCounts, sendQueued } from "./dispatch";

/**
 * One run of an active campaign: who newly qualifies gets queued and sent.
 *
 * SERVER ONLY, called by the cron. Idempotent by construction — the unique
 * index on (campaign_id, email, cycle), or (campaign_id, phone, cycle) on
 * WhatsApp, swallows a repeat, so two overlapping runs cannot message the same
 * person twice for the same occasion. A queued row left behind by a timeout or
 * the shared deadline is picked up by the next run.
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

  const recipients = await resolveAudience(
    campaign.audience,
    now,
    campaign.channel,
  );
  const posts =
    campaign.trigger.event === "new_blog_post" ? await recentPosts() : [];

  const due = dueRecipients({
    trigger: campaign.trigger,
    recipients,
    activatedAt: campaign.activated_at ?? campaign.created_at,
    now,
    posts,
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

  const rows = await loadQueued(campaign.id, db);
  const { sent, failed, lastError, halted } =
    rows.length > 0
      ? await sendQueued(campaign, rows, {
          db,
          deadlineAt: deps.deadlineAt,
          ...deps.whatsapp,
        })
      : { sent: 0, failed: 0, lastError: null, halted: null };

  // Meta refuses the template or the account: pause the automation with the
  // reason so it stops hitting the number. The admin resumes it once fixed.
  await refreshCounts(
    campaign.id,
    {
      last_run_at: now.toISOString(),
      ...(halted
        ? { status: "paused", last_error: haltMessage(halted) }
        : lastError
          ? { last_error: lastError }
          : {}),
    },
    db,
  );

  return halted ? { queued, sent, failed, halted } : { queued, sent, failed };
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
