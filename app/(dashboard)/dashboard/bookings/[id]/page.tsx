"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import Link from "next/link";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { deleteBooking } from "@/actions/booking-draft";
import { Button } from "@/components/ui/button";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useRole } from "@/context/role-context";

// ─── Types ────────────────────────────────────────────────────

type BookingDetail = {
  id: string;
  service_title: string | null;
  duration: string | null;
  price_eur: number | null;
  tier_id: string | null;
  service_tiers: {
    label: string | null;
    image_url: string | null;
    color: string | null;
  } | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  date: string | null;
  time: string | null;
  status: string | null;
  location: string | null;
  location_address: string | null;
  notes: string | null;
  created_at: string | null;
  created_by_role: string | null;
  created_by_user_id: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────

function canPartnerEdit(date: string | null, time: string | null): boolean {
  if (!date || !time) return true;
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const appt = new Date(y, mo - 1, d, h, m);
  return appt.getTime() - Date.now() > (23 * 60 + 59) * 60 * 1000;
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatCreated(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
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

/** Falls back to the website badge for a role we have no styling for. */
function sourceKey(role: string | null): string {
  return role && sourceBadge[role] ? role : "anonymous";
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

// ─── Delete dialog ────────────────────────────────────────────

function DeleteDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("dashboard.bookings.detail");
  const tCommon = useTranslations("dashboard.common");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("deleteDialog.title")}
          </h3>
          <p className="text-petroleum-400 text-sm">{t("deleteDialog.body")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? t("deleteDialog.deleting") : t("deleteDialog.confirm")}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            {tCommon("cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── State ────────────────────────────────────────────────────

type CreatorProfile = {
  full_name: string | null;
  email: string | null;
  role: string | null;
};

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "loaded"; booking: BookingDetail; creator: CreatorProfile | null };

// ─── Page ─────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.bookings.detail");
  const tStatus = useTranslations("dashboard.bookings.status");
  const tLocations = useTranslations("dashboard.bookings.locations");
  const tSources = useTranslations("dashboard.bookings.sources");
  const locale = useLocale();
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const { role } = useRole();
  const isPartner = role === "partner";

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fullNameForCrumb =
    state.kind === "loaded"
      ? [state.booking.first_name, state.booking.last_name]
          .filter(Boolean)
          .join(" ") || null
      : null;
  useDynamicBreadcrumb(fullNameForCrumb);

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "id, service_title, duration, price_eur, tier_id, service_tiers(label, image_url, color), first_name, last_name, email, phone, date, time, status, location, location_address, notes, created_at, created_by_role, created_by_user_id",
        )
        .eq("id", id)
        .limit(1);

      const booking = (data as BookingDetail[] | null)?.[0];
      if (!booking) {
        setState({ kind: "not_found" });
        return;
      }

      let creator: CreatorProfile | null = null;
      if (
        booking.created_by_user_id &&
        booking.created_by_role !== "client" &&
        booking.created_by_role !== "anonymous"
      ) {
        const { data: pData } = await insforge.database
          .from("profiles")
          .select("full_name, email, role")
          .eq("id", booking.created_by_user_id)
          .limit(1);
        creator = (pData as CreatorProfile[] | null)?.[0] ?? null;
      }

      setState({ kind: "loaded", booking, creator });
    }
    void load();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    await deleteBooking(getAccessToken(), id);
    notifySuccess(tToasts("bookingDeleted"));
    push("/dashboard/bookings");
  }

  if (state.kind === "loading") {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="bg-sand-100 h-9 w-48 animate-pulse rounded-xl" />
          <div className="flex gap-3">
            <div className="bg-sand-100 h-10 w-20 animate-pulse rounded-xl" />
            <div className="bg-sand-100 h-10 w-20 animate-pulse rounded-xl" />
          </div>
        </div>
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="border-sand-200 rounded-2xl border bg-white p-6"
            >
              <div className="bg-sand-100 mb-4 h-4 w-24 animate-pulse rounded" />
              <div className="space-y-3">
                <div className="bg-sand-100 h-4 w-full animate-pulse rounded" />
                <div className="bg-sand-100 h-4 w-2/3 animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (state.kind === "not_found") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-petroleum-400 text-sm">{t("notFound")}</p>
        <Link
          href="/dashboard/bookings"
          className="text-petroleum-400 hover:text-petroleum-700 mt-4 text-xs underline"
        >
          {t("backToList")}
        </Link>
      </div>
    );
  }

  const { booking, creator } = state;
  const tier = booking.service_tiers;
  const addrParsed = parseLocationAddress(booking.location_address);
  const therapistLabel = (() => {
    const n = booking.notes ?? "";
    if (n.startsWith("Terapeuta: Masculino")) return t("therapist.male");
    if (n.startsWith("Terapeuta: Femenina")) return t("therapist.female");
    return null;
  })();
  const fullName =
    [booking.first_name, booking.last_name].filter(Boolean).join(" ") || "—";

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-petroleum-700 text-2xl">{fullName}</h1>
        <div className="flex shrink-0 items-center gap-3">
          {!isPartner && (
            <Button
              variant="outline-danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
            >
              {t("delete")}
            </Button>
          )}
          {(!isPartner || canPartnerEdit(booking.date, booking.time)) && (
            <Button
              variant="solid"
              size="md"
              href={`/dashboard/bookings/${id}/edit`}
            >
              {t("edit")}
            </Button>
          )}
        </div>
      </div>

      {/* Meta strip */}
      <div className="border-sand-200 mb-6 grid grid-cols-2 rounded-2xl border bg-white sm:grid-cols-4">
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
          {(() => {
            const source = sourceKey(booking.created_by_role);
            return (
              <span
                className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceBadge[source]!.cls}`}
              >
                {tSources(source)}
              </span>
            );
          })()}
        </div>
      </div>

      <div className="space-y-6">
        {/* Service */}
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

        {/* Location */}
        {booking.location && (
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
                  <Field label="Street & number">
                    {addrParsed.street ?? "—"}
                  </Field>
                  {addrParsed.building && (
                    <Field label="Block, floor & door">
                      {addrParsed.building}
                    </Field>
                  )}
                  <Field label="Postal code">
                    {addrParsed.postalCode ?? "—"}
                  </Field>
                  <Field label="Municipality">
                    {addrParsed.municipality ?? "—"}
                  </Field>
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
        )}

        {/* Date & time */}
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

        {/* Client */}
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
            {t("sections.client")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.name")}>{fullName}</Field>
            <Field label={t("fields.phone")}>{booking.phone ?? "—"}</Field>
            <Field label={t("fields.email")}>{booking.email ?? "—"}</Field>
          </div>
        </div>

        {/* Notes */}
        {(() => {
          const rawNotes = booking.notes ?? "";
          const displayNotes = rawNotes
            .replace(/^Terapeuta: Masculino\s*/, "")
            .replace(/^Terapeuta: Femenina\s*/, "")
            .trim();
          return displayNotes ? (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {t("sections.notes")}
              </h2>
              <p className="text-petroleum-700 text-sm leading-relaxed whitespace-pre-line">
                {displayNotes}
              </p>
            </div>
          ) : null;
        })()}

        {/* Reserved by */}
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
              {(() => {
                const source = sourceKey(booking.created_by_role);
                return (
                  <span
                    className={`mt-1 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceBadge[source]!.cls}`}
                  >
                    {tSources(source)}
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
