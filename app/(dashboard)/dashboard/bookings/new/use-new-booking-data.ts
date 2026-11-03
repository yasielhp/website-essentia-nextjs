"use client";

import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { useSearchParams } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { fetchBookableServices } from "@/services/bookable-services.client";
import { getAccessToken } from "@/lib/client-session";
import { fetchContactDetail } from "@/actions/contacts";
import { fetchContactBonuses } from "@/actions/bonuses";
import type { ContactBonus } from "@/types/bonus";
import { usableBonus } from "@/lib/bonuses/balance";
import { localDateStr } from "@/utils/format";
import { GENDER_UNSPECIFIED } from "@/constants/gender";
import { fetchTierStaff, type TierStaff } from "@/actions/tier-staff";
import type { AsyncAction, FormAction, Tier } from "./form-state";

/**
 * What this screen has to fetch, and what it is told to start from.
 *
 * Three requests in one direction — services, then a service's session types,
 * then a type's people — plus the day and hour a deep link may already carry,
 * because the dashboard calendar sends you here from an empty slot, and the
 * contact and bonus ("Redeem" on a contact's file) it may be told to start from.
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
  const [contactBonuses, setContactBonuses] = useState<ContactBonus[]>([]);
  // The session type a redeemed bonus is for, waiting for its service's types
  // to load so it can be chosen among them.
  const pendingTierId = useRef<string | null>(null);
  const appliedBonusId = useRef<string | null>(null);

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

  // And the bonuses that contact holds, so a session can be drawn from one.
  useEffect(() => {
    if (!contactParam) return;
    let cancelled = false;
    void fetchContactBonuses(getAccessToken(), contactParam).then((rows) => {
      if (!cancelled) setContactBonuses(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [contactParam]);

  // `?bonus=` is only believed if the bonus is this contact's, has not expired
  // and still has a session to give; anything else is ignored, so a stale or
  // tampered link just opens an ordinary new booking.
  const bonusParam = searchParams.get("bonus");
  const redeemBonus = useMemo(() => {
    if (!bonusParam) return null;
    const bonus = contactBonuses.find((b) => b.id === bonusParam);
    if (!bonus) return null;
    const usable = usableBonus(
      [
        {
          id: bonus.id,
          tierId: bonus.tierId,
          sessionsTotal: bonus.sessionsTotal,
          expiresAt: bonus.expiresAt,
        },
      ],
      bonus.bookings.map((u) => ({
        bonusId: bonus.id,
        status: u.status ?? "",
      })),
      bonus.tierId,
      localDateStr(new Date()),
    );
    return usable ? bonus : null;
  }, [bonusParam, contactBonuses]);

  // Redeeming starts the booking with the bonus's service and session type
  // already chosen, once, when the bonus is known.
  useEffect(() => {
    if (!redeemBonus || appliedBonusId.current === redeemBonus.id) return;
    appliedBonusId.current = redeemBonus.id;
    void insforge.database
      .from("service_tiers")
      .select("service_id")
      .eq("id", redeemBonus.tierId)
      .limit(1)
      .then(({ data }) => {
        const service = (data as { service_id: string | null }[] | null)?.[0]
          ?.service_id;
        if (!service) return;
        pendingTierId.current = redeemBonus.tierId;
        dispatchForm({ type: "SET_SERVICE", id: service });
      });
  }, [redeemBonus, dispatchForm]);

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
      // A redeemed bonus has already chosen its session type.
      const wanted = pendingTierId.current;
      pendingTierId.current = null;
      const redeemed = wanted ? rows.find((r) => r.id === wanted) : undefined;
      if (redeemed) {
        dispatchForm({ type: "SET_TIER", id: redeemed.id });
        return;
      }
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

  return { tierStaff, contactBonuses, redeemBonus };
}
