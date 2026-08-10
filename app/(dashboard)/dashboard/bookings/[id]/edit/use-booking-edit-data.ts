"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import { insforge } from "@/lib/insforge";
import { fetchBookableServices } from "@/services/bookable-services.client";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import { EMPTY_ADDRESS } from "../../_shared/location-options";
import type { DashboardLocation } from "../../_shared/location-options";
import type { AsyncAction, FormAction, Tier } from "./form-state";
import type { BookingSnapshot } from "./save-booking";

/**
 * Everything this screen has to fetch before it can be edited.
 *
 * Four requests that depend on each other in one direction: the booking names a
 * service, the service has session types, a session type has people who can
 * perform it. Together they were a hundred and ninety lines of effects in the
 * middle of the screen; none of them are about drawing it.
 */

type BookingRow = {
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
};

/** The stored address, whose shape depends on where the session happens. */
function parseAddress(row: BookingRow) {
  let roomNumber = "";
  let reservationNumber = "";
  let address = EMPTY_ADDRESS;
  if (!row.location_address) return { roomNumber, reservationNumber, address };

  try {
    const parsed = JSON.parse(row.location_address) as Record<string, string>;
    if (row.location === "habitacion" || row.location === "centro") {
      roomNumber = parsed.roomNumber ?? "";
      reservationNumber = parsed.reservationNumber ?? "";
    } else if (row.location === "domicilio") {
      address = {
        street: parsed.street ?? "",
        building: parsed.building ?? "",
        postalCode: parsed.postalCode ?? "",
        municipality: parsed.municipality ?? "",
      };
    }
  } catch {
    /* ignore */
  }

  return { roomNumber, reservationNumber, address };
}

export function useBookingEditData({
  id,
  serviceId,
  tierId,
  dispatchAsync,
  dispatchForm,
}: {
  id: string;
  /** The service currently chosen, whose session types are loaded. */
  serviceId: string;
  /** The session type currently chosen, whose staff are loaded. */
  tierId: string;
  dispatchAsync: Dispatch<AsyncAction>;
  dispatchForm: Dispatch<FormAction>;
}) {
  /** The booking as stored, for deciding later what actually changed. */
  const originalRef = useRef<BookingSnapshot | null>(null);
  /**
   * The session type the booking was saved with.
   *
   * It cannot be selected until its service's types have loaded, so it waits
   * here for the load that follows.
   */
  const pendingTierId = useRef<string>("");
  const [origDate, setOrigDate] = useState<string | null>(null);
  const [origTime, setOrigTime] = useState<string>("");
  const [tierStaff, setTierStaff] = useState<TierStaff[]>([]);

  // The same list the public booking flow offers.
  useEffect(() => {
    async function load() {
      dispatchAsync({
        type: "SERVICES_LOADED",
        payload: await fetchBookableServices(),
      });
    }
    void load();
  }, [dispatchAsync]);

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

      const b = (data as BookingRow[] | null)?.[0];

      if (cancelled) return;

      if (!b) {
        dispatchAsync({ type: "BOOKING_LOADED" });
        return;
      }

      const { roomNumber, reservationNumber, address } = parseAddress(b);

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
      setOrigDate(b.date ?? null);
      setOrigTime(b.time ?? "");

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
          roomNumber,
          reservationNumber,
          notes: parsedNotes,
          address,
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
  }, [id, dispatchAsync, dispatchForm]);

  // Who can perform the chosen session type.
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
  }, [serviceId, dispatchAsync, dispatchForm]);

  return { originalRef, tierStaff, origDate, origTime };
}
