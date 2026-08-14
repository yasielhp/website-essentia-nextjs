"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import Link from "next/link";
import { insforge } from "@/lib/insforge";
import { getAccessToken } from "@/lib/client-session";
import { deleteBooking } from "@/actions/booking-draft";
import { fetchBookingWhatsAppMessages } from "@/actions/staff-whatsapp";
import type { WhatsAppMessageRow } from "@/lib/whatsapp/types";
import { Button } from "@/components/ui/button";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useRole } from "@/context/role-context";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { BookingDetailBody } from "./booking-detail-body";
import type {
  BookingDetail,
  ClientContact,
  CreatorProfile,
  StaffPerson,
} from "./types";

// ─── Types ────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────

function canPartnerEdit(date: string | null, time: string | null): boolean {
  if (!date || !time) return true;
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const appt = new Date(y, mo - 1, d, h, m);
  return appt.getTime() - Date.now() > (23 * 60 + 59) * 60 * 1000;
}

/** Falls back to the website badge for a role we have no styling for. */

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

type PageState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | {
      kind: "loaded";
      booking: BookingDetail;
      creator: CreatorProfile | null;
      /** Null for a booking taken from someone who was never filed as a contact. */
      contact: ClientContact | null;
    };

// ─── Page ─────────────────────────────────────────────────────

export default function BookingDetailPage() {
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.bookings.detail");
  const locale = useDashboardLocale();
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const { role } = useRole();
  const isPartner = role === "partner";

  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [staffPerson, setStaffPerson] = useState<StaffPerson | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [whatsappMessages, setWhatsappMessages] = useState<
    WhatsAppMessageRow[]
  >([]);

  const fullNameForCrumb =
    state.kind === "loaded"
      ? [state.booking.first_name, state.booking.last_name]
          .filter(Boolean)
          .join(" ") || null
      : null;
  useDynamicBreadcrumb(fullNameForCrumb);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "id, service_title, duration, price_eur, tier_id, staff_id, payment_status, service_tiers(label, image_url, color), first_name, last_name, email, phone, date, time, status, location, location_address, notes, created_at, created_by_role, created_by_user_id, contact_id",
        )
        .eq("id", id)
        .limit(1);

      if (cancelled) return;

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
        if (cancelled) return;
        creator = (pData as CreatorProfile[] | null)?.[0] ?? null;
      }

      if (booking.staff_id) {
        const { data: sData } = await insforge.database
          .from("profiles")
          .select("full_name, first_name, job_title, avatar_url")
          .eq("id", booking.staff_id)
          .limit(1);
        const person = (
          sData as
            | {
                full_name: string | null;
                first_name: string | null;
                job_title: string | null;
                avatar_url: string | null;
              }[]
            | null
        )?.[0];
        if (cancelled) return;
        if (person) {
          setStaffPerson({
            name: person.full_name ?? person.first_name ?? "—",
            jobTitle: person.job_title,
            avatarUrl: person.avatar_url,
          });
        }
      }

      // The client's own record. A booking keeps its own copy of the name and
      // the phone, so this is only read for what the copy does not carry.
      let contact: ClientContact | null = null;
      if (booking.contact_id) {
        const { data: cData } = await insforge.database
          .from("contacts")
          .select(
            "id, created_at, preferred_language, gender, newsletter_subscribed",
          )
          .eq("id", booking.contact_id)
          .limit(1);
        if (cancelled) return;
        contact = (cData as ClientContact[] | null)?.[0] ?? null;
      }

      setState({ kind: "loaded", booking, creator, contact });
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Read through a Server Action, not the browser client: the table holds
  // staff phone numbers.
  useEffect(() => {
    let cancelled = false;
    void fetchBookingWhatsAppMessages(getAccessToken(), id).then((rows) => {
      if (!cancelled) setWhatsappMessages(rows);
    });
    return () => {
      cancelled = true;
    };
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

  const { booking, creator, contact } = state;
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

      <BookingDetailBody
        booking={booking}
        creator={creator}
        contact={contact}
        whatsappMessages={whatsappMessages}
        staffPerson={staffPerson}
        locale={locale}
      />

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
