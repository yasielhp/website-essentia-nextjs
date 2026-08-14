"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";
import {
  TIME_ZONE,
  formatBookingDate,
  type SupportedLocale,
} from "@/utils/format";
import type {
  BookingEventActorRole,
  BookingEventChannel,
  BookingEventName,
  BookingEventRow,
  BookingEventStatus,
} from "@/lib/booking-events/types";
import type {
  BookingDetail,
  ClientContact,
  CreatorProfile,
  StaffPerson,
} from "./types";

/**
 * The cards a booking is made of.
 *
 * One component per question the screen answers — what state it is in, which
 * service, who performs it, where, when, for whom, what they wrote, who booked
 * it, and everything that has happened to it since. Each reads the fields it
 * needs and nothing else, so changing the address block cannot disturb the
 * payment badge.
 */

const paymentBadgeClasses: Record<string, string> = {
  paid: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  failed: "bg-red-100 text-red-600",
  refunded: "bg-sand-100 text-petroleum-500",
};

const statusDotClasses: Record<string, string> = {
  pending: "bg-yellow-400",
  confirmed: "bg-green-500",
  cancelled: "bg-red-400",
};

const sourceBadge: Record<string, { cls: string }> = {
  admin: { cls: "bg-petroleum-100 text-petroleum-700" },
  staff: { cls: "bg-blue-100 text-blue-700" },
  partner: { cls: "bg-yellow-100 text-yellow-700" },
  client: { cls: "bg-green-50 text-green-700" },
  anonymous: { cls: "bg-sand-100 text-petroleum-500" },
};

function sourceKey(role: string | null): string {
  return role && sourceBadge[role] ? role : "anonymous";
}

function formatDate(dateStr: string | null, locale: SupportedLocale): string {
  if (!dateStr) return "—";
  return formatBookingDate(dateStr, locale);
}

function formatCreated(iso: string | null, locale: SupportedLocale): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
  });
}

function parseLocationAddress(
  raw: string | null,
): Record<string, string> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

// ─── Detail row ───────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-petroleum-400 text-xs">{label}</p>
      <div className="text-petroleum-700 text-sm">{children}</div>
    </div>
  );
}

/** The five facts worth knowing before reading anything else. */
export function MetaStrip({
  booking,
  locale,
}: {
  booking: BookingDetail;
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.bookings.detail");
  const tStatus = useTranslations("dashboard.bookings.status");
  const tPayment = useTranslations("dashboard.bookings.paymentStatus");
  const tLocations = useTranslations("dashboard.bookings.locations");
  const tSources = useTranslations("dashboard.bookings.sources");
  const source = sourceKey(booking.created_by_role);

  return (
    <div className="border-sand-200 mb-6 grid grid-cols-2 rounded-2xl border bg-white sm:grid-cols-5">
      <div className="flex flex-col gap-1.5 px-5 py-4">
        <p className="text-petroleum-400 text-xs">{t("meta.status")}</p>
        <div className="flex items-center gap-1.5">
          <span
            className={`size-2 shrink-0 rounded-full ${statusDotClasses[booking.status ?? ""] ?? "bg-petroleum-400"}`}
          />
          <span className="text-petroleum-700 text-sm font-medium capitalize">
            {booking.status && tStatus.has(booking.status)
              ? tStatus(booking.status)
              : (booking.status ?? "—")}
          </span>
        </div>
      </div>
      {/* Whether the money is in, which the status alone does not say. */}
      <div className="border-sand-200 flex flex-col gap-1.5 border-l px-5 py-4">
        <p className="text-petroleum-400 text-xs">{t("meta.payment")}</p>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            paymentBadgeClasses[booking.payment_status ?? ""] ??
            "bg-sand-100 text-petroleum-500"
          }`}
        >
          {booking.payment_status && tPayment.has(booking.payment_status)
            ? tPayment(booking.payment_status)
            : (booking.payment_status ?? "—")}
        </span>
      </div>
      <div className="border-sand-200 flex flex-col gap-1.5 border-l px-5 py-4">
        <p className="text-petroleum-400 text-xs">{t("meta.location")}</p>
        <p className="text-petroleum-700 text-sm">
          {booking.location && tLocations.has(booking.location)
            ? tLocations(booking.location)
            : "—"}
        </p>
      </div>
      <div className="border-sand-200 flex flex-col gap-1.5 border-t px-5 py-4 sm:border-t-0 sm:border-l">
        <p className="text-petroleum-400 text-xs">{t("meta.created")}</p>
        <p className="text-petroleum-700 text-sm">
          {formatCreated(booking.created_at, locale)}
        </p>
      </div>
      <div className="border-sand-200 flex flex-col gap-1.5 border-t border-l px-5 py-4 sm:border-t-0">
        <p className="text-petroleum-400 text-xs">{t("meta.reservedBy")}</p>
        <span
          className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceBadge[source]!.cls}`}
        >
          {tSources(source)}
        </span>
      </div>
    </div>
  );
}

/**
 * What was booked.
 *
 * `staffPerson` only to decide whether the legacy therapist preference is worth
 * repeating: bookings taken before `staff_id` existed carry it as a free-text
 * prefix in the notes, and once somebody is actually assigned it says nothing.
 */
export function ServiceCard({
  booking,
  staffPerson,
}: {
  booking: BookingDetail;
  staffPerson: StaffPerson | null;
}) {
  const t = useTranslations("dashboard.bookings.detail");
  const tier = booking.service_tiers;
  const therapistLabel = (() => {
    if (staffPerson) return null;
    const n = booking.notes ?? "";
    if (n.startsWith("Terapeuta: Masculino")) return t("therapist.male");
    if (n.startsWith("Terapeuta: Femenina")) return t("therapist.female");
    return null;
  })();

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.service")}
      </h2>
      <div className="flex items-center gap-4">
        {/* The session type carries the picture; a booking with no tier
        still gets the service initial rather than an empty square. */}
        <div className="hidden sm:block">
          {tier?.image_url || tier?.color ? (
            <TierThumbnail
              imageUrl={tier.image_url}
              color={tier.color}
              label={tier.label}
              className="size-14"
              sizes="56px"
            />
          ) : (
            <div className="bg-petroleum-100 flex size-14 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-700 text-xl font-bold">
                {booking.service_title?.[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-petroleum-700 font-medium">
            {booking.service_title ?? "—"}
          </p>
          {(tier?.label ||
            booking.duration ||
            booking.price_eur != null ||
            therapistLabel) && (
            <p className="text-petroleum-400 text-sm">
              {[
                tier?.label,
                booking.duration,
                booking.price_eur != null ? `€${booking.price_eur}` : null,
                therapistLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Who performs it. */
export function StaffCard({ staffPerson }: { staffPerson: StaffPerson }) {
  const t = useTranslations("dashboard.bookings.detail");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.staff")}
      </h2>
      <div className="flex items-center gap-3">
        {staffPerson.avatarUrl ? (
          <Image
            src={staffPerson.avatarUrl}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="bg-sand-200 text-petroleum-500 flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
            {staffPerson.name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex flex-col">
          <p className="text-petroleum-700 font-medium">{staffPerson.name}</p>
          {staffPerson.jobTitle && (
            <p className="text-petroleum-400 text-xs">{staffPerson.jobTitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * How far an entry got, at a glance.
 *
 * `sent` deliberately looks the same as `skipped`: Meta accepting a message
 * says nothing about a handset receiving it, and dressing it as a success is
 * what once hid a fortnight of notifications that never arrived. `done` is here
 * only to keep the map total — an edit or a sync carries it, and the badge is
 * not drawn for those at all.
 */
const EVENT_STATUS_STYLES: Record<BookingEventStatus, string> = {
  read: "bg-petroleum-700 text-sand-100",
  delivered: "bg-petroleum-100 text-petroleum-700",
  failed: "bg-red-100 text-red-700",
  sent: "bg-sand-200 text-petroleum-500",
  skipped: "bg-sand-200 text-petroleum-500",
  done: "bg-sand-200 text-petroleum-500",
};

/**
 * The two channels that went out to somebody, as opposed to merely happening.
 *
 * They are the only ones with a recipient to name, and the only ones whose
 * status is worth watching past `sent`.
 */
const MESSAGE_CHANNELS: readonly BookingEventChannel[] = ["whatsapp", "email"];

function isMessage(channel: BookingEventChannel): boolean {
  return MESSAGE_CHANNELS.includes(channel);
}

/**
 * The colour a channel owns on the rail.
 *
 * The dot used to carry the status, which meant a row of identical sand dots
 * for everything that merely happened. The status already has a badge of its
 * own; what the eye cannot find without help is which entries were messages and
 * which were somebody at the desk. Red overrides all five: a failure is worth
 * more than knowing which channel failed.
 */
const CHANNEL_DOT: Record<BookingEventChannel, string> = {
  whatsapp: "bg-green-500",
  email: "bg-blue-500",
  system: "bg-petroleum-700",
  payment: "bg-amber-500",
  calendar: "bg-sand-500",
};

/** How many entries are worth showing before the trail is folded. */
const VISIBLE_GROUPS = 5;

/**
 * One notification and everyone it reached, as a single entry.
 *
 * Every notification writes one row per recipient — the professional and each
 * admin — all with the same wording and the same second. Listed one by one they
 * doubled the length of the trail and read as two different things happening,
 * when what happened was one thing told to two people.
 */
type HistoryGroup = {
  key: string;
  channel: BookingEventChannel;
  event: BookingEventName;
  summary: string;
  createdAt: string;
  entries: BookingEventRow[];
  actorName: string | null;
  actorRole: BookingEventActorRole | null;
  /** Shared by every recipient, or null when they came back different. */
  status: BookingEventStatus | null;
  error: string | null;
};

/**
 * Collapses the rows of one notification into one entry.
 *
 * Only messages are grouped. Two edits landing in the same second are two
 * things a person did, and merging them would hide one of them.
 */
function groupEvents(events: BookingEventRow[]): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  const byKey = new Map<string, HistoryGroup>();

  for (const event of events) {
    const key = isMessage(event.channel)
      ? `${event.channel}|${event.event}|${event.createdAt}`
      : event.id;

    const existing = byKey.get(key);
    if (existing) {
      existing.entries.push(event);
      if (existing.status !== event.status) existing.status = null;
      existing.error ??= event.error;
      continue;
    }

    const group: HistoryGroup = {
      key,
      channel: event.channel,
      event: event.event,
      summary: event.summary,
      createdAt: event.createdAt,
      entries: [event],
      actorName: event.actorName,
      actorRole: event.actorRole,
      status: event.status,
      error: event.error,
    };
    byKey.set(key, group);
    groups.push(group);
  }

  return groups;
}

/**
 * Everything that has happened to this booking, newest first.
 *
 * Read as a trail rather than a list of cards: the WhatsApp sent to the
 * professional, the email to the client, the hour somebody moved, the payment
 * that came back, the calendar it was written to. One vocabulary across all
 * five, so `cancelled` is the same word whichever of them recorded it.
 *
 * It sits last on the page on purpose. Nobody opens a booking to read its
 * history; they open it for the service, the time and the client, and come down
 * here only when someone asks why something changed or says they were never
 * told.
 */
export function HistoryCard({
  events,
  locale,
}: {
  events: BookingEventRow[];
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.bookings.detail");
  const [expanded, setExpanded] = useState(false);

  /**
   * The moment the card was opened, read once and then held.
   *
   * "hace 12 min" is the one thing here that depends on when it is asked, and a
   * clock read straight from the render body would make this component draw
   * differently on every pass. Frozen at mount it stays honest for as long as
   * anybody looks at a screen they did not leave open for an hour, and it costs
   * no timer to keep.
   */
  const [now] = useState(() => Date.now());

  const intlLocale = locale === "es" ? "es-ES" : "en-GB";

  const clock = (iso: string) =>
    new Date(iso).toLocaleTimeString(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIME_ZONE,
    });

  /**
   * "hace 12 min" while it is still fresh, the clock once it is not.
   *
   * A relative time answers the question actually being asked of a recent
   * entry — did this just happen? — and stops being useful the moment the
   * answer is "yesterday", which is what the day headings are for.
   */
  const when = (iso: string) => {
    const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
    if (minutes < 1) return t("history.justNow");
    if (minutes >= 60 * 12) return clock(iso);

    const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });
    return minutes < 60
      ? rtf.format(-minutes, "minute")
      : rtf.format(-Math.round(minutes / 60), "hour");
  };

  /** `Hoy`, `Ayer`, or the date written out. */
  const dayLabel = (iso: string) => {
    const day = (value: Date) =>
      value.toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
    const today = new Date();
    const yesterday = new Date(today.getTime() - 86_400_000);
    const stamp = day(new Date(iso));

    if (stamp === day(today)) return t("history.today");
    if (stamp === day(yesterday)) return t("history.yesterday");
    return new Date(iso).toLocaleDateString(intlLocale, {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: TIME_ZONE,
    });
  };

  /**
   * What a status is called on the channel that produced it.
   *
   * The same word means different things depending on who reported it. Meta
   * accepting a message is not a delivery, and an email "read" is a tracking
   * pixel being fetched — which Apple Mail does for everybody, read or not — so
   * it is called an opening and not a reading.
   */
  const statusLabel = (
    channel: BookingEventChannel,
    status: BookingEventStatus,
  ) => {
    if (status === "sent" && channel === "whatsapp") {
      return t("history.statuses.acceptedByMeta");
    }
    if (status === "read" && channel === "email") {
      return t("history.statuses.opened");
    }
    return t(`history.statuses.${status}`);
  };

  const groups = groupEvents(events);
  // Sliced before the days are worked out, so a fold never leaves a heading
  // standing over nothing.
  const shown = expanded ? groups : groups.slice(0, VISIBLE_GROUPS);

  const days: { label: string; groups: HistoryGroup[] }[] = [];
  for (const group of shown) {
    const label = dayLabel(group.createdAt);
    const current = days.at(-1);
    if (current?.label === label) current.groups.push(group);
    else days.push({ label, groups: [group] });
  }

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.history")}
      </h2>

      {/* Until the centre has a number, every WhatsApp row is a dry run — say
      so rather than let staff read "not sent" as a failure. */}
      {events.some(
        (e) => e.channel === "whatsapp" && e.status === "skipped",
      ) && (
        <p className="text-petroleum-400 mb-4 text-xs">
          {t("history.dryRunNotice")}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col gap-3">
            <p className="text-petroleum-400 text-xs font-medium tracking-wide uppercase">
              {day.label}
            </p>

            {/* The rail is drawn on the list, not on each entry, so it stops at
            the last dot instead of trailing off the bottom of the card. */}
            <ul className="border-sand-200 flex flex-col gap-5 border-l pl-5">
              {day.groups.map((group) => {
                const messageLike = isMessage(group.channel);
                const failed = group.entries.some((e) => e.status === "failed");

                // The badge on the title only speaks for an entry with one
                // recipient. A notification that went to two people carries a
                // line each below, and a single badge over them would claim
                // for both what may only be true of one.
                const single =
                  messageLike && group.entries.length === 1
                    ? group.entries[0]
                    : null;

                // Who the line is about: the person a message went to, or the
                // person who caused everything else. A webhook or a nightly
                // sync has no name at all, and then the role carries the line.
                const meta = (
                  messageLike
                    ? [single?.recipientName, single?.recipient]
                    : [
                        group.actorName,
                        group.actorRole
                          ? t(`history.roles.${group.actorRole}`)
                          : null,
                      ]
                ).filter((part): part is string => Boolean(part));

                meta.push(when(group.createdAt));

                // The two moments Meta reports back, and only while one message
                // is being talked about: two recipients read at two times, and
                // the pair of stamps would belong to neither.
                if (single?.deliveredAt) {
                  meta.push(
                    `${t("history.deliveredAt")} ${clock(single.deliveredAt)}`,
                  );
                }
                if (single?.readAt) {
                  meta.push(`${t("history.readAt")} ${clock(single.readAt)}`);
                }

                return (
                  <li key={group.key} className="relative flex flex-col gap-1">
                    {/* The dot sits on the rail: half its width to the left of
                    the padding, so it reads as a point on the line rather than
                    beside it. */}
                    <span
                      className={`absolute top-1.5 -left-[26px] size-2.5 rounded-full ring-4 ring-white ${
                        failed ? "bg-red-400" : CHANNEL_DOT[group.channel]
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-petroleum-700 text-sm font-medium">
                        {t(`history.events.${group.event}`)}
                      </span>
                      {/* The channel is plain text, not a second pill: two
                      badges on one line read as two states of the same thing. */}
                      <span className="text-petroleum-400 text-xs tracking-wide uppercase">
                        {t(`history.channels.${group.channel}`)}
                      </span>
                      {single && single.status !== "done" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            EVENT_STATUS_STYLES[single.status]
                          }`}
                        >
                          {statusLabel(group.channel, single.status)}
                        </span>
                      )}
                    </div>
                    {/* The template paragraph is not shown at all: it is the
                    same words every time, and what anyone reading this wants to
                    know is who it reached, which is right below. Everything
                    else says something different each time and says it here. */}
                    {!messageLike && (
                      <p className="text-petroleum-700 text-sm">
                        {group.summary}
                      </p>
                    )}
                    <p className="text-petroleum-400 text-xs">
                      {meta.join(" · ")}
                    </p>
                    {/* One line per recipient, so "did the admin get it too?"
                    is answered by looking rather than by counting phones. */}
                    {messageLike && !single && (
                      <ul className="mt-0.5 flex flex-col gap-0.5">
                        {group.entries.map((entry) => (
                          <li
                            key={entry.id}
                            className="text-petroleum-400 flex flex-wrap items-center gap-1.5 text-xs"
                          >
                            <span className="text-petroleum-500">
                              {entry.recipientName ?? entry.recipient ?? "—"}
                            </span>
                            {entry.recipientName && entry.recipient && (
                              <span>{entry.recipient}</span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                EVENT_STATUS_STYLES[entry.status]
                              }`}
                            >
                              {statusLabel(group.channel, entry.status)}
                            </span>
                            {entry.readAt && (
                              <span>
                                {t("history.readAt")} {clock(entry.readAt)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {group.error && (
                      <p className="text-xs text-red-700">{group.error}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {groups.length > VISIBLE_GROUPS && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="text-petroleum-500 hover:text-petroleum-700 mt-4 w-full text-center text-xs underline"
        >
          {expanded
            ? t("history.showLess")
            : t("history.showAll", { count: groups.length })}
        </button>
      )}
    </div>
  );
}

/**
 * Where it happens.
 *
 * A hotel room needs a reservation and a room number; a home visit needs a
 * street address; the centre needs neither, though an older booking may carry
 * room details it was taken with.
 */
export function LocationCard({ booking }: { booking: BookingDetail }) {
  const t = useTranslations("dashboard.bookings.detail");
  const addrParsed = parseLocationAddress(booking.location_address);

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.location")}
      </h2>
      <div className="flex flex-col gap-3">
        {booking.location === "habitacion" && addrParsed && (
          <div className="grid grid-cols-2 gap-4">
            <Field label={t("fields.reservationNumber")}>
              {addrParsed.reservationNumber || "—"}
            </Field>
            <Field label={t("fields.roomNumber")}>
              {addrParsed.roomNumber ?? "—"}
            </Field>
          </div>
        )}

        {booking.location === "domicilio" && addrParsed && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Street & number">{addrParsed.street ?? "—"}</Field>
            {addrParsed.building && (
              <Field label="Block, floor & door">{addrParsed.building}</Field>
            )}
            <Field label="Postal code">{addrParsed.postalCode ?? "—"}</Field>
            <Field label="Municipality">{addrParsed.municipality ?? "—"}</Field>
          </div>
        )}

        {booking.location === "centro" && (
          <>
            {addrParsed &&
              (addrParsed.reservationNumber || addrParsed.roomNumber) && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label={t("fields.reservationNumber")}>
                    {addrParsed.reservationNumber || "—"}
                  </Field>
                  <Field label={t("fields.roomNumber")}>
                    {addrParsed.roomNumber || "—"}
                  </Field>
                </div>
              )}
            <p className="text-petroleum-400 text-sm">
              Baobab Suites, Costa Adeje, Tenerife
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/** When it happens. */
export function DateTimeCard({
  booking,
  locale,
}: {
  booking: BookingDetail;
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.bookings.detail");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.datetime")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.date")}>
          {formatDate(booking.date, locale)}
        </Field>
        <Field label={t("fields.time")}>{booking.time ?? "—"}</Field>
      </div>
    </div>
  );
}

/**
 * Who it is for.
 *
 * The first three fields are the booking's own copy, taken the day it was made.
 * The rest come from the client's record in `contacts` and are absent for
 * someone who was never filed as one — an anonymous booking, or a draft that
 * failed its `upsert_contact`. The card shows what it has rather than a column
 * of dashes.
 */
export function ClientCard({
  booking,
  contact,
  locale,
}: {
  booking: BookingDetail;
  contact: ClientContact | null;
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.bookings.detail");
  const tCommon = useTranslations("dashboard.common");
  const tGender = useTranslations("dashboard.gender");
  const tNewsletter = useTranslations("dashboard.contacts.detail.newsletter");

  const fullName =
    [booking.first_name, booking.last_name].filter(Boolean).join(" ") || "—";
  const stay = parseLocationAddress(booking.location_address);
  const gender = contact?.gender;

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.client")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("fields.name")}>{fullName}</Field>
        <Field label={t("fields.phone")}>{booking.phone ?? "—"}</Field>
        <Field label={t("fields.email")}>{booking.email ?? "—"}</Field>

        {contact && (
          <>
            {/* Which language this person is written to in. Worth seeing beside
            their email, since that is what the next message obeys. */}
            <Field label={t("fields.preferredLanguage")}>
              {contact.preferred_language === "es"
                ? tCommon("spanish")
                : tCommon("english")}
            </Field>
            <Field label={t("fields.gender")}>
              {gender && tGender.has(gender) ? tGender(gender) : "—"}
            </Field>
            <Field label={t("fields.clientSince")}>
              {formatCreated(contact.created_at, locale)}
            </Field>
            <Field label={t("fields.newsletter")}>
              {contact.newsletter_subscribed
                ? tNewsletter("subscribed")
                : tNewsletter("notSubscribed")}
            </Field>
          </>
        )}

        {/* The hotel reservation number stays out of here: it belongs to the
        stay, not to the person, and the Location card above already carries
        it. */}
        {stay?.roomNumber && (
          <Field label={t("fields.roomNumber")}>{stay.roomNumber}</Field>
        )}
      </div>

      {/* The whole history — every booking, every payment — is one screen away
      and does not belong on this one. */}
      {contact && (
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          className="text-petroleum-500 hover:text-petroleum-700 mt-4 inline-block text-sm underline"
        >
          {t("viewContact")}
        </Link>
      )}
    </div>
  );
}

/** What they wrote, minus the legacy therapist prefix the service card shows. */
export function NotesCard({ notes }: { notes: string }) {
  const t = useTranslations("dashboard.bookings.detail");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.notes")}
      </h2>
      <p className="text-petroleum-700 text-sm leading-relaxed whitespace-pre-line">
        {notes}
      </p>
    </div>
  );
}

/** Who booked it. */
export function ReservedByCard({
  booking,
  creator,
}: {
  booking: BookingDetail;
  creator: CreatorProfile | null;
}) {
  const t = useTranslations("dashboard.bookings.detail");

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.reservedBy")}
      </h2>
      <div className="flex items-start gap-4">
        <div className="bg-petroleum-100 hidden size-10 shrink-0 items-center justify-center rounded-full sm:flex">
          <span className="text-petroleum-700 text-sm font-bold">
            {(creator?.full_name ??
              booking.created_by_role ??
              "?")[0]?.toUpperCase()}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-petroleum-700 font-medium">
            {creator?.full_name ??
              (booking.created_by_role === "anonymous"
                ? t("creator.anonymous")
                : t("creator.client"))}
          </p>
          {creator?.email && (
            <p className="text-petroleum-400 text-sm">{creator.email}</p>
          )}
          {/* No role badge here: the same badge already sits at the top of the
          page, in the card that answers where the booking came from. Twice on
          one screen read as two different facts. */}
        </div>
      </div>
    </div>
  );
}
