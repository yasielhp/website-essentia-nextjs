"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useSearchParams } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { fetchBookableServices } from "@/services/bookable-services.client";
import { getAccessToken } from "@/lib/client-session";
import { fetchContactDetail } from "@/actions/contacts";
import { GENDER_UNSPECIFIED } from "@/constants/gender";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import type { AsyncAction, FormAction, Tier } from "./form-state";

/**
 * What this screen has to fetch, and what it is told to start from.
 *
 * Three requests in one direction — services, then a service's session types,
 * then a type's people — plus the day and hour a deep link may already carry,
 * because the dashboard calendar sends you here from an empty slot.
 */
export function useNewBookingData({
  serviceId,
  tierId,
  dispatchAsync,
  dispatchForm,
}: {
  /** The service currently chosen, whose session types are loaded. */
  serviceId: string;
  /** The session type currently chosen, whose staff are loaded. */
  tierId: string;
  dispatchAsync: Dispatch<AsyncAction>;
  dispatchForm: Dispatch<FormAction>;
}) {
  const searchParams = useSearchParams();
  const [tierStaff, setTierStaff] = useState<TierStaff[]>([]);

  // A slot clicked on the dashboard calendar arrives as ?date=&time=.
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const timeParam = searchParams.get("time");
    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      if (y && m && d) {
        const parsed = new Date(y, m - 1, d);
        if (!isNaN(parsed.getTime())) {
          dispatchForm({ type: "SET_DATE", value: parsed });
        }
      }
    }
    if (timeParam) {
      dispatchForm({ type: "SET_TIME", value: timeParam });
    }
  }, [searchParams, dispatchForm]);

  // Arriving from a contact's file (?contact=) starts the booking with who it
  // is for already filled in; the client step shows it once reached.
  const contactParam = searchParams.get("contact");
  useEffect(() => {
    if (!contactParam) return;
    let cancelled = false;
    void fetchContactDetail(getAccessToken(), contactParam).then((result) => {
      if (cancelled || !result.found) return;
      const { contact } = result;
      dispatchForm({
        type: "PREFILL_CLIENT",
        value: {
          firstName: contact.first_name ?? "",
          lastName: contact.last_name ?? "",
          email: contact.email ?? "",
          phone: contact.phone ?? "",
          gender: contact.gender ?? GENDER_UNSPECIFIED,
          language: contact.preferred_language === "en" ? "en" : "es",
        },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [contactParam, dispatchForm]);

  // The same list the public booking flow offers.
  useEffect(() => {
    async function load() {
      dispatchAsync({ type: "SERVICES_LOADING" });
      dispatchAsync({
        type: "SERVICES_LOADED",
        payload: await fetchBookableServices(),
      });
    }
    void load();
  }, [dispatchAsync]);

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

  // Session types, reloaded whenever the service changes.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!serviceId) {
        dispatchAsync({ type: "TIERS_LOADED", payload: [] });
        dispatchForm({ type: "RESET_TIERS" });
        return;
      }
      dispatchAsync({ type: "TIERS_LOADING" });
      dispatchForm({ type: "RESET_TIERS" });
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
      // One type is no choice at all, so it is made.
      if (rows.length === 1 && rows[0]) {
        dispatchForm({ type: "SET_TIER", id: rows[0].id });
      }
    }
    void load();

    return () => {
      cancelled = true;
    };
  }, [serviceId, dispatchAsync, dispatchForm]);

  return { tierStaff };
}
