# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev          # dev server
bun run build        # production build (also validates TypeScript)
bun run lint         # ESLint
bun run format       # Prettier (write)
bun run format:check # Prettier (check only)
bun run test         # bun test — pure modules, plus callers run for real with the database and the mailer replaced
```

Automated tests cover pure modules (`app/lib/{campaigns,whatsapp,messages,bookings}/`, `app/emails/defaults/`, `app/emails/templates/campaign.test.ts`) and the sending paths (`app/lib/bookings/notify.test.ts`, `app/lib/messages/callers.test.ts`, `app/api/cron/booking-reminders/route.test.ts`, `app/lib/whatsapp/callers.test.ts`), which run the real function with its database, mailer and history replaced through `mock.module` and put the real modules back in `afterAll` (`mock.module` is process-wide). Everything else is validated with `bun run build`, which does NOT validate what hangs off `app/actions/` (a `"use server"` module may only export async functions; never re-export types from one). Those tests that must not hang the suite spawn a child process with a timeout (`app/lib/messages/safe-doc.child.ts`).

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
  (site)/[locale]/
    (page)/                   # All public-facing pages (home, wellness, medicine, community…)
    opengraph-image.tsx        # Locale-aware OG image (EN/ES copy)
  (dashboard)/dashboard/      # Staff-only dashboard: bookings, contacts, members, staff…
    campaigns/                 # Campaigns, email and WhatsApp (admin only)
    messages/                  # Messages: editable emails (email/), WhatsApp templates (whatsapp/)
  (account)/account/          # Authenticated user account pages
  actions/                    # Server Actions (booking-notifications, payments, newsletter, campaigns, message-templates, whatsapp-templates…)
  api/
    [transport]/route.ts       # MCP server for AI agent tool calling (list_services, get_availability, create_booking)
    google/calendar/           # Google OAuth callback + FreeBusy endpoint
    checkout/                  # Redsys payment session creation
    webhooks/redsys/           # Redsys payment webhook → triggers confirmation email
    webhooks/whatsapp/         # Meta: message states, template reviews, inbound STOP/BAJA
    webhooks/resend/           # Resend delivery events → booking_events and record_campaign_event
    cron/campaigns/            # Every 15 min: sends scheduled campaigns (email and WhatsApp), resumes interrupted ones, runs automations
    cron/booking-reminders/    # Hourly: the EMAIL reminder for sessions 40–56 h away (its WhatsApp version is an appointment campaign)
  components/
    ui/                        # Primitives: Button, Input, Accordion, Logo, AnimatedText…
    sections/                  # Page-section components grouped by page (home/, wellness/, booking/…)
    dashboard/maily-editor.tsx # Maily editor for transactional messages (slash menu without raw HTML)
    header.tsx / footer.tsx
  emails/
    send.ts                    # sendEmail() — Resend wrapper, auto-BCCs admin
    templates/                 # HTML email templates: _base.ts helpers + per-event files (the "legacy" emails)
    defaults/                  # Default text of each editable message (editor and reset only), one file per key
  lib/
    insforge.ts                # Anon Insforge client (browser-safe)
    campaigns/                 # audience.ts (who gets it), dispatch.ts (send + resume), dispatch-whatsapp.ts (WhatsApp send), body-html.ts (text → safe HTML)
    whatsapp/                  # client.ts (Meta Cloud API), consent.ts, suppression.ts, optout.ts, notify-client.ts (to the client: confirmation and first payment), notify.ts (to staff)
    messages/                  # catalog.ts (editable messages), render.ts + compose.ts (legacy/custom/skip), fixed-blocks.ts, safe-doc.ts, schema.ts (saving)
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

**Migrations are applied by hand to the one live database** with `npx -y @insforge/cli@latest db query "<SQL>"`, and the CLI has quirks:

- It does not accept `BEGIN`/`COMMIT`: send the statements as ONE string (several statements in one string run in an implicit transaction). The files in `insforge/migrations/` keep their `BEGIN; … COMMIT;` and their comments, so strip both when applying: `npx -y @insforge/cli@latest db query "$(grep -v '^--' FILE.sql | grep -v -E '^(BEGIN|COMMIT);$')"`.
- A string that starts with a `--` comment is read as an option and nothing is applied ("No rows returned"), which looks like success. Always verify with a query to `information_schema` / `pg_constraint` / `pg_class.relrowsecurity` afterwards.
- PostgREST rejects an `or(...)` filter on an UPDATE (it reads the column as one of the table). Read the ids first, then update by id (`retryFailed` in `dispatch.ts` does).
- Postgres does not replace a function whose argument list changed: `DROP FUNCTION IF EXISTS f(old signature)` before the `CREATE OR REPLACE` (as the `upsert_contact` migrations do).
- Every new internal table gets `ENABLE ROW LEVEL SECURITY` and no policies: the service key bypasses RLS, and without it the anon key can read the table. Several older tables still lack it; see `docs/plans/2026-11-17-whatsapp-findings.md`.

### Booking Flow

1. Client picks service/date/time on `/booking` → Server Action creates a draft booking via `create_draft_booking` RPC
2. Staff confirms from dashboard → `notifyBooking({ event: "confirmed", …, dateIso })` sends email with Google Calendar button
3. Optional Redsys payment → `/api/checkout/booking-session` → Redsys → webhook at `/api/webhooks/redsys` → `handleBookingPaid()` → confirmation email

### Email System

All templates are plain TypeScript functions returning HTML strings (no JSX/React Email). `_base.ts` provides `emailBase()`, `bookingDetailsCard()`, `googleCalendarUrl()`, and `calendarButton()`. `sendEmail()` auto-BCCs the admin email fetched from `profiles` table. Always pass `dateIso` (YYYY-MM-DD) alongside the formatted `date` to templates that include the calendar button.

These templates are the **legacy** emails: what goes out when nobody has edited a message. They are not touched by the editor (see "Editable messages").

### Campaigns (email + WhatsApp)

Admin-only (`/dashboard/campaigns`). Design: `docs/plans/2026-09-05-email-campaigns-design.md` (email) and `docs/plans/2026-11-17-whatsapp-campaigns-and-editable-messages.md` (WhatsApp and editable messages). Everything not marked WhatsApp below is the email channel.

- Tables `campaigns` (jsonb `audience` + `content`, denormalised counters) and `campaign_recipients` (one row per address or phone; email rows are UNIQUE `(campaign_id, email, cycle)`, WhatsApp rows UNIQUE `(campaign_id, phone, cycle)`). Both have RLS with no policies: only the service key reads them.
- Segmentation runs in `app/lib/campaigns/audience.ts` against `contacts` + `bookings`, never in Resend. Fixed exclusions: no email, `contacts.email_bounced_at` set. Manual picks are unioned with the filter.
- `dispatchCampaign()` claims the row atomically (`draft|scheduled → sending`), freezes the audience as `queued` rows, sends in chunks of 100 via `sendEmailBatch` with `tags.campaign_id`, `blindCopy: false` and `List-Unsubscribe` headers, and stamps `provider_id`. A resume sends only `queued` rows, so a timeout never double-sends.
- The Resend webhook (`/api/webhooks/resend`) routes events carrying `tags.campaign_id` to the `record_campaign_event` RPC, which moves a recipient forward only and bumps counters once. Opens/clicks need tracking enabled on the Resend domain and the events subscribed on the webhook.
- Email body is a Maily document (`@maily-to/core` editor in the content step, `@maily-to/render` on the server). `campaignEmail()` wraps the admin's document between our logo and the fixed footer and renders the whole thing with Maily; plain `{{first_name}}` text tokens are filled afterwards (escaped), Maily variable nodes by the renderer. House templates are still written as simple blocks in `app/lib/campaigns/templates.ts` and converted with `blocksToDoc()`.
- **Kinds**: `standard` and `split` (A/B subject, recipients dealt alternately, per-variant opens in the report) are one-off sends. `automated`, `autoresponder`, `rss` and `dateBased` are `active` campaigns: every cron tick `runAutomation()` resolves the segment, asks `automation-rules.ts` who is owed an email today and under which `cycle` (`""` once ever, the year for birthdays, the post id for blog announcements), inserts `queued` rows (unique on `campaign_id, email, cycle`, so repeats are no-ops) and sends them. Triggers: `newsletter_subscribed`, `segment_entry`, `after_booking` (+days), `birthday` (needs `contacts.birthdate`), `first_booking_anniversary`, `new_blog_post` (template vars `{{post_title}}`, `{{post_excerpt}}`, `{{post_url}}`).
- **Appointment notices** (`kind = 'appointment'`, WhatsApp only, `kindAllowedForChannel` refuses it on email): a notice to a client about her OWN booking, set as an automated campaign so the admin can have several (48 h before, 2 h before, 24 h after the visit…), each with its own template and parameters. The trigger is `before_visit` (`hours` 1–336 before a booking STARTS) or `after_visit` (`hours` 1–720 after it ENDS); the schema refuses those events on any other kind, and `manualIds` on this one (its audience is the appointments, nobody is added by hand). The rules (`automation-rules.ts`) count EVERY confirmed booking of the client (`after_visit` also completed ones), with `cycle` = the booking id, so the unique index `(campaign_id, phone, cycle)` makes it one notice per booking and campaign however many runs see it; a campaign limited to some services filters the BOOKINGS, not the client. They are NOT retroactive: a booking is due only from `start − hours` (or `end + hours`) on, and only if that moment is not older than `activated_at`, so switching a campaign on never fires a burst for the bookings already inside its window. Hours are instants (the clock change moves nothing); a booking with no time starts at the day's first moment in the Canaries. The message's `vars` are that booking's `service`, `session_type`, `date` and `time`. It is evaluated by the campaigns cron (every 15 min), so a notice can arrive up to 15 minutes after its moment. Bookings are folded into `Recipient.appointments` (`visits.ts` `foldAppointments`) only when `runAutomation` resolves this kind (`resolveAudience(..., { purpose: 'appointment', appointments: true })`); the audience preview takes the kind as its optional fourth argument for the same reason.
- **Consent by purpose** (`ConsentPurpose`, `consentPurposeOf(kind)`): an appointment notice is TRANSACTIONAL, so its audience and the per-batch recheck in `dispatch-whatsapp.ts` need `whatsapp_opted_in_at` (the booking notices), NOT `whatsapp_marketing_opted_in_at`; every other WhatsApp campaign is the other way round. The opt-out, the unreachable mark, a valid phone and the STOP list (`whatsapp_suppressed_phones`) apply to both. A contact with the wrong consent is `[skipped] no_consent`. Email has no purposes and is unchanged. Bookings the team creates from the dashboard record no consent, so those clients get no appointment notice until it is switched on in their card.
- **Email consent rule**: the newsletter checkbox/toggle (booking form, sign-up, dashboard new contact + new booking) only ever sets `newsletter_subscribed = true`; unticked means "do not touch". `upsert_contact(p_newsletter)` encodes this. An explicit unsubscribe stamps `contacts.newsletter_unsubscribed_at`, and the audience resolver excludes those contacts whatever the campaign's filter says.
- **WhatsApp channel**: `campaigns.channel` is `email | whatsapp` (CHECK). Same engine, same cron tick (`/api/cron/campaigns`, every 15 min). `split` (A/B subject) and `rss` are email-only (`kindAllowedForChannel` in `whatsapp-form.ts`). A WhatsApp send is an approved Meta template plus a mapping of its `{{n}}` parameters (`content.whatsapp`: `templateId` + `params`, each a contact/booking field or a static text).
- **WhatsApp templates**: table `whatsapp_templates` (RLS, no policies), a local copy of the account's Meta templates; Meta owns the status. `syncWhatsAppTemplates` reads `/{WABA_ID}/message_templates` (needs `WHATSAPP_BUSINESS_ACCOUNT_ID`), `createWhatsAppTemplate` submits one, and the webhook's `message_template_status_update` moves `status` (`draft | PENDING | APPROVED | REJECTED | PAUSED | DISABLED`). Only a template with `status = 'APPROVED'` AND `unsupported_reason IS NULL` is sendable. `unsupported_reason` is set at sync for what the dashboard cannot fill: `media_header`, `header_variable`, `named_params`, `button_type` (a URL button with a variable suffix). Its language must be the campaign's send language (`es_ES` serves `es`). Placeholders are `{{1}}…{{50}}`, consecutive, never at the start or end of the body (`app/lib/whatsapp/templates.ts`). A campaign cannot be activated or scheduled with a template that stopped being sendable (`templateGate`).
- **WhatsApp recipient rows**: `email` is NULL, `phone` is E.164 (`toCampaignPhone`: `toE164` plus the CHECK `^\+[0-9]{8,15}$`; a contact whose number does not fit is left out), `language` is always set, and `CHECK (email IS NOT NULL OR phone IS NOT NULL)`. The audience is deduplicated by phone (two contacts with one number would break the unique index) and excludes a contact with `whatsapp_unreachable_at`.
- **WhatsApp sending** (`dispatch-whatsapp.ts`): the audience is frozen as `queued` rows, then each row is CLAIMED with a conditional `UPDATE queued → sending` that stamps `claimed_at`, and written the moment Meta answers, so a killed process never leaves a message sent twice. A row left in `sending` for more than 5 minutes becomes `failed` with `[unconfirmed] interrupted` (it may have gone out). One shared deadline of 50 s per invocation (`deadline.ts`), 10 messages a second, 45 s of sending: at most 450 messages per cron run (`WHATSAPP_MESSAGES_PER_RUN`); what is left stays `queued` and the next tick resumes it. Before EVERY batch the consent and the suppression list are read again: a row whose contact opted out, never consented, is unreachable or is on the list is not sent and ends `failed` with `[skipped]`. A suppression list that cannot be read stops the send with the rows still queued. After 3 whole batches refused by Meta for the same reason it stops: a one-off campaign becomes `failed` and an automation `paused`, with `last_error` starting `[halted]`. `retryFailed` requeues failed rows except `[unconfirmed]` and `[skipped]` ones.
- **WhatsApp events**: the webhook (`/api/webhooks/whatsapp`) hands Meta's states to `record_campaign_event` as Meta names them (the function maps `read` to opened and `failed` to bounced for WhatsApp rows, and a failure's Meta error code is stored in `error`). Code `131026` (no WhatsApp on that number) stamps `contacts.whatsapp_unreachable_at`; `131049`, `131048` and the other rate or spam codes are transient and do not. Any inbound message from a number clears that stamp.
- **WhatsApp consent rule** (three columns on `contacts`, two purposes because the law and Meta separate them): `whatsapp_opted_in_at` = the booking notices (confirmation and reminder of the appointment: transactional); `whatsapp_marketing_opted_in_at` = news and offers (campaigns and automations); `whatsapp_opted_out_at` = ONE global opt-out from a `STOP` or `BAJA` reply (exact word; `CANCELAR` is deliberately not one) that blocks both. The public booking form has TWO checkboxes and no WhatsApp box of its own: (1) the required "I accept the Terms and the Privacy Policy, and that you send me my booking confirmation and reminder by email and WhatsApp" IS the consent for the booking notices; after the details step `recordBookingNoticeConsent` stamps `whatsapp_opted_in_at` (only on a contact written in the last 15 minutes that has no consent and no STOP, and a signed-in client's address comes from her verified session), and it never lifts a STOP, so booking again does not reactivate a BAJA; (2) "news and offers by email and WhatsApp", the only box that is not required (the Terms box carries the red asterisk), is ONE choice that sends `p_newsletter` and `p_whatsapp_marketing` together. Bookings the team creates from the dashboard record NO consent, so without one there is no WhatsApp notice. After a STOP the order is intentional: ticking "news and offers" is an explicit new yes, so `upsert_contact` clears the STOP and withdraws the booking notices (a STOP is global) and `recordBookingNoticeConsent` then stamps them again, so a client who left gets her notices back along with the news she asked for; booking again WITHOUT the tick lifts nothing (pinned in `self-consent.test.ts`). The consent writes run under a 4 s deadline (`writeBookingConsentsWithin`): a hung action lets the booking go on and only costs the WhatsApp notice. Like the newsletter, the boxes only ever turn a use on; unticked means "do not touch" (`null`, never `false`). `upsert_contact(p_whatsapp, p_whatsapp_marketing)` encodes it: ticking a use clears the opt-out; stamps the date only if it was empty, EXCEPT after an opt-out, where it stamps a fresh `now()` and sets the OTHER use to NULL (a consent given before the STOP must not come back to life on somebody's click). `app/lib/whatsapp/consent.ts` does the same in TypeScript; keep the two in step. The form's consent lines live in `messages/*/booking.json` (`detailsStep.consentNoticeSuffix`, `newsletterOptIn`); `consentSuffix` stays plain because the bonus checkout reuses it. "News and offers" is ONE consent for email and WhatsApp everywhere it can be set from the team's side too: the contact page (`/dashboard/contacts/<id>`) has TWO switches that save at once, "Appointment notices" (`setWhatsAppConsent`, `whatsapp_opted_in_at`) and "News and offers" (`setMarketingConsent`: turning it on subscribes the email and consents WhatsApp marketing together, reusing `whatsappActivationPatch` for the STOP rule, and clears the contact's own `newsletter_unsubscribed_at`; turning it off withdraws both and stamps NEITHER `newsletter_unsubscribed_at` nor the global STOP, which only the contact causes, and then updates the Resend list). Its state is `marketingRowState` (`on` only with both channels and no STOP; `email_only` / `whatsapp_only` for older data show the switch off and turning it on completes the other channel; `opted_out` for a STOP). Turning either on asks for confirmation. The old "Newsletter" row of the details form (the one tied to Save) is gone, but the new-contact and new-booking screens keep their own newsletter switch. How to opt out is NOT written under the boxes: it is in the data-protection panel of the form (`detailsStep.optOutValue`: the unsubscribe link of each email, BAJA/STOP on WhatsApp) and in the Privacy Policy.
- **Suppression list** (`whatsapp_suppressed_phones`, migration `20261117l`): a STOP also writes the sender's NUMBER here, whether or not a contact matches it, because the booking form stores any phone typed with the box ticked and so cannot prove whose number it is. Nothing a form, a checkbox or `upsert_contact` does removes a number: only an administrator, from the contact's card. Every reader fails closed: until the migration is applied no WhatsApp message to a client or in a campaign is sent. Email never reads it.

### Editable messages

The transactional emails to a client (`booking_received`, `booking_confirmed`, `booking_paid`, `booking_rescheduled`, `booking_cancelled`, `booking_reminder`, `consent_request`, `bonus_purchase`) can be edited from `/dashboard/messages`. The staff notice, the account lock emails and the contact form are NOT editable. Inventory with every email's current text, callers and parameters: `docs/plans/2026-11-17-message-inventory.md`.

- `message_templates` (RLS, no policies): one row per `(key, channel, locale)`, UNIQUE. `channel` is `email | whatsapp`; the email row holds `subject`, `preheader`, `title` and `doc` (a Maily document); the WhatsApp row holds `whatsapp_template_id` and `whatsapp_params`. The catalogue of keys lives in code (`app/lib/messages/catalog.ts`: variables, fixed blocks, `canDisable`, `whatsappEligible`), not in a CHECK.
- **No saved row means the email that has always gone out, byte for byte.** Every sender asks `renderMessageEmail()` (`app/lib/messages/render.ts`) and gets `{ kind: "legacy" }` (use the `app/emails/templates/*` function exactly as before), `{ kind: "custom", subject, html }` (the admin's version) or `{ kind: "skip" }`. Anything that goes wrong (database unreadable, render throws) is `legacy`, never "send nothing" and never a broken email. A row that carries no text of its own (only the switch, or a body that is not a usable document) is not an edit: legacy.
- `skip` exists only for `booking_reminder` (`canDisable`): for every other key `enabled` is ignored, so a switch can never leave a client who has paid without their email. The reminder cron reads the row once per run and logs one line with the count of reminders it did not send.
- A custom email is composed like the legacy one: same shell (`emailBase()`, or `booking_paid`'s own HTML), the admin's body, then the FIXED BLOCKS the code adds after it (details card, location, payment note, calendar button, cancellation link, consent button, voucher card; `fixed-blocks.ts`, in the legacy order, with the closing sentence of the default body in the legacy position). A body the admin edited replaces the whole default body, closing sentence included. Variables (`{{first_name}}`, `{{service}}`…) are the ones the catalogue lists for that key, are escaped, and an unknown one comes out empty. `{{date}}` and amounts are whatever the caller passes; formats are not unified.
- `app/emails/defaults/` holds the default text of each message and language, used only by the editor and "reset". A guardian test (`defaults.test.ts`) renders every legacy template and compares it, in order, with the defaults and the fixed blocks: change a legacy email and it fails until the default follows. A second test checks every fixed block against the legacy HTML.
- **Safety of the admin's body** (`app/lib/messages/safe-doc.ts`, pure): saving rejects (`findForbiddenNodes`) and sending removes (`sanitizeDoc`) anything outside an ALLOW-LIST of node and mark types (the renderer dispatches any `type` that is a method of its class: `{"type":"render"}` never returns), the raw-HTML block, `doc` anywhere but the root, links that are not `https`/`http`/`mailto` (and images that are not `https`/`http`), and style attributes that are not a number or one of the editor's words. A link that is a variable is resolved and checked at send time. The editor (`components/dashboard/maily-editor.tsx`) does not offer the raw-HTML block, but the server is the real defence.
- `app/lib/messages/schema.ts` validates a save and is server-side: never import it from a client component. Saving goes through `saveMessageTemplate` (admin only), which refuses unknown variables, forbidden nodes and a WhatsApp template that cannot be sent.

### WhatsApp to the client

Two instant notices to a client about her own booking: the confirmation (`booking_confirmed` after a staff confirmation, `booking_paid` after the FIRST online payment). The reminder and any other timed notice are NOT here: they are appointment campaigns (see Email Campaigns, kind `appointment`), and `booking_reminder` is no longer a message that can go out on WhatsApp (`whatsappEligible: false`), so a client never gets two reminders. They go on the Meta template the admin chose in `/dashboard/messages`: a `message_templates` row with `channel = 'whatsapp'` for that key and language (`whatsapp_template_id` + `whatsapp_params`, resolved with the same field/static sources as campaigns). Code: `app/lib/whatsapp/notify-client.ts` (events), decision in `client-decision.ts`. Rules:

- They are TRANSACTIONAL, so the gate is `whatsapp_opted_in_at` (never the marketing consent), no `whatsapp_opted_out_at`, no `whatsapp_unreachable_at`, a number the database would accept, and the number NOT on `whatsapp_suppressed_phones` (a list that cannot be read means nothing is sent). Only keys with `whatsappEligible` in the catalogue qualify (the two above). The consent line of the booking form promises "the confirmation and the reminder of my appointment", which is what the appointment campaigns use as well.
- With no saved WhatsApp row, or no consent, nothing is read further and nothing is written (a history row per booking without consent would bury the real ones). A template that cannot be sent (not approved, wrong language, parameters that do not add up, a URL button with a variable) leaves ONE `skipped` entry in the booking's history with the reason: that is a misconfiguration the admin must see.
- Sent and failed notices are recorded in the booking's history (`booking_events`, channel `whatsapp`) and the webhook advances them `sent → delivered → read`. Nothing here ever throws into the booking or payment flow, and every caller awaits it LAST.
- `bookings.whatsapp_reminder_sent_at` (from the retired fixed WhatsApp reminder) is OBSOLETE and unused; it stays in the database, no DDL.
- The language is the caller's when it states one, else the contact's `preferred_language` (its column default is `en`), else Spanish. So a WhatsApp row and an approved template are needed for EACH language that clients have.

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
- `WHATSAPP_ACCESS_TOKEN` + `WHATSAPP_PHONE_NUMBER_ID` — send WhatsApp messages; without them everything runs dry (nothing is sent, nothing breaks)
- `WHATSAPP_BUSINESS_ACCOUNT_ID` — list and create templates (`/{WABA_ID}/message_templates`)
- `WHATSAPP_APP_SECRET` + `WHATSAPP_VERIFY_TOKEN` — sign and verify Meta's callbacks at `/api/webhooks/whatsapp`; without the secret the route rejects everything
- `WHATSAPP_TEMPLATE_NAME` (default `essentia_booking_update`) — the staff notice's template
