"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";
import {
  TIME_ZONE,
  formatBookingDate,
  type SupportedLocale,
} from "@/utils/format";
import type { WhatsAppMessageRow } from "@/lib/whatsapp/types";
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
 * service, who performs it, what was sent to them, where, when, for whom, what
 * they wrote, and who booked it. Each reads the fields it needs and nothing
 * else, so changing the address block cannot disturb the payment badge.
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
 * How far a notification got, at a glance.
 *
 * `sent` deliberately looks the same as `skipped`: Meta accepting a message
 * says nothing about a handset receiving it, and dressing it as a success is
 * what once hid a fortnight of notifications that never arrived.
 */
const WHATSAPP_STATUS_STYLES: Record<WhatsAppMessageRow["status"], string> = {
  read: "bg-petroleum-700 text-sand-100",
  delivered: "bg-petroleum-100 text-petroleum-700",
  failed: "bg-red-100 text-red-700",
  sent: "bg-sand-200 text-petroleum-500",
  skipped: "bg-sand-200 text-petroleum-500",
};

/** What was sent to the professional, and whether it arrived. */
export function WhatsAppCard({
  messages,
  locale,
}: {
  messages: WhatsAppMessageRow[];
  locale: SupportedLocale;
}) {
  const t = useTranslations("dashboard.bookings.detail");

  const stamp = (iso: string) =>
    new Date(iso).toLocaleString(locale === "es" ? "es-ES" : "en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TIME_ZONE,
    });

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
        {t("sections.whatsapp")}
      </h2>

      {/* Until the centre has a number, every row is a dry run — say so
      rather than let staff read "not sent" as a failure. */}
      {messages.some((m) => m.status === "skipped") && (
        <p className="text-petroleum-400 mb-4 text-xs">
          {t("whatsapp.dryRunNotice")}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {messages.map((message) => (
          <li
            key={message.id}
            className="border-sand-200 flex flex-col gap-1 border-b pb-4 last:border-0 last:pb-0"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-petroleum-700 text-sm font-medium">
                {t(`whatsapp.events.${message.event}`)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  WHATSAPP_STATUS_STYLES[message.status]
                }`}
              >
                {t(`whatsapp.statuses.${message.status}`)}
              </span>
              <span className="text-petroleum-400 text-xs">
                {message.recipientName
                  ? `${message.recipientName} · ${message.toPhone}`
                  : message.toPhone}{" "}
                · {stamp(message.createdAt)}
              </span>
            </div>
            <p className="text-petroleum-500 text-sm">{message.bodyPreview}</p>
            {/* The two moments Meta reports back. Absent on a message that is
            still only accepted, which is the whole point of showing them. */}
            {(message.deliveredAt || message.readAt) && (
              <p className="text-petroleum-400 text-xs">
                {[
                  message.deliveredAt &&
                    `${t("whatsapp.deliveredAt")} ${stamp(message.deliveredAt)}`,
                  message.readAt &&
                    `${t("whatsapp.readAt")} ${stamp(message.readAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            {message.error && (
              <p className="text-xs text-red-700">{message.error}</p>
            )}
          </li>
        ))}
      </ul>
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
