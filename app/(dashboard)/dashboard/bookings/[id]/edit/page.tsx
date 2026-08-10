"use client";

import { useState, useEffect, useRef, useReducer, useMemo } from "react";
import { useMonthFreeBusy, useDayFreeBusy } from "@/hooks/use-free-busy";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { notifySuccess } from "@/lib/feedback";
import { insforge } from "@/lib/insforge";
import { getAccessToken, authFetch } from "@/lib/client-session";
import { fetchBookableServices } from "@/services/bookable-services.client";
import { notifyBooking } from "@/actions/booking-notifications";
import { deleteBooking, updateBookingByAdmin } from "@/actions/booking-draft";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { contact } from "@/constants/contact";

import {
  isAvailableDay,
  getCalendarDays,
  getTimeSlotsForDashboard,
} from "@/utils/calendar-helpers";
import { notifyStaffWhatsApp } from "@/actions/staff-whatsapp";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import { StaffSelect } from "@/components/ui/staff-select";
import { localDateStr } from "@/utils/format";
import { syncBookingToCalendars } from "@/actions/calendar-propagate";
import { DeleteDialog } from "./delete-dialog";
import {
  ClientSection,
  DateTimeSection,
  LocationSection,
  ServiceSection,
  StatusSection,
  TierSection,
} from "./form-sections";
import {
  asyncInitial,
  asyncReducer,
  formInitial,
  formReducer,
  resolvePrice,
  type Tier,
} from "./form-state";
import {
  EMPTY_ADDRESS,
  useLocationOptions,
  type DashboardLocation,
} from "../../_shared/location";

// ─── Helpers ──────────────────────────────────────────────────

function canPartnerEdit(date: string | null, time: string | null): boolean {
  if (!date || !time) return true;
  const [h, m] = time.split(":").map(Number) as [number, number];
  const [y, mo, d] = date.split("-").map(Number) as [number, number, number];
  const appt = new Date(y, mo - 1, d, h, m);
  return appt.getTime() - Date.now() > (23 * 60 + 59) * 60 * 1000;
}

// ─── Status Select ────────────────────────────────────────────
// ─── Page ─────────────────────────────────────────────────────

export default function EditBookingPage() {
  const tValidation = useTranslations("dashboard.validation");
  const tToasts = useTranslations("dashboard.toasts");
  const t = useTranslations("dashboard.bookings.edit");
  const tForm = useTranslations("dashboard.bookings.form");
  const tCommonLabels = useTranslations("dashboard.common");
  const locationOptions = useLocationOptions();
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const { role } = useRole();

  useEffect(() => {
    if (role && role !== "admin" && role !== "staff" && role !== "partner") {
      push(`/dashboard/bookings/${id}`);
    }
  }, [role, id, push]);

  const [async_, dispatchAsync] = useReducer(asyncReducer, asyncInitial);
  const [form, dispatchForm] = useReducer(formReducer, formInitial);
  const [deleteState, setDeleteState] = useState({
    open: false,
    pending: false,
  });
  const { open: deleteOpen, pending: deleting } = deleteState;

  const [origBookingDate, setOrigBookingDate] = useState<string | null>(null);
  const [origBookingTime, setOrigBookingTime] = useState<string>("");

  const pendingTierId = useRef<string>("");
  const originalRef = useRef<{
    status: string;
    date: string | null;
    time: string;
    serviceId: string;
    staffId: string;
    googleEventId: string | null;
  } | null>(null);

  const {
    submitting,
    error,
    services,
    servicesLoading,
    tiers,
    tiersLoading,
    bookingLoading,
  } = async_;
  const {
    serviceId,
    tierId,
    location,
    roomNumber,
    reservationNumber,
    notes,
    address,
    selectedDate,
    selectedTime,
    calendarView,
    firstName,
    lastName,
    email,
    phone,
    status,
    staffId,
  } = form;

  const fullNameForCrumb =
    [firstName, lastName].filter(Boolean).join(" ") || null;
  useDynamicBreadcrumb(!bookingLoading ? fullNameForCrumb : null);

  useEffect(() => {
    if (bookingLoading || !role || role !== "partner") return;
    if (!canPartnerEdit(origBookingDate, origBookingTime)) {
      push(`/dashboard/bookings/${id}`);
    }
  }, [bookingLoading, role, origBookingDate, origBookingTime, id, push]);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;

  // ── Calendar month view state (lifted to enable month-level freeBusy) ────
  const [calView, setCalView] = useState(() => {
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  });
  const { year: viewYear, month: viewMonth } = calView;

  const prevCalMonth = () => {
    setCalView((prev) =>
      prev.month === 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: prev.month - 1 },
    );
  };
  const nextCalMonth = () => {
    setCalView((prev) =>
      prev.month === 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: prev.month + 1 },
    );
  };

  // Month-level freeBusy: blocks fully-booked days in the calendar.
  const { busy: monthBusy, loading: loadingMonth } = useMonthFreeBusy(
    serviceId,
    viewYear,
    viewMonth,
  );

  const fullyBlockedDates = useMemo(() => {
    const blocked = new Set<string>();
    if (monthBusy.length === 0) return blocked;
    const days = getCalendarDays(viewYear, viewMonth);
    for (const day of days) {
      if (!day || !isAvailableDay(day)) continue;
      const slots = getTimeSlotsForDashboard(
        day,
        selectedService?.category,
        selectedTier?.duration_minutes ?? 60,
        monthBusy,
      );
      if (slots.length > 0 && slots.every((s) => s.booked)) {
        blocked.add(localDateStr(day));
      }
    }
    return blocked;
  }, [monthBusy, viewYear, viewMonth, selectedService, selectedTier]);

  // ── freeBusy for time-slot availability ───────────────────────
  const { busy: busyIntervals, loading: loadingSlots } = useDayFreeBusy(
    serviceId,
    selectedDate,
  );

  const timeSlots = selectedDate
    ? getTimeSlotsForDashboard(
        selectedDate,
        selectedService?.category,
        selectedTier?.duration_minutes ?? 60,
        busyIntervals,
      )
    : [];

  const allowedLocations =
    role === "partner"
      ? locationOptions.filter(
          (l) => l.id === "centro" || l.id === "habitacion",
        )
      : locationOptions;

  const sortedServices = services.toSorted((a, b) => {
    if (a.id === "manual-therapies") return -1;
    if (b.id === "manual-therapies") return 1;
    return a.title.localeCompare(b.title);
  });

  // The same list the public booking flow offers.
  useEffect(() => {
    async function load() {
      dispatchAsync({
        type: "SERVICES_LOADED",
        payload: await fetchBookableServices(),
      });
    }
    void load();
  }, []);

  // Load booking
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "service_id, tier_id, staff_id, duration, location, location_address, notes, date, time, first_name, last_name, email, phone, status, google_event_id",
        )
        .eq("id", id)
        .limit(1);

      const b = (
        data as Array<{
          service_id: string | null;
          tier_id: string | null;
          staff_id: string | null;
          duration: string | null;
          location: string | null;
          location_address: string | null;
          notes: string | null;
          date: string | null;
          time: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          status: string | null;
          google_event_id: string | null;
        }> | null
      )?.[0];

      if (cancelled) return;

      if (!b) {
        dispatchAsync({ type: "BOOKING_LOADED" });
        return;
      }

      // Parse location address
      let parsedRoomNumber = "";
      let parsedReservationNumber = "";
      let parsedAddress = EMPTY_ADDRESS;
      if (b.location_address) {
        try {
          const parsed = JSON.parse(b.location_address) as Record<
            string,
            string
          >;
          if (b.location === "habitacion" || b.location === "centro") {
            parsedRoomNumber = parsed.roomNumber ?? "";
            parsedReservationNumber = parsed.reservationNumber ?? "";
          } else if (b.location === "domicilio") {
            parsedAddress = {
              street: parsed.street ?? "",
              building: parsed.building ?? "",
              postalCode: parsed.postalCode ?? "",
              municipality: parsed.municipality ?? "",
            };
          }
        } catch {
          /* ignore */
        }
      }

      // Parse date
      let parsedDate: Date | null = null;
      let parsedCalendarView: "date" | "time" = "date";
      if (b.date) {
        const [y, m, d] = b.date.split("-").map(Number) as [
          number,
          number,
          number,
        ];
        parsedDate = new Date(y, m - 1, d);
        parsedCalendarView = "time";
      }

      pendingTierId.current = b.tier_id ?? "";
      originalRef.current = {
        status: b.status ?? "pending",
        date: b.date ?? null,
        time: b.time ?? "",
        serviceId: b.service_id ?? "",
        staffId: b.staff_id ?? "",
        googleEventId: b.google_event_id ?? null,
      };
      setOrigBookingDate(b.date ?? null);
      setOrigBookingTime(b.time ?? "");

      // Bookings taken before the staff column carry the old free-text
      // prefix; strip it so it does not show up twice.
      const parsedNotes = (b.notes ?? "").replace(
        /^Terapeuta: (?:Masculino|Femenina)(?:\n\n)?/,
        "",
      );

      dispatchForm({
        type: "LOAD_BOOKING",
        payload: {
          serviceId: b.service_id ?? "",
          location: (b.location as DashboardLocation) ?? "",
          roomNumber: parsedRoomNumber,
          reservationNumber: parsedReservationNumber,
          notes: parsedNotes,
          address: parsedAddress,
          selectedDate: parsedDate,
          selectedTime: b.time ?? "",
          calendarView: parsedCalendarView,
          firstName: b.first_name ?? "",
          lastName: b.last_name ?? "",
          email: b.email ?? "",
          phone: b.phone ?? "",
          status: b.status ?? "pending",
          staffId: b.staff_id ?? "",
        },
      });
      dispatchAsync({ type: "BOOKING_LOADED" });
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Who can perform the chosen session type.
  const [tierStaff, setTierStaff] = useState<TierStaff[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (
      tierId ? fetchTierStaff(tierId) : Promise.resolve([] as TierStaff[])
    ).then((people) => {
      if (!cancelled) setTierStaff(people);
    });
    return () => {
      cancelled = true;
    };
  }, [tierId]);

  // Load tiers when service changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        dispatchAsync({ type: "TIERS_LOADED", payload: [] });
        return;
      }
      dispatchAsync({ type: "TIERS_LOADING" });
      const { data } = await insforge.database
        .from("service_tiers")
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, image_url, color",
        )
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");

      if (cancelled) return;

      const rows = (data as Tier[] | null) ?? [];
      dispatchAsync({ type: "TIERS_LOADED", payload: rows });

      if (pendingTierId.current) {
        const match = rows.find((r) => r.id === pendingTierId.current);
        if (match) dispatchForm({ type: "SET_TIER", id: match.id });
        pendingTierId.current = "";
      } else if (rows.length === 1 && rows[0]) {
        dispatchForm({ type: "SET_TIER", id: rows[0].id });
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatchAsync({ type: "SET_ERROR", payload: null });

    if (!serviceId) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("serviceRequired"),
      });
      return;
    }
    if (!firstName.trim()) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("firstNameRequired"),
      });
      return;
    }
    if (!email.trim()) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("emailRequired"),
      });
      return;
    }
    // Same check the create screen and the public form apply.
    if (!z.email().safeParse(email.trim()).success) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("emailInvalid"),
      });
      return;
    }
    if (
      (location === "habitacion" || location === "centro") &&
      !reservationNumber.trim()
    ) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: t("errors.reservationRequired"),
      });
      return;
    }
    if (!selectedDate) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("dateRequired"),
      });
      return;
    }
    if (!selectedTime) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: tValidation("timeRequired"),
      });
      return;
    }

    let locationAddress: string | null = null;
    if (location === "habitacion" || location === "centro")
      locationAddress = JSON.stringify({ roomNumber, reservationNumber });
    else if (location === "domicilio")
      locationAddress = JSON.stringify(address);

    const durationText =
      selectedTier?.duration_minutes != null
        ? `${selectedTier.duration_minutes} min`
        : null;
    const dateStr = selectedDate
      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
      : null;

    dispatchAsync({ type: "SUBMIT_START" });

    const { error: updateErrorMsg } = await updateBookingByAdmin(
      getAccessToken(),
      id,
      {
        service_id: serviceId,
        service_title: selectedService?.title ?? serviceId,
        tier_id: tierId || null,
        price_eur: selectedTier ? resolvePrice(selectedTier, location) : null,
        duration: durationText,
        date: dateStr,
        time: selectedTime || null,
        location: location || null,
        location_address: locationAddress,
        staff_id: staffId || null,
        notes: notes.trim() || null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        status,
      },
    );

    dispatchAsync({ type: "SUBMIT_END" });

    if (updateErrorMsg) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: updateErrorMsg ?? t("errors.saveFailed"),
      });
      return;
    }

    // Send email notifications based on what changed (non-blocking)
    const orig = originalRef.current;
    if (orig && email) {
      const clientName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");
      const service = selectedService?.title ?? serviceId;
      const dur =
        selectedTier?.duration_minutes != null
          ? `${selectedTier.duration_minutes} min`
          : null;

      const statusChanged = status !== orig.status;
      const dateTimeChanged =
        (dateStr ?? null) !== orig.date || (selectedTime || "") !== orig.time;

      const sessionType = selectedTier?.label ?? null;

      try {
        if (statusChanged && status === "confirmed") {
          await notifyBooking(getAccessToken(), {
            bookingId: id,
            event: "confirmed",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            sessionType,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        } else if (statusChanged && status === "cancelled") {
          await notifyBooking(getAccessToken(), {
            bookingId: id,
            event: "cancelled",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            sessionType,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        } else if (!statusChanged && dateTimeChanged) {
          await notifyBooking(getAccessToken(), {
            bookingId: id,
            event: "rescheduled",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            sessionType,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        }
      } catch {
        // Notification failed silently — booking is already saved
      }

      // Delete Google Calendar event when booking is cancelled
      if (statusChanged && status === "cancelled" && orig.googleEventId) {
        try {
          await authFetch("/api/google/calendar/event", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId || orig.serviceId,
              event_id: orig.googleEventId,
            }),
          });
        } catch {
          // fail-open: calendar deletion failure must not block navigation
        }
      }
    }

    // WhatsApp to the professional. Outside the block above because that one
    // also requires a client email, and a booking taken over the phone without
    // one still has someone who has to turn up for it.
    if (orig) {
      const statusChanged = status !== orig.status;
      const dateTimeChanged =
        (dateStr ?? null) !== orig.date || (selectedTime || "") !== orig.time;
      const staffChanged = (staffId || "") !== (orig.staffId || "");

      if (statusChanged && status === "cancelled") {
        // Whoever was holding the slot, whether or not it changed hands in the
        // same save.
        const holder = staffId || orig.staffId;
        if (holder) {
          await notifyStaffWhatsApp(getAccessToken(), {
            bookingId: id,
            staffId: holder,
            event: "cancelled",
          });
        }
      } else if (staffChanged) {
        // Reassignment wins over a simultaneous time change: the message the
        // new person gets already carries the new time, so a second
        // `rescheduled` would only say the same thing twice.
        if (orig.staffId) {
          await notifyStaffWhatsApp(getAccessToken(), {
            bookingId: id,
            staffId: orig.staffId,
            event: "unassigned",
          });
        }
        if (staffId) {
          await notifyStaffWhatsApp(getAccessToken(), {
            bookingId: id,
            staffId,
            event: "assigned",
          });
        }
      } else if (dateTimeChanged && staffId) {
        await notifyStaffWhatsApp(getAccessToken(), {
          bookingId: id,
          staffId,
          event: "rescheduled",
        });
      }

      // Every calendar that holds this booking, not just the service's. A move
      // used to be corrected on one and left wrong on the professional's phone
      // and on the administrator's mirror.
      await syncBookingToCalendars(
        getAccessToken(),
        id,
        status === "cancelled" ? "removed" : "updated",
      );

      // Update original ref so re-saves don't re-send
      originalRef.current = {
        status,
        date: dateStr ?? null,
        time: selectedTime,
        serviceId,
        staffId,
        googleEventId: originalRef.current?.googleEventId ?? null,
      };
    }

    // Create Google Calendar event when booking is confirmed/paid and has date+time
    const isConfirmedStatus = status === "confirmed" || status === "paid";
    if (isConfirmedStatus && dateStr && selectedTime) {
      const clientName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");

      const calLocation = (() => {
        if (location === "centro") return contact.address;
        if (location === "habitacion") {
          const parts: string[] = [];
          if (reservationNumber.trim())
            parts.push(`Reservation: ${reservationNumber.trim()}`);
          if (roomNumber.trim()) parts.push(`Room: ${roomNumber.trim()}`);
          return parts.length
            ? `Baobab Suites — ${parts.join(" · ")}`
            : "Baobab Suites";
        }
        if (location === "domicilio") {
          const parts: string[] = [];
          if (address.street.trim()) parts.push(address.street.trim());
          if (address.building.trim()) parts.push(address.building.trim());
          if (address.postalCode.trim() || address.municipality.trim())
            parts.push(
              [address.postalCode.trim(), address.municipality.trim()]
                .filter(Boolean)
                .join(" "),
            );
          return parts.filter(Boolean).join(", ");
        }
        return "";
      })();

      const descLines = [
        `Booking #${id}`,
        phone.trim() ? `Phone: ${phone.trim()}` : null,
        email.trim() ? `Email: ${email.trim()}` : null,
        notes.trim() ? `Notes: ${notes.trim()}` : null,
      ].filter(Boolean);

      const tierParts: string[] = [];
      if (selectedTier?.label) tierParts.push(selectedTier.label);
      if (selectedTier?.duration_minutes != null)
        tierParts.push(`${selectedTier.duration_minutes} min`);
      const tierInfo = tierParts.join(" · ");
      const serviceName = selectedService?.title ?? serviceId;
      const calSummary = tierInfo
        ? `${serviceName} · ${tierInfo} — ${clientName}`
        : `${serviceName} — ${clientName}`;

      const existingEventId = originalRef.current?.googleEventId ?? null;

      try {
        if (existingEventId) {
          // Update existing calendar event instead of creating a duplicate
          await authFetch("/api/google/calendar/event", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId,
              event_id: existingEventId,
              summary: calSummary,
              description: descLines.join("\n"),
              location: calLocation || undefined,
              colorId: "7",
              date: dateStr,
              time: selectedTime,
              duration_minutes: selectedTier?.duration_minutes ?? 60,
            }),
          });
        } else {
          // No existing event — create one
          const calRes = await authFetch("/api/google/calendar/event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              service_id: serviceId,
              summary: calSummary,
              description: descLines.join("\n"),
              location: calLocation || undefined,
              colorId: "7",
              date: dateStr,
              time: selectedTime,
              duration_minutes: selectedTier?.duration_minutes ?? 60,
            }),
          });
          if (calRes.ok) {
            const calData = (await calRes.json()) as { eventId?: string };
            if (calData.eventId) {
              void insforge.database
                .from("bookings")
                .update({ google_event_id: calData.eventId })
                .eq("id", id);
            }
          }
        }
      } catch {
        // fail-open: calendar error must not block navigation
      }
    }

    notifySuccess(tToasts("bookingSaved"));
    push(`/dashboard/bookings/${id}`);
  }

  async function handleDelete() {
    setDeleteState((prev) => ({ ...prev, pending: true }));
    await deleteBooking(getAccessToken(), id);
    notifySuccess(tToasts("bookingDeleted"));
    push("/dashboard/bookings");
  }

  const loading = bookingLoading || servicesLoading;

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {t("title")}
          </h1>
          {/* Desktop buttons */}
          <div className="hidden items-center gap-3 sm:flex">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() =>
                setDeleteState((prev) => ({ ...prev, open: true }))
              }
              disabled={loading}
            >
              {t("delete")}
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || loading}
            >
              {submitting ? t("saving") : t("save")}
            </Button>
          </div>
        </div>

        {/* Desktop error */}
        {error && (
          <p className="mb-6 hidden rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600 sm:block">
            {error}
          </p>
        )}

        <div className="space-y-3">
          {/* ── 1. Status ── */}
          <StatusSection
            status={status}
            onChange={(s) =>
              dispatchForm({ type: "SET_FIELD", field: "status", value: s })
            }
          />

          {/* ── 2. Service ── */}
          <ServiceSection
            loading={loading}
            services={sortedServices}
            selectedService={selectedService}
            onSelect={(s) => dispatchForm({ type: "SET_SERVICE", id: s.id })}
          />

          {/* ── 3. Location ── */}
          <LocationSection
            location={location}
            allowedLocations={allowedLocations}
            onLocationChange={(l) =>
              dispatchForm({ type: "SET_LOCATION", value: l })
            }
            roomNumber={roomNumber}
            reservationNumber={reservationNumber}
            address={address}
            submitting={submitting}
            onRoomNumberChange={(value) =>
              dispatchForm({ type: "SET_ROOM_NUMBER", value })
            }
            onReservationNumberChange={(value) =>
              dispatchForm({ type: "SET_RESERVATION_NUMBER", value })
            }
            onAddressChange={(value) =>
              dispatchForm({ type: "SET_ADDRESS", value })
            }
          />

          {/* ── 4. Session type ── */}
          <TierSection
            serviceId={serviceId}
            tiersLoading={tiersLoading}
            tiers={tiers}
            tierId={tierId}
            location={location}
            onSelect={(id) => dispatchForm({ type: "SET_TIER", id })}
          />

          {/* ── 4b. Who performs it, among those assigned to the tier ── */}
          {tierId !== "" && tierStaff.length > 0 && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                {tForm("steps.staff")}
              </h2>
              <StaffSelect
                options={tierStaff}
                selected={staffId || null}
                onSelect={(person) =>
                  dispatchForm({ type: "SET_STAFF", value: person.id })
                }
                labels={{
                  fieldLabel: tForm("steps.staff"),
                  placeholder: tForm("staff.placeholder"),
                  modalTitle: tForm("steps.staff"),
                  close: tCommonLabels("cancel"),
                }}
              />
            </div>
          )}

          {/* ── 5. Date & Time ── */}
          <DateTimeSection
            calendarView={calendarView}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            viewYear={viewYear}
            viewMonth={viewMonth}
            onPrevMonth={prevCalMonth}
            onNextMonth={nextCalMonth}
            fullyBlockedDates={fullyBlockedDates}
            loadingMonth={loadingMonth}
            loadingSlots={loadingSlots}
            timeSlots={timeSlots}
            onSelectDate={(d) => dispatchForm({ type: "SET_DATE", value: d })}
            onSelectTime={(time) =>
              dispatchForm({ type: "SET_TIME", value: time })
            }
            onChangeView={(view) =>
              dispatchForm({ type: "SET_CALENDAR_VIEW", value: view })
            }
          />

          {/* ── 6. Client ── */}
          <ClientSection
            firstName={firstName}
            lastName={lastName}
            email={email}
            phone={phone}
            notes={notes}
            submitting={submitting}
            onFieldChange={(field, value) =>
              dispatchForm({ type: "SET_FIELD", field, value })
            }
            onNotesChange={(value) =>
              dispatchForm({ type: "SET_NOTES", value })
            }
          />
        </div>

        {/* Mobile bottom bar */}
        <div className="mt-6 sm:hidden">
          {error && (
            <p className="mb-3 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || loading}
              className="w-full justify-center"
            >
              {submitting ? t("saving") : t("save")}
            </Button>
          </div>
        </div>
      </form>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteState((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
}
