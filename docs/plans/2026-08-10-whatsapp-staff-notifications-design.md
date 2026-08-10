# WhatsApp notifications for staff

Date: 2026-08-10
Branch: `feat/whatsapp-staff-notifications`

## Problem

Staff learn about their sessions from email and the dashboard. Neither reaches
someone between clients. When a booking is assigned, reassigned, moved or
cancelled, the person who has to be in the room should get a message on the
phone they already carry.

The centre does not have a WhatsApp Business number yet. The feature therefore
has to be complete and inert until the number exists, and go live by filling in
environment variables — not by shipping more code.

## Scope

Four events, all addressed to the member of staff, never to the client:

| Event         | When                                                              |
| ------------- | ----------------------------------------------------------------- |
| `assigned`    | booking created with staff, or staff set on an unassigned booking |
| `unassigned`  | staff replaced — the previous person is told to drop it           |
| `rescheduled` | date or time changed on an assigned booking                       |
| `cancelled`   | booking cancelled from the dashboard or by the client             |

Out of scope: messages to clients, inbound WhatsApp, reminders. The existing
client emails and the `staff-new-booking` email stay exactly as they are —
WhatsApp is added alongside them, not in place of them.

## Provider

Meta WhatsApp Cloud API, direct. Service conversations are free up to 1000 per
month, which is well above what one clinic produces, and there is no reseller in
the path.

Writing to someone outside a 24-hour window requires an approved template, so
all four events go through **one** parameterised template:

    Hola {{1}}, {{2}}. Cliente: {{3}}. Servicio: {{4}}. Cuándo: {{5}}.

- `{{1}}` staff first name
- `{{2}}` the event sentence (`se te ha asignado una sesión`, …)
- `{{3}}` client name
- `{{4}}` service, with session type when there is one
- `{{5}}` formatted date and time

Plus a dynamic URL button pointing at `/dashboard/bookings/{id}`.

One template means one approval from Meta and one round of review if the wording
changes, instead of four.

## Data

`profiles.phone` already exists and is already editable in Dashboard > Users >
[id]. It is the number used — no new column, no new form field. It is normalised
to E.164 at send time: whitespace and punctuation stripped, `+34` prepended when
there is no `+`. No phone on the profile means no message and no row.

One new table records every message, sent or not:

```sql
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid REFERENCES bookings(id) ON DELETE SET NULL,
  staff_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event        text NOT NULL,
  to_phone     text NOT NULL,
  language     text NOT NULL DEFAULT 'es',
  params       jsonb NOT NULL,
  body_preview text NOT NULL,
  status       text NOT NULL,   -- skipped | sent | failed
  error        text,
  provider_id  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
```

`body_preview` is what makes the pre-production phase useful: with no
credentials the row is written with `status = 'skipped'` and the dashboard shows
the text that would have gone out, so the wording can be signed off before Meta
is involved.

## Environment

| Variable                   | Purpose                               |
| -------------------------- | ------------------------------------- |
| `WHATSAPP_ACCESS_TOKEN`    | permanent token of the Meta app       |
| `WHATSAPP_PHONE_NUMBER_ID` | id of the sending number              |
| `WHATSAPP_TEMPLATE_NAME`   | defaults to `essentia_booking_update` |
| `WHATSAPP_API_VERSION`     | defaults to `v21.0`                   |

Missing either of the first two puts the whole feature in dry-run: rows are
written, no HTTP call is made.

## Code

- `app/lib/whatsapp/types.ts` — shared types. Deliberately not re-exported from
  the action: type re-exports out of `app/actions/` compile but crash at
  runtime.
- `app/lib/whatsapp/client.ts` — `sendTemplate()`, the only place that talks to
  Meta. Returns `sent | skipped | failed`, never throws, 10s timeout.
- `app/lib/whatsapp/messages.ts` — builds the five parameters and the preview.
  The four event sentences live here in `es` and `en` rather than in
  `messages/*.json`, because they must match the approved template character for
  character. They are not website copy.
- `app/lib/format-date.ts` — the long-date formatter, extracted from
  `booking-notifications.ts` where it was already duplicated in
  `booking-cancellation.ts`.
- `app/lib/whatsapp/notify.ts` — `notifyStaffOnWhatsApp(input)`, the whole body
  of the feature. Server-only and deliberately **not** a Server Action: every
  export of a `"use server"` module is a public HTTP endpoint, and this one has
  no role check. The anonymous flows (`booking-draft.ts`,
  `booking-cancellation.ts`) already run on the server and import it directly.
- `app/actions/staff-whatsapp.ts` — the browser-facing door:
  - `notifyStaffWhatsApp(accessToken, input)` — guarded by `requireRole`, for
    the dashboard pages, which are Client Components.
  - `fetchBookingWhatsAppMessages(accessToken, bookingId)` — same guard, reads
    the log through the service key because the table holds phone numbers.

Neither trusts the caller for the recipient. Phone, name and language are read
from `profiles` by `staff_id`; client, service, date and time are read from
`bookings` by `bookingId` — the same reasoning as `getBookingRecipient` in
`booking-notifications.ts`. Accepting a caller-supplied number would turn the
centre's WhatsApp into an open relay.

Every call site wraps the call so a WhatsApp failure never breaks a booking.

## Call sites

| File                                                    | Event(s)    |
| ------------------------------------------------------- | ----------- |
| `app/actions/booking-draft.ts`                          | `assigned`  |
| `app/(dashboard)/dashboard/bookings/new/page.tsx`       | `assigned`  |
| `app/(dashboard)/dashboard/bookings/[id]/edit/page.tsx` | all four    |
| `app/actions/booking-cancellation.ts`                   | `cancelled` |

Rules in the editor, next to the `statusChanged` / `dateTimeChanged` branches
that already decide which email goes out:

1. Staff changed → `unassigned` to the previous person, `assigned` to the new
   one. This wins over a simultaneous time change: the new person gets one
   `assigned` message that already carries the new time, not two messages.
2. Time changed, same staff → `rescheduled`.
3. Status became `cancelled` → `cancelled`, and nothing else.

## Dashboard

The booking detail page grows a "WhatsApp notifications" block listing the rows
for that booking: time, recipient, event, status, and the Meta error when one
failed. In dry-run it shows the text that would have been sent. No rows, no
block.

## Validation

The repo has no automated tests, so:

1. `bun run build`, then `bun run format && bun run lint`, all clean.
2. Manually in dev with no credentials: create an assigned booking, reassign it,
   move it, cancel it — four `skipped` rows with correct text.

## Going live

1. Register the number in WhatsApp Manager; verify the Business.
2. Submit `essentia_booking_update` in `es` and `en`, category `UTILITY`, with
   the dynamic URL button.
3. Fill each professional's `phone` in E.164 in Dashboard > Users.
4. Set the four variables in Vercel and redeploy.
5. Test booking; confirm a `sent` row with its `wamid`.
