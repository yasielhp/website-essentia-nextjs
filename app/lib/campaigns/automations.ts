import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import type { CampaignRow } from "@/types/campaign";
import { resolveAudience } from "./audience";
import { dueRecipients, type BlogPostSummary } from "./automation-rules";
import { loadQueued, refreshCounts, sendQueued } from "./dispatch";

/**
 * One run of an active campaign: who newly qualifies gets queued and sent.
 *
 * SERVER ONLY, called by the cron. Idempotent by construction — the unique
 * index on (campaign_id, email, cycle) swallows a repeat, so two overlapping
 * runs cannot mail the same person twice for the same occasion. A queued row
 * left behind by a timeout is picked up by the next run.
 */
export async function runAutomation(
  campaign: CampaignRow,
  now = new Date(),
): Promise<{ queued: number; sent: number; failed: number }> {
  const db = getAdminClient().database;

  const recipients = await resolveAudience(campaign.audience, now);
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
      due.map(({ recipient, cycle, vars }) => ({
        campaign_id: campaign.id,
        contact_id: recipient.id,
        email: recipient.email,
        language: recipient.language,
        status: "queued",
        cycle,
        vars: vars ?? null,
      })),
      { onConflict: "campaign_id,email,cycle", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    queued = due.length;
  }

  const rows = await loadQueued(campaign.id);
  const { sent, failed, lastError } =
    rows.length > 0
      ? await sendQueued(campaign, rows)
      : { sent: 0, failed: 0, lastError: null };

  await refreshCounts(campaign.id, {
    last_run_at: now.toISOString(),
    ...(lastError ? { last_error: lastError } : {}),
  });

  return { queued, sent, failed };
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
