# Email Campaigns Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the admin write a bilingual email campaign in the dashboard, pick who receives it from conditions on `contacts` and `bookings`, send it now or later through Resend, and read per-campaign delivery stats fed by the Resend webhook.

**Architecture:** Segmentation runs in our own code against Insforge (`contacts` + `bookings`), never in Resend. Sending goes through the existing `sendEmailBatch` (`resend.batch.send`, 100 per request) with `tags.campaign_id`; the existing Resend webhook route learns to recognise that tag and update `campaign_recipients` plus denormalised counters on `campaigns` through one RPC. A 15-minute cron dispatches scheduled campaigns and resumes interrupted ones. Consent checkboxes are added to the forms that lack them; unchecked never unsubscribes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5, Tailwind v4, next-intl 4, `@insforge/sdk`, `resend` SDK, Zod, `bun test` for the pure modules.

**Design doc:** `docs/plans/2026-09-05-email-campaigns-design.md` — read it first. Every decision below traces back to it.

---

## Conventions the engineer must know

- **Validate with `bun run build`** (type-checks too), then `bun run format && bun run lint` — both must be clean. `bun run check:messages` verifies EN/ES dashboard message parity. There are no existing automated tests; this plan adds `bun test` only for pure functions.
- **Server-only modules** live in `app/lib/**` without `"use server"`. Public Server Actions live in `app/actions/*.ts` with `"use server"` at the top. **Never re-export types from a `"use server"` file** (see memory `server-action-type-reexport`) — put types in `app/types/`.
- **Auth in actions:** first argument is `accessToken: string | null`, obtained on the client with `getAccessToken()` from `@/lib/client-session`. Guard with `await requireRole(accessToken, ADMIN_ROLES)` from `@/lib/auth-guard`; catch `AuthError` and return `{ ok: false, error }`.
- **Admin DB client:** `getAdminClient()` from `@/lib/insforge-admin` (service key, server only). Query style: `getAdminClient().database.from("table").select(...)`. RPC: `.database.rpc("name", { p_arg })`.
- **Apply SQL** with `npx @insforge/cli@latest db query "<sql>"` or `npx @insforge/cli@latest db query -f <file>` (check `--help`; if `-f` is unsupported, paste the file contents). The worktree has `.insforge/` copied so the CLI is linked.
- **Dashboard messages:** `messages/en/dashboard.json` and `messages/es/dashboard.json`, namespace `dashboard`. New keys render raw until the dev server restarts (memory `dashboard-messages-need-dev-restart`). Spanish copy implies English too — always add both.
- **Dashboard UI patterns to copy:** list page → `app/(dashboard)/dashboard/subscriptions/page.tsx`; stepped form → `app/(dashboard)/dashboard/bookings/new/` (`form-state.ts` reducer + step components); toggle → `contact-details-card.tsx` lines ~200-240; tabs → `TabButton` from `@/components/dashboard/settings/tab-button`; toasts → `notifySuccess` from `@/lib/feedback`; image upload → `ImageUpload` from `@/components/ui/image-upload` (`bucket`, `value`, `onChange`).
- **Email templates** are functions returning HTML strings wrapped in `emailBase({ preheader, body, locale })` from `app/emails/templates/_base.ts`. Colours: `#103838` (dark), `#f0ede6`, `#4a6767` (muted text), `#335554` (links).
- **Commit style:** `type(scope): short lowercase sentence` (see `git log`). End every commit message with the line `Claude-Session: https://claude.ai/code/session_01SFYzTi6skqMcqpHQbBF4Gd`.

---

### Task 1: Database migration

**Files:**

- Create: `insforge/migrations/20260905_campaigns.sql`

**Step 1: Write the migration**

```sql
-- Email campaigns: one row per campaign, one per recipient, counters kept by
-- the Resend webhook so the dashboard reads a single row.
--
-- No RLS, like `booking_events`: read only through the service key from
-- Server Actions restricted to the admin role.

CREATE TABLE IF NOT EXISTS campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  -- draft | scheduled | sending | sent | cancelled | failed
  status           text NOT NULL DEFAULT 'draft',
  audience         jsonb NOT NULL DEFAULT '{}'::jsonb,
  content          jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at     timestamptz,
  sent_at          timestamptz,
  -- When dispatch claimed the row; the cron uses it to spot a stuck send.
  sending_started_at timestamptz,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  recipients_count int  NOT NULL DEFAULT 0,
  delivered_count  int  NOT NULL DEFAULT 0,
  opened_count     int  NOT NULL DEFAULT 0,
  clicked_count    int  NOT NULL DEFAULT 0,
  bounced_count    int  NOT NULL DEFAULT 0,
  complained_count int  NOT NULL DEFAULT 0,
  failed_count     int  NOT NULL DEFAULT 0,
  last_error       text
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx
  ON campaigns (status, scheduled_at);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id   uuid REFERENCES contacts(id) ON DELETE SET NULL,
  email        text NOT NULL,
  language     text NOT NULL,
  -- queued | sent | delivered | opened | clicked | bounced | complained | failed
  status       text NOT NULL DEFAULT 'queued',
  provider_id  text,
  error        text,
  sent_at      timestamptz,
  delivered_at timestamptz,
  opened_at    timestamptz,
  clicked_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_recipients_campaign_idx
  ON campaign_recipients (campaign_id, status);
CREATE INDEX IF NOT EXISTS campaign_recipients_provider_idx
  ON campaign_recipients (provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_recipients_unique_contact
  ON campaign_recipients (campaign_id, contact_id);

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS newsletter_subscribed_at timestamptz;

-- Consent from the booking form. NULL means "the form did not ask" or "the box
-- was left unticked": neither may unsubscribe somebody who said yes before.
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_language text DEFAULT 'en',
  p_gender text DEFAULT NULL,
  p_newsletter boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone, preferred_language, gender,
                        newsletter_subscribed, newsletter_subscribed_at)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender,
          COALESCE(p_newsletter, false),
          CASE WHEN p_newsletter THEN now() ELSE NULL END)
  ON CONFLICT (email) DO UPDATE SET
    first_name         = EXCLUDED.first_name,
    last_name          = EXCLUDED.last_name,
    phone              = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    gender             = COALESCE(EXCLUDED.gender, contacts.gender),
    newsletter_subscribed = CASE WHEN p_newsletter THEN true
                                 ELSE contacts.newsletter_subscribed END,
    newsletter_subscribed_at = CASE WHEN p_newsletter AND NOT COALESCE(contacts.newsletter_subscribed, false)
                                    THEN now() ELSE contacts.newsletter_subscribed_at END,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- One Resend callback, applied once. Moves the recipient forward only, and
-- bumps the campaign counter only when the row actually moved, so retries and
-- out-of-order deliveries cannot double count.
CREATE OR REPLACE FUNCTION public.record_campaign_event(
  p_provider_id text,
  p_event text,        -- delivered | opened | clicked | bounced | complained
  p_at timestamptz,
  p_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row campaign_recipients%ROWTYPE;
  v_rank_now int;
  v_rank_new int;
BEGIN
  SELECT * INTO v_row FROM campaign_recipients WHERE provider_id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Terminal states never move again.
  IF v_row.status IN ('bounced', 'complained', 'failed') THEN RETURN false; END IF;

  v_rank_now := CASE v_row.status
    WHEN 'queued' THEN 0 WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2
    WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4 ELSE 0 END;
  v_rank_new := CASE p_event
    WHEN 'delivered' THEN 2 WHEN 'opened' THEN 3 WHEN 'clicked' THEN 4
    WHEN 'bounced' THEN 9 WHEN 'complained' THEN 9 ELSE 0 END;

  IF v_rank_new = 0 OR v_rank_new <= v_rank_now THEN RETURN false; END IF;

  UPDATE campaign_recipients SET
    status = p_event,
    error = COALESCE(p_error, error),
    delivered_at = CASE WHEN p_event IN ('delivered','opened','clicked') THEN COALESCE(delivered_at, p_at) ELSE delivered_at END,
    opened_at    = CASE WHEN p_event IN ('opened','clicked') THEN COALESCE(opened_at, p_at) ELSE opened_at END,
    clicked_at   = CASE WHEN p_event = 'clicked' THEN COALESCE(clicked_at, p_at) ELSE clicked_at END
  WHERE id = v_row.id;

  -- Counters are "reached at least this state": a click implies an open and a
  -- delivery, so an opened row that jumps to clicked bumps only clicked, while
  -- a sent row that jumps straight to clicked bumps all three.
  UPDATE campaigns SET
    delivered_count  = delivered_count  + CASE WHEN v_rank_new >= 2 AND v_rank_now < 2 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    opened_count     = opened_count     + CASE WHEN v_rank_new >= 3 AND v_rank_now < 3 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    clicked_count    = clicked_count    + CASE WHEN v_rank_new >= 4 AND v_rank_now < 4 AND v_rank_new < 9 THEN 1 ELSE 0 END,
    bounced_count    = bounced_count    + CASE WHEN p_event = 'bounced' THEN 1 ELSE 0 END,
    complained_count = complained_count + CASE WHEN p_event = 'complained' THEN 1 ELSE 0 END
  WHERE id = v_row.campaign_id;

  IF p_event IN ('bounced', 'complained') AND v_row.contact_id IS NOT NULL THEN
    UPDATE contacts SET email_bounced_at = COALESCE(email_bounced_at, p_at)
    WHERE id = v_row.contact_id;
  END IF;

  RETURN true;
END;
$function$;
```

**Step 2: Apply it**

Run: `npx @insforge/cli@latest db query "$(cat insforge/migrations/20260905_campaigns.sql)"`
Expected: no error. Then verify:

Run: `npx @insforge/cli@latest db query "select column_name from information_schema.columns where table_name='campaigns' order by ordinal_position"`
Expected: the 20 columns above.

Run: `npx @insforge/cli@latest db query "select pg_get_function_arguments(p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='upsert_contact'"`
Expected: ends with `p_newsletter boolean DEFAULT NULL::boolean`.

**Step 3: Smoke-test the RPC**

Run:

```bash
npx @insforge/cli@latest db query "insert into campaigns (name) values ('rpc smoke') returning id"
# take the id, then:
npx @insforge/cli@latest db query "insert into campaign_recipients (campaign_id, email, language, status, provider_id) values ('<id>', 'x@example.com', 'en', 'sent', 'smoke-1')"
npx @insforge/cli@latest db query "select record_campaign_event('smoke-1','opened',now()), record_campaign_event('smoke-1','opened',now()), record_campaign_event('smoke-1','delivered',now())"
npx @insforge/cli@latest db query "select delivered_count, opened_count from campaigns where id='<id>'"
```

Expected: `true, false, false` then `1, 1`. Clean up: `delete from campaigns where name='rpc smoke'`.

**Step 4: Commit**

```bash
git add insforge/migrations/20260905_campaigns.sql
git commit -m "feat(campaigns): tables, counters and the two RPCs behind email campaigns"
```

---

### Task 2: Types and Zod schemas

**Files:**

- Create: `app/types/campaign.ts`
- Modify: `app/lib/schemas.ts` (append at end)

**Step 1: Types**

```ts
// app/types/campaign.ts
/** Email campaigns, as the dashboard and its actions read them. */

export type CampaignStatus =
  "draft" | "scheduled" | "sending" | "sent" | "cancelled" | "failed";

export type RecipientStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed";

export type CampaignLanguage = "any" | "en" | "es";

export type CampaignAudience = {
  language: CampaignLanguage;
  /** `true` restricts to subscribers; `null` means anybody. */
  newsletter: boolean | null;
  /** `bookableServices` ids; empty means no service condition. */
  services: string[];
  lastBooking: { op: "gt" | "lt"; days: number } | null;
  neverBooked: boolean;
  /** Contacts added by hand, unioned with the filter result. */
  manualIds: string[];
};

export type CampaignLocaleContent = {
  subject: string;
  preheader: string;
  title: string;
  body: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
};

export type CampaignContent = {
  en: CampaignLocaleContent;
  es: CampaignLocaleContent;
};

export type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  audience: CampaignAudience;
  content: CampaignContent;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  recipients_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  bounced_count: number;
  complained_count: number;
  failed_count: number;
  last_error: string | null;
};

export type CampaignRecipientRow = {
  id: string;
  contact_id: string | null;
  email: string;
  language: "en" | "es";
  status: RecipientStatus;
  error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
};

export type AudiencePreview = {
  count: number;
  byLanguage: { en: number; es: number };
  sample: { id: string; name: string; email: string; language: "en" | "es" }[];
};

export const EMPTY_LOCALE_CONTENT: CampaignLocaleContent = {
  subject: "",
  preheader: "",
  title: "",
  body: "",
  imageUrl: "",
  ctaText: "",
  ctaUrl: "",
};

export const EMPTY_AUDIENCE: CampaignAudience = {
  language: "any",
  newsletter: null,
  services: [],
  lastBooking: null,
  neverBooked: false,
  manualIds: [],
};
```

**Step 2: Schemas** (append to `app/lib/schemas.ts`)

```ts
// ─── Email campaigns ─────────────────────────────────────────
//
// Message KEYS against `dashboard.validation.*`, like the other dashboard
// schemas. `https` is enforced on every URL the admin types: the email is sent
// in the centre's name and a plain-http link in it looks like phishing.

const httpsUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https:\/\/\S+$/i.test(v), {
    message: "urlMustBeHttps",
  });

export const campaignAudienceSchema = z.object({
  language: z.enum(["any", "en", "es"]),
  newsletter: z.boolean().nullable(),
  services: z.array(z.string().min(1)).max(50),
  lastBooking: z
    .object({
      op: z.enum(["gt", "lt"]),
      days: z.number().int().min(1).max(3650),
    })
    .nullable(),
  neverBooked: z.boolean(),
  manualIds: z.array(z.uuid()).max(5000),
});

const campaignLocaleContentSchema = z
  .object({
    subject: z
      .string()
      .trim()
      .min(1, "subjectRequired")
      .max(120, "subjectTooLong"),
    preheader: z.string().trim().max(150, "preheaderTooLong"),
    title: z.string().trim().min(1, "titleRequired").max(200),
    body: z.string().trim().min(1, "bodyRequired").max(20000),
    imageUrl: httpsUrl,
    ctaText: z.string().trim().max(60),
    ctaUrl: httpsUrl,
  })
  .superRefine((value, ctx) => {
    const hasText = value.ctaText !== "";
    const hasUrl = value.ctaUrl !== "";
    if (hasText !== hasUrl) {
      ctx.addIssue({
        code: "custom",
        path: [hasText ? "ctaUrl" : "ctaText"],
        message: "ctaNeedsBoth",
      });
    }
  });

/** Left empty when the campaign does not go out in that language. */
const optionalLocaleContent = z.union([
  campaignLocaleContentSchema,
  z.object({
    subject: z.literal(""),
    preheader: z.literal(""),
    title: z.literal(""),
    body: z.literal(""),
    imageUrl: z.literal(""),
    ctaText: z.literal(""),
    ctaUrl: z.literal(""),
  }),
]);

export const campaignContentSchema = z.object({
  en: optionalLocaleContent,
  es: optionalLocaleContent,
});

export const campaignSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(120),
  audience: campaignAudienceSchema,
  content: campaignContentSchema,
});

/** Which locale blocks a campaign must fill in, from its language filter. */
export function requiredLocales(
  language: "any" | "en" | "es",
): ("en" | "es")[] {
  return language === "any" ? ["en", "es"] : [language];
}
```

Add a `validateCampaign(input)` helper next to it that runs `campaignSchema`, then checks each `requiredLocales(audience.language)` block against `campaignLocaleContentSchema` and returns `{ ok: true, data } | { ok: false, errors: Record<string, string> }` with error keys shaped `content.es.subject`, `name`, etc. Keep it pure (no I/O) so the client form and the server action share it.

**Step 3: Verify**

Run: `bun run build`
Expected: succeeds (nothing imports the new code yet, but the schema must type-check).

**Step 4: Commit**

```bash
git add app/types/campaign.ts app/lib/schemas.ts
git commit -m "feat(campaigns): the shape of a campaign, and what counts as a valid one"
```

---

### Task 3: Body text → safe HTML (pure, tested)

**Files:**

- Create: `app/lib/campaigns/body-html.ts`
- Create: `app/lib/campaigns/body-html.test.ts`
- Modify: `package.json` (add `"test": "bun test"` to `scripts`)

**Step 1: Write the failing tests**

```ts
// app/lib/campaigns/body-html.test.ts
import { describe, expect, test } from "bun:test";
import { bodyToHtml, renderVariables } from "./body-html";

describe("bodyToHtml", () => {
  test("blank line starts a new paragraph", () => {
    expect(bodyToHtml("Hola\n\nAdiós")).toBe(
      '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#103838;">Hola</p>' +
        '<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#103838;">Adiós</p>',
    );
  });

  test("single newline becomes <br />", () => {
    expect(bodyToHtml("a\nb")).toContain("a<br />b");
  });

  test("**bold** becomes <strong>", () => {
    expect(bodyToHtml("a **b** c")).toContain("a <strong>b</strong> c");
  });

  test("[text](https://url) becomes a link", () => {
    expect(bodyToHtml("ver [aquí](https://essentia.com/x)")).toContain(
      '<a href="https://essentia.com/x" style="color:#335554;text-decoration:underline;">aquí</a>',
    );
  });

  test("non-https links are left as plain text", () => {
    expect(bodyToHtml("[x](javascript:alert(1))")).not.toContain("<a ");
    expect(bodyToHtml("[x](http://a.com)")).not.toContain("<a ");
  });

  test("html is escaped", () => {
    expect(bodyToHtml("<script>x</script> & y")).toContain(
      "&lt;script&gt;x&lt;/script&gt; &amp; y",
    );
  });

  test("link text is escaped too", () => {
    expect(bodyToHtml("[<b>](https://a.com)")).toContain(">&lt;b&gt;</a>");
  });
});

describe("renderVariables", () => {
  test("replaces {{first_name}}", () => {
    expect(renderVariables("Hola {{first_name}}", { first_name: "Ana" })).toBe(
      "Hola Ana",
    );
  });
  test("falls back when the name is missing", () => {
    expect(
      renderVariables("Hola {{first_name}}", { first_name: "" }, "es"),
    ).toBe("Hola");
  });
  test("escapes the value", () => {
    expect(renderVariables("{{first_name}}", { first_name: "<b>" })).toBe(
      "&lt;b&gt;",
    );
  });
});
```

**Step 2: Run to see them fail**

Run: `bun test app/lib/campaigns/body-html.test.ts`
Expected: FAIL, module not found.

**Step 3: Implement**

```ts
// app/lib/campaigns/body-html.ts
/**
 * The admin's body text, turned into email HTML.
 *
 * Deliberately not Markdown: three constructs only — paragraphs, bold and
 * https links — and everything else is escaped. The email goes out in the
 * centre's name, and a stray tag or an http link in it is either a broken
 * layout or a phishing look-alike.
 */

const P_STYLE = "margin:0 0 16px;font-size:16px;line-height:1.6;color:#103838;";
const A_STYLE = "color:#335554;text-decoration:underline;";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text: string): string {
  // Escape first; the markers below survive escaping because they are ASCII
  // punctuation, so the replacements operate on already-safe text.
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(
    /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/gi,
    (_m, label: string, url: string) => {
      return `<a href="${url.replace(/"/g, "%22")}" style="${A_STYLE}">${label}</a>`;
    },
  );
  // Anything that still looks like a link with a non-https target stays as
  // the literal text the admin typed.
  return out.replace(/\n/g, "<br />");
}

export function bodyToHtml(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="${P_STYLE}">${inline(paragraph)}</p>`)
    .join("");
}

const GREETING_FALLBACK: Record<"en" | "es", string> = {
  en: "Hello",
  es: "Hola",
};

/**
 * `{{first_name}}` and, if ever needed, more. Values are escaped; when the
 * name is empty the token and the space before it vanish so "Hola {{first_name}}"
 * reads "Hola" rather than "Hola ".
 */
export function renderVariables(
  text: string,
  vars: { first_name: string },
  locale: "en" | "es" = "en",
): string {
  void GREETING_FALLBACK[locale];
  const name = vars.first_name.trim();
  if (!name) return text.replace(/\s?\{\{\s*first_name\s*\}\}/g, "").trim();
  return text.replace(/\{\{\s*first_name\s*\}\}/g, escapeHtml(name));
}
```

(Drop `GREETING_FALLBACK` if unused after the tests pass; it is a hint, not a requirement.)

Add to `package.json` scripts: `"test": "bun test"`.

**Step 4: Run tests**

Run: `bun test app/lib/campaigns/body-html.test.ts`
Expected: all PASS. Adjust the `bodyToHtml` bold test if the `<br />` rule and paragraph split interact — the tests define the contract.

**Step 5: Commit**

```bash
git add app/lib/campaigns/body-html.ts app/lib/campaigns/body-html.test.ts package.json
git commit -m "feat(campaigns): the body text becomes html with three rules and nothing else"
```

---

### Task 4: The campaign email template

**Files:**

- Create: `app/emails/templates/campaign.ts`

**Step 1: Implement**

```ts
import { emailBase } from "./_base";
import {
  bodyToHtml,
  escapeHtml,
  renderVariables,
} from "@/lib/campaigns/body-html";
import type { CampaignLocaleContent } from "@/types/campaign";

const FOOTER: Record<"en" | "es", { reason: string; unsubscribe: string }> = {
  en: {
    reason:
      "You are receiving this email because you are a client of Essentia.",
    unsubscribe: "Unsubscribe",
  },
  es: {
    reason: "Recibes este email porque eres cliente de Essentia.",
    unsubscribe: "Darse de baja",
  },
};

export function campaignEmail({
  content,
  firstName,
  unsubscribeUrl,
  locale,
}: {
  content: CampaignLocaleContent;
  firstName: string;
  unsubscribeUrl: string;
  locale: "en" | "es";
}): { subject: string; html: string } {
  const vars = { first_name: firstName };
  const subject = renderVariables(content.subject, vars, locale)
    // Subjects are plain text, not HTML.
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  const title = renderVariables(escapeHtml(content.title), vars, locale);
  const body = renderVariables(bodyToHtml(content.body), vars, locale);
  const footer = FOOTER[locale];

  const image = content.imageUrl
    ? `<img src="${escapeHtml(content.imageUrl)}" alt="" width="496" style="display:block;width:100%;max-width:496px;height:auto;border:0;border-radius:12px;margin:0 0 24px;" />`
    : "";

  const cta =
    content.ctaText && content.ctaUrl
      ? `<table cellpadding="0" cellspacing="0" style="margin:24px auto 8px;"><tr><td style="background-color:#103838;border-radius:999px;">
           <a href="${escapeHtml(content.ctaUrl)}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:500;color:#f0ede6;text-decoration:none;">${escapeHtml(content.ctaText)}</a>
         </td></tr></table>`
      : "";

  const html = emailBase({
    locale,
    preheader: escapeHtml(content.preheader || content.title),
    body: `
      <h1 style="margin:0 0 20px;font-size:26px;font-weight:600;color:#103838;line-height:1.3;">${title}</h1>
      ${image}
      ${body}
      ${cta}
      <p style="margin:32px 0 0;font-size:12px;line-height:1.5;color:#4a6767;">
        ${footer.reason}
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#335554;text-decoration:underline;">${footer.unsubscribe}</a>
      </p>
    `,
  });

  return { subject, html };
}
```

Note the subject: `renderVariables` escapes, and a subject line must not carry entities, so it is unescaped back. Simpler alternative: add an `escape = true` flag to `renderVariables` and pass `false` for the subject. Choose the flag; the test file gains one case for it.

**Step 2: Verify**

Run: `bun run build`
Expected: succeeds.

**Step 3: Commit**

```bash
git add app/emails/templates/campaign.ts app/lib/campaigns/body-html.ts app/lib/campaigns/body-html.test.ts
git commit -m "feat(campaigns): the email a campaign sends, with the footer nobody edits"
```

---

### Task 5: `sendEmailBatch` learns tags, headers, no-BCC and ids

**Files:**

- Modify: `app/emails/send.ts`

**Step 1: Change the shape**

- Extend `SendEmailParams` with:
  ```ts
  tags?: Record<string, string>;
  headers?: Record<string, string>;
  ```
- Change `sendEmailBatch` to return `Promise<{ sent: number; ids: (string | null)[]; error: string | null }>` where `ids[i]` is the Resend id of `emails[i]` (null for invalid addresses or a failed chunk).
- Honour `blindCopy: false` per email (skip the bcc block when false).
- Pass `tags` as Resend expects: `tags: Object.entries(tags).map(([name, value]) => ({ name, value }))`, and `headers` straight through.
- Send chunks **sequentially** with `await new Promise((r) => setTimeout(r, 600))` between them, instead of `Promise.all`. On a chunk error, record `null` ids for that chunk and continue; collect the first error message.

Keep the existing comment block but rewrite the paragraph about parallel batches: they now go out one after another because Resend allows two requests per second and a campaign can have fifty.

**Step 2: Fix the one caller**

`app/api/cron/booking-reminders/route.ts` destructures `{ sent, error }` — still valid. Check `grep -rn "sendEmailBatch(" app` for any other caller.

**Step 3: Verify**

Run: `bun run build && bun run lint`
Expected: clean.

**Step 4: Commit**

```bash
git add app/emails/send.ts
git commit -m "feat(email): the batch sender returns its ids and can keep the office out of copy"
```

---

### Task 6: Audience resolver (filter logic pure and tested)

**Files:**

- Create: `app/lib/campaigns/audience.ts`
- Create: `app/lib/campaigns/audience-filter.ts`
- Create: `app/lib/campaigns/audience-filter.test.ts`

**Step 1: Failing tests for the pure filter**

```ts
// app/lib/campaigns/audience-filter.test.ts
import { describe, expect, test } from "bun:test";
import { filterAudience, type ContactCandidate } from "./audience-filter";
import { EMPTY_AUDIENCE } from "@/types/campaign";

const NOW = new Date("2026-09-05T10:00:00Z");
const c = (over: Partial<ContactCandidate>): ContactCandidate => ({
  id: "1",
  email: "a@x.com",
  firstName: "A",
  language: "en",
  newsletter: false,
  bouncedAt: null,
  lastBookingDate: null,
  serviceIds: [],
  bookingsCount: 0,
  ...over,
});

describe("filterAudience", () => {
  test("drops bounced and empty emails always", () => {
    const out = filterAudience(
      [c({ bouncedAt: "2026-01-01" }), c({ id: "2", email: "" })],
      EMPTY_AUDIENCE,
      NOW,
    );
    expect(out).toHaveLength(0);
  });
  test("language filter", () => {
    const out = filterAudience(
      [c({ language: "es" }), c({ id: "2", language: "en" })],
      { ...EMPTY_AUDIENCE, language: "es" },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });
  test("newsletter true keeps subscribers only", () => {
    const out = filterAudience(
      [c({ newsletter: true }), c({ id: "2" })],
      { ...EMPTY_AUDIENCE, newsletter: true },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });
  test("services: any of the listed", () => {
    const out = filterAudience(
      [
        c({ serviceIds: ["nad-plus"] }),
        c({ id: "2", serviceIds: ["vitamin-c"] }),
      ],
      { ...EMPTY_AUDIENCE, services: ["nad-plus", "power-drip"] },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });
  test("lastBooking gt 60 days means older than 60 days, and never-booked excluded", () => {
    const out = filterAudience(
      [
        c({ lastBookingDate: "2026-05-01" }),
        c({ id: "2", lastBookingDate: "2026-09-01" }),
        c({ id: "3" }),
      ],
      { ...EMPTY_AUDIENCE, lastBooking: { op: "gt", days: 60 } },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });
  test("lastBooking lt 30 days", () => {
    const out = filterAudience(
      [
        c({ lastBookingDate: "2026-09-01" }),
        c({ id: "2", lastBookingDate: "2026-01-01" }),
      ],
      { ...EMPTY_AUDIENCE, lastBooking: { op: "lt", days: 30 } },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["1"]);
  });
  test("neverBooked", () => {
    const out = filterAudience(
      [c({ bookingsCount: 2 }), c({ id: "2" })],
      { ...EMPTY_AUDIENCE, neverBooked: true },
      NOW,
    );
    expect(out.map((r) => r.id)).toEqual(["2"]);
  });
  test("manual ids are unioned but still obey fixed exclusions", () => {
    const out = filterAudience(
      [
        c({ language: "en" }),
        c({ id: "2", language: "es" }),
        c({ id: "3", language: "es", bouncedAt: "2026-01-01" }),
      ],
      { ...EMPTY_AUDIENCE, language: "en", manualIds: ["2", "3"] },
      NOW,
    );
    expect(out.map((r) => r.id).sort()).toEqual(["1", "2"]);
  });
  test("dedupes by lowercase email", () => {
    const out = filterAudience(
      [c({ email: "A@x.com" }), c({ id: "2", email: "a@x.com" })],
      EMPTY_AUDIENCE,
      NOW,
    );
    expect(out).toHaveLength(1);
  });
  test("language falls back to en when unknown", () => {
    const out = filterAudience(
      [c({ language: "fr" as never })],
      EMPTY_AUDIENCE,
      NOW,
    );
    expect(out[0]?.language).toBe("en");
  });
});
```

**Step 2: Run, expect failure**

Run: `bun test app/lib/campaigns/audience-filter.test.ts` → FAIL (module missing).

**Step 3: Implement the pure filter**

```ts
// app/lib/campaigns/audience-filter.ts
import type { CampaignAudience } from "@/types/campaign";

export type ContactCandidate = {
  id: string;
  email: string;
  firstName: string;
  language: string | null;
  newsletter: boolean;
  bouncedAt: string | null;
  /** YYYY-MM-DD of the most recent non-cancelled booking, or null. */
  lastBookingDate: string | null;
  serviceIds: string[];
  bookingsCount: number;
};

export type Recipient = {
  id: string;
  email: string;
  firstName: string;
  language: "en" | "es";
};

const DAY = 86_400_000;

function toLocale(value: string | null): "en" | "es" {
  return value === "es" ? "es" : "en";
}

function passesFilter(
  candidate: ContactCandidate,
  audience: CampaignAudience,
  now: Date,
): boolean {
  const locale = toLocale(candidate.language);
  if (audience.language !== "any" && locale !== audience.language) return false;
  if (audience.newsletter === true && !candidate.newsletter) return false;
  if (
    audience.services.length > 0 &&
    !candidate.serviceIds.some((s) => audience.services.includes(s))
  )
    return false;
  if (audience.neverBooked && candidate.bookingsCount > 0) return false;
  if (audience.lastBooking) {
    if (!candidate.lastBookingDate) return false;
    const ageDays =
      (now.getTime() -
        new Date(candidate.lastBookingDate + "T00:00:00Z").getTime()) /
      DAY;
    if (
      audience.lastBooking.op === "gt" &&
      ageDays <= audience.lastBooking.days
    )
      return false;
    if (
      audience.lastBooking.op === "lt" &&
      ageDays >= audience.lastBooking.days
    )
      return false;
  }
  return true;
}

/** Fixed exclusions apply to filter matches and manual picks alike. */
function isSendable(candidate: ContactCandidate): boolean {
  return candidate.email.includes("@") && candidate.bouncedAt === null;
}

export function filterAudience(
  candidates: ContactCandidate[],
  audience: CampaignAudience,
  now: Date,
): Recipient[] {
  const manual = new Set(audience.manualIds);
  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const candidate of candidates) {
    if (!isSendable(candidate)) continue;
    if (!manual.has(candidate.id) && !passesFilter(candidate, audience, now))
      continue;
    const key = candidate.email.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: candidate.id,
      email: key,
      firstName: candidate.firstName,
      language: toLocale(candidate.language),
    });
  }
  return out;
}
```

**Step 4: Run tests until green**

Run: `bun test app/lib/campaigns/audience-filter.test.ts` → PASS.

**Step 5: The DB-backed resolver**

```ts
// app/lib/campaigns/audience.ts
import { getAdminClient } from "@/lib/insforge-admin";
import type { CampaignAudience } from "@/types/campaign";
import {
  filterAudience,
  type ContactCandidate,
  type Recipient,
} from "./audience-filter";

type ContactRow = {
  id: string;
  email: string | null;
  first_name: string | null;
  preferred_language: string | null;
  newsletter_subscribed: boolean | null;
  email_bounced_at: string | null;
};
type BookingRow = {
  contact_id: string | null;
  service_id: string | null;
  date: string | null;
};

/**
 * Who a campaign reaches, resolved now.
 *
 * Two reads and a filter in memory: contacts, then every non-cancelled booking
 * with a contact attached, folded into last date, services and count per
 * contact. At the centre's scale this is two round trips; if it ever hurts, it
 * becomes an RPC with the same signature and nothing above it changes.
 */
export async function resolveAudience(
  audience: CampaignAudience,
  now = new Date(),
): Promise<Recipient[]> {
  const db = getAdminClient().database;

  const [
    { data: contacts, error: contactsError },
    { data: bookings, error: bookingsError },
  ] = await Promise.all([
    db
      .from("contacts")
      .select(
        "id, email, first_name, preferred_language, newsletter_subscribed, email_bounced_at",
      )
      .not("email", "is", null),
    db
      .from("bookings")
      .select("contact_id, service_id, date")
      .neq("status", "cancelled")
      .not("contact_id", "is", null),
  ]);
  if (contactsError) throw new Error(`contacts: ${contactsError.message}`);
  if (bookingsError) throw new Error(`bookings: ${bookingsError.message}`);

  const history = new Map<
    string,
    { last: string | null; services: Set<string>; count: number }
  >();
  for (const b of (bookings ?? []) as BookingRow[]) {
    if (!b.contact_id) continue;
    const entry = history.get(b.contact_id) ?? {
      last: null,
      services: new Set<string>(),
      count: 0,
    };
    entry.count += 1;
    if (b.service_id) entry.services.add(b.service_id);
    const day = b.date?.slice(0, 10) ?? null;
    if (day && (!entry.last || day > entry.last)) entry.last = day;
    history.set(b.contact_id, entry);
  }

  const candidates: ContactCandidate[] = ((contacts ?? []) as ContactRow[]).map(
    (c) => {
      const h = history.get(c.id);
      return {
        id: c.id,
        email: c.email ?? "",
        firstName: c.first_name ?? "",
        language: c.preferred_language,
        newsletter: c.newsletter_subscribed ?? false,
        bouncedAt: c.email_bounced_at,
        lastBookingDate: h?.last ?? null,
        serviceIds: h ? [...h.services] : [],
        bookingsCount: h?.count ?? 0,
      };
    },
  );

  return filterAudience(candidates, audience, now);
}
```

Check the SDK's filter method names (`.not("email", "is", null)`, `.neq`) against existing usage in `app/actions/*.ts`; adjust to whatever the codebase already uses.

**Step 6: Verify and commit**

Run: `bun run build && bun test`

```bash
git add app/lib/campaigns/audience.ts app/lib/campaigns/audience-filter.ts app/lib/campaigns/audience-filter.test.ts
git commit -m "feat(campaigns): who a campaign reaches, decided in one place"
```

---

### Task 7: Dispatch

**Files:**

- Create: `app/lib/campaigns/dispatch.ts`

**Step 1: Implement**

```ts
import { getAdminClient } from "@/lib/insforge-admin";
import { getAppUrl } from "@/lib/env";
import { sendEmailBatch } from "@/emails/send";
import { campaignEmail } from "@/emails/templates/campaign";
import type { CampaignContent, CampaignRow } from "@/types/campaign";
import { resolveAudience } from "./audience";

const CHUNK = 100;
/** A send that has held the row this long without finishing is stuck. */
export const STUCK_AFTER_MS = 10 * 60_000;
/** And one this old is given up on. */
export const ABANDON_AFTER_MS = 2 * 3_600_000;

type QueuedRow = {
  id: string;
  contact_id: string | null;
  email: string;
  language: "en" | "es";
  contacts:
    | { first_name: string | null; unsubscribe_token: string | null }
    | { first_name: string | null; unsubscribe_token: string | null }[]
    | null;
};

const one = <T>(v: T | T[] | null): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : v;

/**
 * Sends one campaign, or finishes sending it.
 *
 * Claiming the row is the whole concurrency story: the UPDATE only succeeds
 * from `draft`/`scheduled`, or from a `sending` that has been quiet long
 * enough to be presumed dead. Two callers cannot both get a row back.
 */
export async function dispatchCampaign(
  campaignId: string,
  opts: { resume?: boolean } = {},
): Promise<{ ok: boolean; sent: number; failed: number; error?: string }> {
  const db = getAdminClient().database;
  const now = new Date();

  let claim = db
    .from("campaigns")
    .update({
      status: "sending",
      sending_started_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", campaignId);
  claim = opts.resume
    ? claim
        .eq("status", "sending")
        .lt(
          "sending_started_at",
          new Date(now.getTime() - STUCK_AFTER_MS).toISOString(),
        )
    : claim.in("status", ["draft", "scheduled"]);
  const { data: claimed, error: claimError } = await claim.select("*");
  if (claimError)
    return { ok: false, sent: 0, failed: 0, error: claimError.message };
  const campaign = (claimed as CampaignRow[] | null)?.[0];
  if (!campaign)
    return { ok: false, sent: 0, failed: 0, error: "not_claimable" };

  if (!process.env.RESEND_API_KEY) {
    await fail(campaignId, "RESEND_API_KEY is not set");
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "RESEND_API_KEY is not set",
    };
  }

  // Fresh sends freeze the audience now; resumes keep the frozen list.
  if (!opts.resume) {
    const recipients = await resolveAudience(campaign.audience, now);
    if (recipients.length === 0) {
      await fail(campaignId, "empty_audience");
      return { ok: false, sent: 0, failed: 0, error: "empty_audience" };
    }
    const { error: insertError } = await db.from("campaign_recipients").upsert(
      recipients.map((r) => ({
        campaign_id: campaignId,
        contact_id: r.id,
        email: r.email,
        language: r.language,
        status: "queued",
      })),
      { onConflict: "campaign_id,contact_id", ignoreDuplicates: true },
    );
    if (insertError) {
      await fail(campaignId, insertError.message);
      return { ok: false, sent: 0, failed: 0, error: insertError.message };
    }
  }

  const { data: queued, error: queuedError } = await db
    .from("campaign_recipients")
    .select(
      "id, contact_id, email, language, contacts(first_name, unsubscribe_token)",
    )
    .eq("campaign_id", campaignId)
    .eq("status", "queued");
  if (queuedError) {
    await fail(campaignId, queuedError.message);
    return { ok: false, sent: 0, failed: 0, error: queuedError.message };
  }

  const rows = (queued ?? []) as QueuedRow[];
  const content = campaign.content as CampaignContent;
  const appUrl = getAppUrl();
  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const emails = chunk.map((row) => {
      const contact = one(row.contacts);
      const token = contact?.unsubscribe_token ?? "";
      const unsubscribeUrl = `${appUrl}${row.language === "es" ? "/es" : ""}/newsletter/unsubscribe?token=${token}`;
      const { subject, html } = campaignEmail({
        content: content[row.language],
        firstName: contact?.first_name ?? "",
        unsubscribeUrl,
        locale: row.language,
      });
      return {
        to: row.email,
        subject,
        html,
        blindCopy: false,
        tags: { campaign_id: campaignId },
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    let result = await sendEmailBatch(emails);
    if (result.error && result.sent === 0) {
      await new Promise((r) => setTimeout(r, 2000));
      result = await sendEmailBatch(emails);
    }

    const at = new Date().toISOString();
    await Promise.all(
      chunk.map((row, idx) => {
        const id = result.ids[idx] ?? null;
        if (id) {
          sent++;
          return db
            .from("campaign_recipients")
            .update({ status: "sent", provider_id: id, sent_at: at })
            .eq("id", row.id);
        }
        failed++;
        lastError = result.error ?? "no id returned";
        return db
          .from("campaign_recipients")
          .update({ status: "failed", error: lastError })
          .eq("id", row.id);
      }),
    );
  }

  const { count } = await db
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  const { count: failedTotal } = await db
    .from("campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  await db
    .from("campaigns")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      recipients_count: count ?? 0,
      failed_count: failedTotal ?? 0,
      last_error: lastError,
    })
    .eq("id", campaignId);

  return { ok: true, sent, failed };
}

async function fail(campaignId: string, error: string) {
  await getAdminClient()
    .database.from("campaigns")
    .update({
      status: "failed",
      last_error: error,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);
}

/** Puts the failed rows back in the queue and sends them; nothing else is touched. */
export async function retryFailed(campaignId: string) {
  const db = getAdminClient().database;
  await db
    .from("campaign_recipients")
    .update({ status: "queued", error: null })
    .eq("campaign_id", campaignId)
    .eq("status", "failed");
  // Re-open the claim: a `sent` campaign becomes `sending` again for the retry.
  await db
    .from("campaigns")
    .update({
      status: "sending",
      sending_started_at: new Date(0).toISOString(),
    })
    .eq("id", campaignId)
    .eq("status", "sent");
  return dispatchCampaign(campaignId, { resume: true });
}
```

Check how the SDK does `count: "exact", head: true` and `.select("*")` after `.update()` (the codebase uses `update_booking_returning_previous` because `RETURNING` through the SDK was awkward — if `.update().select()` does not return rows, write a tiny RPC `claim_campaign(p_id uuid, p_resume boolean, p_stuck_before timestamptz) RETURNS SETOF campaigns` in a follow-up migration file `20260905b_claim_campaign.sql` and call it instead).

**Step 2: Verify**

Run: `bun run build && bun run lint`

**Step 3: Commit**

```bash
git add app/lib/campaigns/dispatch.ts insforge/migrations/20260905b_claim_campaign.sql
git commit -m "feat(campaigns): one process sends a campaign, and a crash does not send it twice"
```

---

### Task 8: Server actions

**Files:**

- Create: `app/actions/campaigns.ts`

**Step 1: Implement**

All functions: `"use server"`, first param `accessToken: string | null`, guard:

```ts
async function admin(accessToken: string | null) {
  return requireRole(accessToken, ADMIN_ROLES);
}
```

wrapped in try/catch returning `{ ok: false, error: err.message }` for `AuthError`. Return plain objects only (no class instances).

Functions and what they do:

| function                                                               | does                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listCampaigns(token, { status?, page, pageSize })`                    | `select *` ordered by `created_at desc`, `count: "exact"`; returns `{ campaigns: CampaignRow[]; total }`                                                                                                             |
| `fetchCampaign(token, id)`                                             | the row + `campaign_recipients` (id, contact_id, email, language, status, error, timestamps) ordered bounced/complained/failed first then email; returns `{ campaign, recipients }` or `{ campaign: null }`          |
| `saveCampaign(token, input: { id?: string; name; audience; content })` | runs `validateCampaign`; on error returns `{ ok: false, fieldErrors }`; insert or update (only when status is `draft` or `scheduled`); sets `created_by` from `context.userId` on insert; returns `{ ok: true, id }` |
| `deleteCampaign(token, id)`                                            | only `draft`/`cancelled`/`failed`                                                                                                                                                                                    |
| `previewAudience(token, audience)`                                     | validates with `campaignAudienceSchema`, `resolveAudience`, returns `AudiencePreview` (sample = first 20, name = first_name from a second small select or carried on Recipient — add `firstName` to the sample)      |
| `renderCampaignPreview(token, content, locale)`                        | returns `campaignEmail({...}).html` with `firstName: "Ana"`, `unsubscribeUrl: "#"`; does not validate fully so the admin can preview a half-written email                                                            |
| `sendTestCampaign(token, content, locales)`                            | to `context.email` (see `AuthContext` fields in `auth-guard.ts`); subject prefixed `[PRUEBA] `; `blindCopy: false`; uses `sendEmail` per locale                                                                      |
| `sendCampaignNow(token, id)`                                           | `dispatchCampaign(id)`; maps `not_claimable` to a translatable error code                                                                                                                                            |
| `scheduleCampaign(token, id, scheduledAtIso)`                          | validates future date; `update status='scheduled', scheduled_at` where status in draft/scheduled                                                                                                                     |
| `cancelCampaign(token, id)`                                            | `update status='cancelled'` where status = 'scheduled'                                                                                                                                                               |
| `retryFailedRecipients(token, id)`                                     | `retryFailed(id)`                                                                                                                                                                                                    |
| `duplicateCampaign(token, id)`                                         | inserts a copy with `name + " (copia)"`, status draft, counters zero; returns new id                                                                                                                                 |
| `fetchContactCampaigns(token, contactId)`                              | `campaign_recipients` joined with `campaigns(name, sent_at)` for the contact detail tab                                                                                                                              |
| `clearContactBounce(token, contactId)`                                 | `update contacts set email_bounced_at = null`                                                                                                                                                                        |
| `searchContactsForCampaign(token, query)`                              | up to 20 contacts by email/first_name/last_name `ilike`, for the manual picker; returns `{ id, name, email, language }[]`                                                                                            |

Also `revalidatePath("/dashboard/campaigns")` after writes.

**Step 2: Verify**

Run: `bun run build && bun run lint` — remember: no type re-exports from this file.

**Step 3: Commit**

```bash
git add app/actions/campaigns.ts
git commit -m "feat(campaigns): the actions the dashboard calls, every one behind the admin role"
```

---

### Task 9: Webhook recognises campaigns

**Files:**

- Modify: `app/api/webhooks/resend/route.ts`

**Step 1: Extend the event type and branch**

- Add `tags?: Record<string, string>` and `click?: unknown` to `ResendEvent["data"]`.
- Add `"email.clicked"` handling. Map:

```ts
const CAMPAIGN_EVENT: Record<
  string,
  "delivered" | "opened" | "clicked" | "bounced" | "complained"
> = {
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};
```

- After signature verification and before the `booking_events` update:

```ts
if (event.data?.tags?.campaign_id && emailId) {
  const campaignEvent = event.type ? CAMPAIGN_EVENT[event.type] : undefined;
  if (campaignEvent) {
    try {
      await getAdminClient().database.rpc("record_campaign_event", {
        p_provider_id: emailId,
        p_event: campaignEvent,
        p_at: event.created_at ?? new Date().toISOString(),
        p_error:
          campaignEvent === "bounced" || campaignEvent === "complained"
            ? reasonFor(event)
            : null,
      });
    } catch (err) {
      console.error("[webhooks/resend] could not record campaign event:", err);
    }
  }
  return NextResponse.json({ received: true });
}
```

- Update the header comment: the route now serves two tables, chosen by the tag.

**Step 2: Verify**

Run: `bun run build && bun run lint`.

**Step 3: Commit**

```bash
git add app/api/webhooks/resend/route.ts
git commit -m "feat(campaigns): the resend webhook tells a campaign email from a booking email by its tag"
```

---

### Task 10: Cron route

**Files:**

- Create: `app/api/cron/campaigns/route.ts`
- Modify: `vercel.json`

**Step 1: Route**

Copy the secret check from `app/api/cron/booking-reminders/route.ts` (`handle(request)`, `POST`/`GET` exports). Add `export const maxDuration = 60;`. Body:

```ts
const db = getAdminClient().database;
const nowIso = new Date().toISOString();

const { data: due } = await db
  .from("campaigns")
  .select("id")
  .eq("status", "scheduled")
  .lte("scheduled_at", nowIso);
const { data: stuck } = await db
  .from("campaigns")
  .select("id, sending_started_at")
  .eq("status", "sending")
  .lt(
    "sending_started_at",
    new Date(Date.now() - STUCK_AFTER_MS).toISOString(),
  );

const results: Record<string, unknown> = {};
for (const row of (due ?? []) as { id: string }[])
  results[row.id] = await dispatchCampaign(row.id);
for (const row of (stuck ?? []) as {
  id: string;
  sending_started_at: string;
}[]) {
  if (
    Date.now() - new Date(row.sending_started_at).getTime() >
    ABANDON_AFTER_MS
  ) {
    await db
      .from("campaigns")
      .update({ status: "failed", last_error: "abandoned after 2h in sending" })
      .eq("id", row.id);
    results[row.id] = { abandoned: true };
  } else {
    results[row.id] = await dispatchCampaign(row.id, { resume: true });
  }
}
return NextResponse.json({ ok: true, results });
```

**Step 2: vercel.json**

Add `{ "path": "/api/cron/campaigns", "schedule": "*/15 * * * *" }`.

**Step 3: Verify locally**

Run `bun run dev` in another terminal, then:
`curl -s "http://localhost:3000/api/cron/campaigns?secret=$CRON_SECRET"` → `{"ok":true,"results":{}}`.

**Step 4: Commit**

```bash
git add app/api/cron/campaigns/route.ts vercel.json
git commit -m "feat(campaigns): a cron that sends what is due and finishes what was interrupted"
```

---

### Task 11: Navigation and messages skeleton

**Files:**

- Modify: `app/constants/nav.tsx`
- Modify: `app/components/ui/icons.tsx` (add `IconMail` if absent — check with `grep -n IconMail`)
- Modify: `messages/en/dashboard.json`, `messages/es/dashboard.json`

**Step 1: Nav**

Add `{ key: "campaigns", href: "/dashboard/campaigns" }` after `blog` in `navLinks`, and `campaigns: <IconMail />` in `navIcons`. The shell already hides the full list from staff/partner (`restrictedNavLinks`).

**Step 2: Messages**

Add to both files (Spanish shown; write the English equivalent in `en`):

- `nav.campaigns`: "Campañas" / "Campaigns"
- `breadcrumbs.sections.campaigns`: same
- `breadcrumbs.leaves.new` already exists ("New"/"Nueva"); check `getBreadcrumbs` in `app/(dashboard)` or `utils` handles `/dashboard/campaigns/new` and `/dashboard/campaigns/<uuid>` generically (the shell already does UUID detection).
- `validation.*`: `nameRequired`, `subjectRequired`, `subjectTooLong`, `preheaderTooLong`, `titleRequired`, `bodyRequired`, `urlMustBeHttps`, `ctaNeedsBoth`
- A new `campaigns` block:

```json
"campaigns": {
  "title": "Campañas",
  "new": "Nueva campaña",
  "empty": "Todavía no hay campañas.",
  "stats": { "sentThisMonth": "Enviadas este mes", "deliveryRate": "Tasa de entrega", "openRate": "Tasa de apertura" },
  "table": { "name": "Nombre", "status": "Estado", "recipients": "Destinatarios", "delivered": "Entregados", "opened": "Abiertos", "clicked": "Clics", "date": "Fecha" },
  "status": { "draft": "Borrador", "scheduled": "Programada", "sending": "Enviando", "sent": "Enviada", "cancelled": "Cancelada", "failed": "Fallida" },
  "recipientStatus": { "queued": "En cola", "sent": "Enviado", "delivered": "Entregado", "opened": "Abierto", "clicked": "Clic", "bounced": "Rebotado", "complained": "Spam", "failed": "Fallido" },
  "steps": { "audience": "Audiencia", "content": "Contenido", "review": "Revisar" },
  "audience": {
    "language": "Idioma", "languageAny": "Ambos", "newsletter": "Solo suscritos a la newsletter",
    "services": "Ha reservado alguno de estos servicios", "lastBooking": "Última reserva",
    "lastBookingGt": "hace más de", "lastBookingLt": "hace menos de", "days": "días",
    "neverBooked": "Nunca ha reservado", "manual": "Añadir contactos a mano", "manualSearch": "Buscar por nombre o email…",
    "reach": "Llegará a {count} personas", "reachByLanguage": "{en} en inglés · {es} en español", "sample": "Ver muestra", "none": "Ninguna persona cumple las condiciones"
  },
  "content": {
    "subject": "Asunto", "preheader": "Pre-encabezado", "title": "Título", "body": "Cuerpo",
    "bodyHelp": "Línea en blanco = párrafo. **negrita**. [texto](https://enlace). {{first_name}} pone el nombre.",
    "image": "Imagen (opcional)", "ctaText": "Texto del botón", "ctaUrl": "Enlace del botón",
    "preview": "Vista previa", "previewMobile": "Móvil", "previewDesktop": "Escritorio", "notSentIn": "Esta campaña no se envía en {language}"
  },
  "review": {
    "title": "Revisar y enviar", "sendTest": "Enviarme una prueba", "testSent": "Prueba enviada a {email}",
    "saveDraft": "Guardar borrador", "sendNow": "Enviar ahora", "schedule": "Programar", "scheduleAt": "Fecha y hora",
    "confirmSend": "¿Enviar ahora a {count} personas? No se puede deshacer.", "confirm": "Sí, enviar", "cancel": "Cancelar"
  },
  "detail": {
    "sent": "Enviados", "delivered": "Entregados", "opened": "Abiertos", "clicked": "Clics", "bounced": "Rebotados", "complained": "Spam", "failed": "Fallidos",
    "byLanguage": "Por idioma", "recipients": "Destinatarios", "search": "Buscar email…",
    "openNote": "Las aperturas son orientativas: Apple Mail las cuenta aunque nadie lea el email. La entrega es el dato fiable.",
    "duplicate": "Duplicar", "cancelScheduled": "Cancelar envío", "retryFailed": "Reintentar fallidos", "delete": "Eliminar",
    "scheduledFor": "Programada para {date}", "sentAt": "Enviada el {date}"
  },
  "form": { "name": "Nombre interno", "namePlaceholder": "Promoción de otoño", "next": "Siguiente", "back": "Atrás" },
  "errors": { "not_claimable": "La campaña ya se está enviando o ya se envió.", "empty_audience": "No hay nadie a quien enviar.", "generic": "Algo ha fallado. Inténtalo de nuevo." }
},
"contacts": { "...existing...": "", "detail": { "...": "", "campaigns": { "tab": "Campañas", "empty": "No ha recibido campañas.", "bounced": "Este email rebotó el {date}. Está excluido de las campañas.", "clearBounce": "Limpiar rebote" } } }
```

(Merge the `contacts.detail.campaigns` keys into the existing `contacts.detail` object; do not replace it.)

**Step 3: Verify**

Run: `bun run check:messages` → EN and ES have identical key sets. Run `bun run build`.

**Step 4: Commit**

```bash
git add app/constants/nav.tsx app/components/ui/icons.tsx messages/en/dashboard.json messages/es/dashboard.json
git commit -m "feat(campaigns): a door in the navigation and the words behind it"
```

---

### Task 12: List page

**Files:**

- Create: `app/(dashboard)/dashboard/campaigns/page.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/campaign-table.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/status-badge.tsx`

**Step 1: Implement**

Copy the structure of `subscriptions/page.tsx`: `"use client"`, `useReducer` list state, `StatCard` row, filter by status (a simple `<select>` is enough here, no modal), `Pagination`, "Nueva campaña" `Button` with `href="/dashboard/campaigns/new"`. Data from `listCampaigns(getAccessToken(), { status, page, pageSize: 20 })`.

Stats: computed client-side from the fetched page is wrong for totals; instead add a `fetchCampaignStats(token)` action in Task 8's file returning `{ sentThisMonth, delivered, recipients, opened }` from a `select` on `campaigns` where `status='sent'` and `sent_at >= first of month`. Rates = `delivered/recipients`, `opened/delivered`, shown as `%`.

`StatusBadge`: pill with colours — draft `bg-sand-100 text-petroleum-500`, scheduled `bg-amber-100 text-amber-800`, sending `bg-blue-100 text-blue-800`, sent `bg-emerald-100 text-emerald-800`, cancelled `bg-sand-200 text-petroleum-400`, failed `bg-red-100 text-red-700`. Labels from `campaigns.status.*`.

Table rows link to `/dashboard/campaigns/<id>` (detail) when status is `sent`/`sending`/`failed`, and to `/dashboard/campaigns/<id>/edit` when `draft`/`scheduled`/`cancelled`.

**Step 2: Verify**

`bun run dev`, sign in as admin, open `/dashboard/campaigns`: empty state renders, nav item highlighted, staff account does not see the item.

**Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/campaigns"
git commit -m "feat(campaigns): the list, with the numbers that matter at a glance"
```

---

### Task 13: Form state and the audience step

**Files:**

- Create: `app/(dashboard)/dashboard/campaigns/_form/form-state.ts`
- Create: `app/(dashboard)/dashboard/campaigns/_form/audience-step.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/_form/contact-picker.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/_form/campaign-form.tsx` (shell with step indicator; steps 2 and 3 stubbed until Tasks 14–15)
- Create: `app/(dashboard)/dashboard/campaigns/new/page.tsx` → renders `<CampaignForm />`

**Step 1: form-state**

```ts
export type FormState = {
  id: string | null;
  step: 0 | 1 | 2;
  name: string;
  audience: CampaignAudience;
  content: CampaignContent;
  activeLocale: "en" | "es";
  fieldErrors: Record<string, string>;
  submitting: boolean;
  error: string | null;
};
export type FormAction =
  | { type: "SET_NAME"; value: string }
  | { type: "SET_AUDIENCE"; patch: Partial<CampaignAudience> }
  | { type: "TOGGLE_MANUAL"; id: string }
  | {
      type: "SET_CONTENT";
      locale: "en" | "es";
      field: keyof CampaignLocaleContent;
      value: string;
    }
  | { type: "SET_LOCALE"; locale: "en" | "es" }
  | { type: "GO"; step: 0 | 1 | 2 }
  | { type: "SET_ERRORS"; errors: Record<string, string> }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_ERROR"; message: string }
  | { type: "SUBMIT_DONE"; id: string }
  | { type: "LOAD"; campaign: CampaignRow };
```

Reducer straightforward; `SET_CONTENT` clears `fieldErrors["content.<locale>.<field>"]`.

**Step 2: audience-step**

Controls, in this order, each in a `rounded-2xl border bg-white p-6` card:

1. Language: three pill buttons (Ambos / EN / ES) using `OptionSelect` if it fits, else buttons.
2. Newsletter: toggle (copy the toggle markup from `contact-details-card.tsx`).
3. Services: `MultiOptionSelect` from `@/components/ui/multi-option-select` over `bookableServices` (`id`, `title`) from `@/data/services-data`.
4. Last booking: toggle "activar" + `<select>` gt/lt + `<input type="number" min=1>` days.
5. Never booked: toggle. When on, disable the two booking controls above (they cannot both hold).
6. Manual picker: `ContactPicker` — search input debounced 300 ms → `searchContactsForCampaign`; results list with "Añadir"; selected chips with ×. Store ids in `audience.manualIds`; keep a local `Map<id, {name,email}>` for chip labels (also seeded from the preview sample when editing).

Reach banner at the bottom: `useEffect` on `JSON.stringify(audience)` debounced 400 ms → `previewAudience`; shows `campaigns.audience.reach` with count and `reachByLanguage`, plus a collapsible list of the sample. Show `none` in red when count is 0.

**Step 3: campaign-form shell**

- Name field at the top (`TextField` from `@/components/dashboard/form-fields`).
- Step indicator: three tabs (`TabButton`), clicking a previous step allowed, forward only via "Siguiente".
- Step 0 = `AudienceStep`; steps 1–2 render a placeholder `<div>` for now.
- "Siguiente" from step 0 requires `count > 0` (lift `count` into form state via a `SET_REACH` action).

**Step 4: Verify**

`/dashboard/campaigns/new` renders; changing conditions updates the reach count; adding a manual contact increments it.

**Step 5: Commit**

```bash
git add "app/(dashboard)/dashboard/campaigns"
git commit -m "feat(campaigns): the audience step shows who will get it before anything is written"
```

---

### Task 14: Content step with live preview

**Files:**

- Create: `app/(dashboard)/dashboard/campaigns/_form/content-step.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/_form/email-preview.tsx`
- Modify: `campaign-form.tsx` (wire step 1)

**Step 1: content-step**

Two columns on `lg:` (form left, preview right sticky), stacked on mobile.

Left:

- Locale tabs EN / ES (`TabButton`). A locale not in `requiredLocales(audience.language)` shows the `notSentIn` note and disables its fields.
- Fields via `TextField`/`TextAreaField`: subject (with `120` counter), preheader (150 counter), title, body (rows 10, help text `bodyHelp` under it), `ImageUpload` with `bucket="campaigns"` (create the bucket in Insforge if missing — public read; see `insforge-cli` skill) and a fallback URL text input, ctaText, ctaUrl.
- Field errors from `fieldErrors["content.<locale>.<field>"]`.

Right: `EmailPreview` — calls `renderCampaignPreview(token, content, activeLocale)` debounced 500 ms, renders `<iframe srcDoc={html} sandbox="" className=...>` with a width toggle (375 px / 600 px). Height 640 px, `border-sand-200 rounded-2xl border bg-sand-50`.

**Step 2: Wire**

"Siguiente" from step 1 runs `validateCampaign` (Task 2) client-side and dispatches `SET_ERRORS` if invalid, jumping the locale tab to the first offending locale.

**Step 3: Verify**

Type a body with `**bold**` and a link; the iframe updates; `<script>` typed into the body appears as text.

**Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/campaigns"
git commit -m "feat(campaigns): the content step, with the email drawn beside it as it is written"
```

---

### Task 15: Review step, save, send, schedule, edit route

**Files:**

- Create: `app/(dashboard)/dashboard/campaigns/_form/review-step.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/[id]/edit/page.tsx`
- Modify: `campaign-form.tsx`

**Step 1: review-step**

Cards: audience summary (reach count, by language, conditions as human sentences), content summary per locale (subject + title), and the action row:

- **Enviarme una prueba** → `saveCampaign` first (so the draft exists), then `sendTestCampaign`; toast `testSent`.
- **Guardar borrador** → `saveCampaign`; toast; `push("/dashboard/campaigns")`.
- **Programar** → `<input type="datetime-local">` (min = now + 5 min) + button → `saveCampaign` then `scheduleCampaign`.
- **Enviar ahora** → opens an inline confirm panel (not `window.confirm` — browser dialogs are off-limits) with `confirmSend` text; confirm → `saveCampaign` then `sendCampaignNow`; on success `push("/dashboard/campaigns/<id>")`.

All buttons disabled while `submitting`. Errors mapped through `campaigns.errors.*` with `generic` fallback.

**Step 2: edit route**

`[id]/edit/page.tsx`: `"use client"`, reads `useParams()`, `fetchCampaign`, dispatches `LOAD`; if status is not `draft`/`scheduled`/`cancelled` redirect to the detail page. Set the breadcrumb dynamic label with the campaign name (see how `contacts/[id]/page.tsx` uses `useBreadcrumbContext`/`setDynamicLabel`).

**Step 3: Verify (end to end, with a 2-contact manual audience of your own addresses)**

1. Create campaign, pick two manual contacts (one `es`, one `en`), write both locales, send test → email arrives with `[PRUEBA]`.
2. Save draft → appears in the list as Borrador; open edit → fields restored.
3. Enviar ahora → list shows Enviada with 2 destinatarios; both inboxes receive the right language; the footer unsubscribe link opens `/newsletter/unsubscribe?token=…` (ES one under `/es/`).
4. In Resend's dashboard, the emails carry tag `campaign_id` and the `List-Unsubscribe` header.

**Step 4: Commit**

```bash
git add "app/(dashboard)/dashboard/campaigns"
git commit -m "feat(campaigns): review, test, save, schedule or send, and come back to edit"
```

---

### Task 16: Detail page

**Files:**

- Create: `app/(dashboard)/dashboard/campaigns/[id]/page.tsx`
- Create: `app/(dashboard)/dashboard/campaigns/[id]/recipient-table.tsx`

**Step 1: Implement**

- Header: name, `StatusBadge`, `sentAt`/`scheduledFor` line, action buttons: Duplicar (→ `duplicateCampaign` → push edit of the new id), Cancelar envío (scheduled only), Reintentar fallidos (when `failed_count > 0`), Eliminar (draft/cancelled/failed; inline confirm).
- Counter grid (7 `StatCard`s or a simpler stat tile): sent (`recipients_count - failed_count`), delivered, opened, clicked, bounced, complained, failed. Under each, percentage of sent.
- `openNote` under the opened tile in `text-xs text-petroleum-400`.
- By-language block: counts computed from the recipients array (en/es × delivered).
- `RecipientTable`: search input filters by email client-side; columns email, idioma, estado (badge with `recipientStatus.*`), fecha (latest of clicked/opened/delivered/sent), error. Sorted: bounced, complained, failed first.
- Poll: while status is `sending`, `setInterval` refetch every 5 s.

**Step 2: Verify**

Open the campaign sent in Task 15. Delivered count should read 2 within a minute (webhook). Open one email → opened 1. Click the CTA → clicked 1, opened stays 1 (a click counts as open only when the open event never arrived; verify the RPC math holds — clicked implies opened, so opened may become 2 if the second recipient clicked without an open event; that is correct).

Bounce test: create a campaign with a manual contact whose email is `bounced@resend.dev` (create the contact in `/dashboard/contacts/new` first). Send. Within a minute: bounced 1, and `select email_bounced_at from contacts where email='bounced@resend.dev'` is set. Preview any audience: that contact is excluded.

**Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/campaigns"
git commit -m "feat(campaigns): what happened to a campaign, per number and per person"
```

---

### Task 17: Contact detail — campaigns tab and bounce banner

**Files:**

- Modify: `app/(dashboard)/dashboard/contacts/[id]/page.tsx`
- Modify: `app/actions/contacts.ts` (`fetchContactDetail` select gains `email_bounced_at`), `app/types/contact.ts` (`ContactDetail.email_bounced_at: string | null`)

**Step 1: Implement**

- Add a fifth `historyTabs` entry `campaigns` with count = rows from `fetchContactCampaigns`. Rows: campaign name, sent date, `recipientStatus` badge.
- Above the form, when `email_bounced_at` is set: a red banner with `contacts.detail.campaigns.bounced` and a "Limpiar rebote" button → `clearContactBounce` → reload.

**Step 2: Verify**

Open the `bounced@resend.dev` contact: banner shows; clear it; banner disappears; the campaigns tab lists the campaign with estado Rebotado.

**Step 3: Commit**

```bash
git add "app/(dashboard)/dashboard/contacts" app/actions/contacts.ts app/types/contact.ts
git commit -m "feat(campaigns): a contact's page shows what it received and whether it bounced"
```

---

### Task 18: Consent checkbox in the public booking form

**Files:**

- Modify: `app/types/index.ts` (`DetailsState.newsletter?: boolean`)
- Modify: `app/components/sections/booking/booking-state.ts` (`EMPTY_DETAILS.newsletter: false`)
- Modify: `app/components/sections/booking/steps/details-step.tsx`
- Modify: `app/components/sections/booking/booking-submit.ts` (`p_newsletter: details.newsletter ? true : null`)
- Modify: `messages/en/booking.json`, `messages/es/booking.json` (`detailsStep.newsletterOptIn`)
- Check: `app/storage/booking-storage.ts` persists `details` — make sure the new field round-trips or defaults.

**Step 1: UI**

Under the legal `Checkbox`, a second `Checkbox`:

```tsx
<Checkbox
  name="newsletter"
  checked={details.newsletter ?? false}
  onChange={(e) => onChange({ ...details, newsletter: e.target.checked })}
  label={
    <span className="text-petroleum-400 text-sm">{t("newsletterOptIn")}</span>
  }
/>
```

Copy — ES: "Quiero recibir novedades y ofertas de Essentia por email (opcional)." EN: "I'd like to receive Essentia news and offers by email (optional)."

**Step 2: Submit**

In `booking-submit.ts`, the `upsert_contact` call gains `p_newsletter: details.newsletter ? true : null`. Also the logged-in path: if `user` exists and `details.newsletter`, call the existing `updateNewsletterForUser` action after the draft is saved (best effort).

**Step 3: Verify**

Book with the box ticked using a fresh email → `select newsletter_subscribed, newsletter_subscribed_at from contacts where email='…'` → `true`, timestamp. Book again with the box unticked → still `true`.

**Step 4: Commit**

```bash
git add app/types/index.ts app/components/sections/booking messages/en/booking.json messages/es/booking.json
git commit -m "feat(newsletter): the booking form asks, and an unticked box changes nothing"
```

---

### Task 19: Consent checkbox at sign-up

**Files:**

- Modify: `app/components/auth/sign-up-form.tsx` (state + checkbox under the password field, styled like the booking `Checkbox`)
- Modify: `app/actions/auth.ts` (`signUp(email, password, name, newsletter = false)`)
- Modify: `messages/en/auth.json`, `messages/es/auth.json` (`signUp.newsletterOptIn`)

**Step 1: Action**

After `auth.signUp` succeeds, when `newsletter` is true:

```ts
await getAdminClient()
  .database.from("contacts")
  .upsert(
    {
      email: address,
      first_name: parsed.data.name?.split(" ")[0] ?? null,
      newsletter_subscribed: true,
      newsletter_subscribed_at: new Date().toISOString(),
    },
    { onConflict: "email" },
  );
```

Wrap in try/catch and log; consent bookkeeping must never fail a sign-up. Do **not** touch `profiles` here — the profile may not exist yet (memory `signup-profile-insert-fails`); `/account` reads `profiles.newsletter_subscribed`, so also add, in `verifyEmail` after success, a best-effort `update profiles set newsletter_subscribed = true where id = <user> and exists (select 1 from contacts where email = <address> and newsletter_subscribed)`.

**Step 2: Verify**

Sign up with the box ticked → contacts row `newsletter_subscribed = true`. After verifying the code, `/account` shows the toggle on.

**Step 3: Commit**

```bash
git add app/components/auth/sign-up-form.tsx app/actions/auth.ts messages/en/auth.json messages/es/auth.json
git commit -m "feat(newsletter): sign-up asks too"
```

---

### Task 20: Consent toggles in the dashboard forms

**Files:**

- Modify: `app/(dashboard)/dashboard/contacts/new/form-state.ts` (`newsletter: boolean`, `TOGGLE_NEWSLETTER`), `contact-fields.tsx` (toggle), `page.tsx` (upsert gains `newsletter_subscribed` **only when true**, plus `newsletter_subscribed_at`)
- Modify: `app/(dashboard)/dashboard/bookings/new/form-state.ts` (`newsletter: boolean`), `client-step.tsx` (toggle under language), `create-booking.ts` (`p_newsletter: form.newsletter ? true : null`)
- Messages: reuse `dashboard.contacts.detail.newsletter.label`; add `dashboard.contacts.form.newsletterHelp`: "Solo si el cliente lo ha pedido." / "Only if the client asked for it."

Toggle markup: extract the button from `contact-details-card.tsx` lines ~200-240 into `app/components/dashboard/newsletter-toggle.tsx` (`checked`, `disabled`, `onToggle`, `label`, `hint`) and use it in all three places (detail card included) — one component, three callers.

**Step 1–3:** implement, verify by creating a contact with the toggle on (row `true`) and a booking with it off for the same contact (row still `true`), commit:

```bash
git commit -m "feat(newsletter): staff can record consent when they take a booking or a contact"
```

---

### Task 21: Documentation, full verification, finish

**Files:**

- Modify: `CLAUDE.md` — add a short "Email Campaigns" subsection under _Key Architectural Patterns_ (tables, `dispatchCampaign`, webhook tag, cron, consent rule) and `bun test` under Commands.
- Modify: `env.example` — comment under `RESEND_WEBHOOK_SECRET`: the webhook must subscribe to `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`; open/click tracking must be on for the domain.
- Modify: memory `MEMORY.md` entry (project) only if something non-obvious surfaced during implementation (e.g. an SDK quirk with `.update().select()`).

**Step 1: Full checks**

```bash
bun test
bun run format && bun run lint
bun run check:messages
bun run build
```

All clean.

**Step 2: Manual checklist** (from the design doc's _Verificación_): items 3–7. Record what was run and the outcome in the final message.

**Step 3: Commit**

```bash
git add CLAUDE.md env.example
git commit -m "docs(campaigns): how the campaign system fits, for the next reader"
```

**Step 4: Hand off**

Use `superpowers:finishing-a-development-branch` — the branch is `feat/email-campaigns` in `.worktrees/email-campaigns`; the user decides merge vs PR.
