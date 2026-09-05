# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # dev server
bun run build        # production build (also validates TypeScript)
bun run lint         # ESLint
bun run format       # Prettier (write)
bun run format:check # Prettier (check only)
bun run test         # bun test — pure modules only (campaign body parser, audience filter, email template)
```

Automated tests exist only for pure modules under `app/lib/campaigns/` and `app/emails/templates/campaign.test.ts`. Everything else is validated with `bun run build`.

**Always run `bun run format && bun run lint` before committing.** Both must pass clean (zero errors, zero warnings).

---

## Stack

- **Next.js 16** App Router · **React 19** · **TypeScript 5** · **Tailwind CSS v4**
- **next-intl 4** for i18n (EN/ES) with `localePrefix: "as-needed"` — English at `/`, Spanish at `/es/*`
- **@insforge/sdk** as the database/auth client (Supabase-compatible API)
- **Resend** for transactional email
- **Redsys** as the sole payment gateway (Santander TPV)
- **GSAP** for all animations — scroll-driven reveals, letter-split hover effects

---

## Repository Structure

```
app/
  layout.tsx                  # Root layout: fonts, schema.org, AuthProvider, ConsentManager
  [locale]/
    (page)/                   # All public-facing pages (home, wellness, medicine, community…)
    opengraph-image.tsx        # Locale-aware OG image (EN/ES copy)
  (dashboard)/dashboard/      # Staff-only dashboard: bookings, contacts, members, staff…
  (account)/account/          # Authenticated user account pages
  actions/                    # Server Actions (booking-notifications, payments, newsletter…)
  api/
    [transport]/route.ts       # MCP server for AI agent tool calling (list_services, get_availability, create_booking)
    google/calendar/           # Google OAuth callback + FreeBusy endpoint
    checkout/                  # Redsys payment session creation
    webhooks/redsys/           # Redsys payment webhook → triggers confirmation email
    webhooks/whatsapp/         # Meta status callbacks → advances booking_events.status
    cron/campaigns/            # Every 15 min: sends scheduled campaigns, resumes interrupted ones
  components/
    ui/                        # Primitives: Button, Input, Accordion, Logo, AnimatedText…
    sections/                  # Page-section components grouped by page (home/, wellness/, booking/…)
    header.tsx / footer.tsx
  emails/
    send.ts                    # sendEmail() — Resend wrapper, auto-BCCs admin
    templates/                 # HTML email templates: _base.ts helpers + per-event files
  lib/
    insforge.ts                # Anon Insforge client (browser-safe)
    campaigns/                 # audience.ts (who gets it), dispatch.ts (send + resume), body-html.ts (text → safe HTML)
    google-calendar.ts         # Google Calendar OAuth + CRUD + token auto-refresh
    payments/                  # RedsysProvider (sole payment provider)
    og-logo.ts                 # Edge-safe SVG data URL helper for OG images
    sitemap-data.ts            # Shared sitemap utilities + fetchBlogPosts (unstable_cache, 1h TTL)
  data/                        # Static data: bookableServices, manualTherapyTreatments, testimonials…
  constants/
    booking.ts                 # TIME_SLOTS (08:00–19:00, 30-min intervals)
  lib/schemas.ts               # Shared Zod schemas (booking, sign-in…)
messages/
  en/ es/                      # Translation JSON files, one per page namespace
i18n/
  request.ts                   # next-intl config — loads all namespaces per request
  routing.ts                   # Locale routing config
insforge/migrations/           # SQL migration files
public/
  llms.txt / llms-full.txt     # AI agent discoverability (ChatGPT, Claude, Gemini, Perplexity)
```

---

## Key Architectural Patterns

### i18n

Every page under `app/[locale]/(page)/` exports `generateMetadata` using `getTranslations()` from the page's namespace (`messages/en/<page>.json` / `messages/es/<page>.json`). The `meta.title` and `meta.description` keys drive SEO. **Title max 65 chars, description max 155 chars.**

### Database (Insforge SDK)

Two client modes:

- `app/lib/insforge.ts` — anon key, used in Server Components/Actions for user-scoped queries
- `createClient({ anonKey: INSFORGE_SERVICE_KEY })` — service key, used in Server Actions that need admin access (booking mutations, email lookups, Google token storage). Never import `INSFORGE_SERVICE_KEY` in client components.

### Booking Flow

1. Client picks service/date/time on `/booking` → Server Action creates a draft booking via `create_draft_booking` RPC
2. Staff confirms from dashboard → `notifyBooking({ event: "confirmed", …, dateIso })` sends email with Google Calendar button
3. Optional Redsys payment → `/api/checkout/booking-session` → Redsys → webhook at `/api/webhooks/redsys` → `handleBookingPaid()` → confirmation email

### Email System

All templates are plain TypeScript functions returning HTML strings (no JSX/React Email). `_base.ts` provides `emailBase()`, `bookingDetailsCard()`, `googleCalendarUrl()`, and `calendarButton()`. `sendEmail()` auto-BCCs the admin email fetched from `profiles` table. Always pass `dateIso` (YYYY-MM-DD) alongside the formatted `date` to templates that include the calendar button.

### Email Campaigns

Admin-only (`/dashboard/campaigns`). Design: `docs/plans/2026-09-05-email-campaigns-design.md`.

- Tables `campaigns` (jsonb `audience` + `content`, denormalised counters) and `campaign_recipients` (one row per address, UNIQUE `(campaign_id, email)`). Both have RLS with no policies: only the service key reads them.
- Segmentation runs in `app/lib/campaigns/audience.ts` against `contacts` + `bookings`, never in Resend. Fixed exclusions: no email, `contacts.email_bounced_at` set. Manual picks are unioned with the filter.
- `dispatchCampaign()` claims the row atomically (`draft|scheduled → sending`), freezes the audience as `queued` rows, sends in chunks of 100 via `sendEmailBatch` with `tags.campaign_id`, `blindCopy: false` and `List-Unsubscribe` headers, and stamps `provider_id`. A resume sends only `queued` rows, so a timeout never double-sends.
- The Resend webhook (`/api/webhooks/resend`) routes events carrying `tags.campaign_id` to the `record_campaign_event` RPC, which moves a recipient forward only and bumps counters once. Opens/clicks need tracking enabled on the Resend domain and the events subscribed on the webhook.
- Email body is a Maily document (`@maily-to/core` editor in the content step, `@maily-to/render` on the server). `campaignEmail()` wraps the admin's document between our logo and the fixed footer and renders the whole thing with Maily; plain `{{first_name}}` text tokens are filled afterwards (escaped), Maily variable nodes by the renderer. House templates are still written as simple blocks in `app/lib/campaigns/templates.ts` and converted with `blocksToDoc()`.
- **Kinds**: `standard` and `split` (A/B subject, recipients dealt alternately, per-variant opens in the report) are one-off sends. `automated`, `autoresponder`, `rss` and `dateBased` are `active` campaigns: every cron tick `runAutomation()` resolves the segment, asks `automation-rules.ts` who is owed an email today and under which `cycle` (`""` once ever, the year for birthdays, the post id for blog announcements), inserts `queued` rows (unique on `campaign_id, email, cycle`, so repeats are no-ops) and sends them. Triggers: `newsletter_subscribed`, `segment_entry`, `after_booking` (+days), `birthday` (needs `contacts.birthdate`), `first_booking_anniversary`, `new_blog_post` (template vars `{{post_title}}`, `{{post_excerpt}}`, `{{post_url}}`).
- **Consent rule**: the newsletter checkbox/toggle (booking form, sign-up, dashboard contact + booking) only ever sets `newsletter_subscribed = true`; unticked means "do not touch". `upsert_contact(p_newsletter)` encodes this. An explicit unsubscribe stamps `contacts.newsletter_unsubscribed_at`, and the audience resolver excludes those contacts whatever the campaign's filter says.

### Google Calendar Integration

Each bookable service has its own OAuth tokens stored in `service_configs`. `getValidAccessToken(serviceId)` in `app/lib/google-calendar.ts` auto-refreshes expired tokens (60s buffer). The FreeBusy endpoint (`/api/google/calendar/freebusy`) is called by the MCP `get_availability` tool and by the booking UI.

### MCP Server

`app/api/[transport]/route.ts` exposes three tools to AI agents: `list_services`, `get_availability`, `create_booking`. Uses `mcp-handler` 2 (not `@vercel/mcp-adapter`). `basePath` and `maxDuration` were dropped in 2.x — the handler serves wherever it is mounted, so the route still answers at `/api/mcp` via the `[transport]` segment.

### OG Images

- `app/opengraph-image.tsx` — EN only (root fallback)
- `app/[locale]/opengraph-image.tsx` — locale-aware EN/ES copy. No `generateImageMetadata` (incompatible with edge runtime + dynamic parent segment).
- `app/lib/og-logo.ts` — `getLogoSvgUrl(color?)` builds a clean SVG data URL from hardcoded path data (avoids React-specific attributes and `currentColor` from `public/logo.svg`).

### Sitemaps

Three routes: `/sitemap.xml` (index), `/sitemap-en.xml`, `/sitemap-es.xml`. Blog posts fetched via `fetchBlogPosts()` wrapped in `unstable_cache` (1h TTL). `BlogPost.lastModified` is a `string` (YYYY-MM-DD), not a `Date` — `unstable_cache` serializes to JSON which strips Date methods.

### Design System

Defined in `DESIGN.md`. Key tokens:

- `#103838` petroleum-700 — primary dark (buttons, header bg in emails)
- `#f0ede6` sand-100 — primary light background
- `#c2baa5` sand-500 — body text on dark
- `#335554` petroleum-500 — interactive text / links
- Fonts: Jedira (display serif, local woff2) + DM Sans 300/400/500 (body, local woff2)
- All buttons are `rounded-full`; max-width `max-w-4xl` (896px) throughout

---

## Environment Variables

See `env.example` for the full list. Critical ones:

- `NEXT_PUBLIC_INSFORGE_URL` + `NEXT_PUBLIC_INSFORGE_ANON_KEY` — DB (browser-safe)
- `INSFORGE_SERVICE_KEY` — admin DB access (server only)
- `RESEND_API_KEY` + `RESEND_FROM_EMAIL` — email sending
- `REDSYS_MERCHANT_CODE` + `REDSYS_SECRET_KEY` + `REDSYS_ENVIRONMENT` — payments
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — Calendar OAuth
- `NEXT_PUBLIC_APP_URL` — used for absolute URLs in webhooks, emails, OG images
