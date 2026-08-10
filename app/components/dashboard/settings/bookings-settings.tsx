"use client";

import { useState, useEffect, useReducer } from "react";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { notifySuccess } from "@/lib/feedback";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";
import { bookableServices } from "@/data/services-data";
import type { ColorSettings } from "@/utils/color-settings";
import type { TierRow, ModalState } from "@/types/settings";
import { TierModal } from "@/components/dashboard/settings/tier-modal";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import { CalendarSyncCard } from "./calendar-sync-card";

// ─── Reducer ──────────────────────────────────────────────────────────────────

type DataState = {
  mounted: boolean;
  colors: ColorSettings;
  serviceTiers: Record<string, TierRow[]>;
  /** Names of the staff assigned to each session type, keyed by tier id. */
  tierStaff: Record<string, string[]>;
  modal: ModalState | null;
};

type DataAction =
  | {
      type: "INIT_DONE";
      colors: ColorSettings;
      serviceTiers: Record<string, TierRow[]>;
      tierStaff: Record<string, string[]>;
    }
  | { type: "SET_SERVICE_TIERS"; serviceTiers: Record<string, TierRow[]> }
  | { type: "SET_TIER_STAFF"; tierStaff: Record<string, string[]> }
  | { type: "SET_MODAL"; modal: ModalState | null }
  | { type: "SET_COLORS"; colors: ColorSettings };

const initialDataState: DataState = {
  mounted: false,
  colors: DEFAULT_COLORS,
  serviceTiers: {},
  tierStaff: {},
  modal: null,
};

/** Who performs each session type, as names ready to print. */
async function loadTierStaff(): Promise<Record<string, string[]>> {
  const [assigned, staff] = await Promise.all([
    insforge.database
      .from("staff_tiers")
      .select("tier_id, staff_id, sort_order")
      .order("sort_order"),
    insforge.database
      .from("profiles")
      .select("id, full_name, first_name")
      .eq("role", "staff"),
  ]);

  const names = new Map(
    (
      (staff.data ?? []) as {
        id: string;
        full_name: string | null;
        first_name: string | null;
      }[]
    ).map((p) => [p.id, p.full_name ?? p.first_name ?? "—"]),
  );

  const byTier: Record<string, string[]> = {};
  for (const row of (assigned.data ?? []) as {
    tier_id: string;
    staff_id: string;
  }[]) {
    const name = names.get(row.staff_id);
    if (!name) continue;
    (byTier[row.tier_id] ??= []).push(name);
  }
  return byTier;
}

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "INIT_DONE":
      return {
        ...state,
        mounted: true,
        colors: action.colors,
        serviceTiers: action.serviceTiers,
        tierStaff: action.tierStaff,
      };
    case "SET_SERVICE_TIERS":
      return { ...state, serviceTiers: action.serviceTiers };
    case "SET_TIER_STAFF":
      return { ...state, tierStaff: action.tierStaff };
    case "SET_MODAL":
      return { ...state, modal: action.modal };
    case "SET_COLORS":
      return { ...state, colors: action.colors };
    default:
      return state;
  }
}

// ─── Services content ─────────────────────────────────────────────────────────

function ServicesContent({
  serviceTiers,
  tierStaff,
  onEditTier,
}: {
  serviceTiers: Record<string, TierRow[]>;
  tierStaff: Record<string, string[]>;
  onEditTier: (serviceId: string, tier: TierRow) => void;
}) {
  const t = useTranslations("dashboard.settings.services");
  const tServices = useTranslations("dashboard.services");
  const tTiers = useTranslations("dashboard.settings.tiers");
  // The catalogue is fixed in code: these are the services that exist, and
  // their session types are seeded rather than added from here.
  const [service, setService] = useState(bookableServices[0]?.id ?? "");

  return (
    <div className="flex flex-col gap-4">
      <CalendarSyncCard />

      <div className="flex gap-1 overflow-x-auto">
        {bookableServices.map(({ id }) => (
          <TabButton
            key={id}
            active={service === id}
            onClick={() => setService(id)}
          >
            <span className="whitespace-nowrap">{tServices(id)}</span>
          </TabButton>
        ))}
      </div>

      {/* One pass: only the selected service produces a panel. */}
      {bookableServices.flatMap(({ id }) => {
        if (id !== service) return [];
        const tiers = serviceTiers[id] ?? [];
        return [
          <div key={id}>
            {tiers.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {/* The calendar colour tints the whole card, so a tier is
                      recognisable here the same way it is on the calendar.
                      Kept faint: the text still has to read on top of it. */}
                {tiers.map((tier) => {
                  // Whatever the two prices say — the percentage is not
                  // stored, so it can never disagree with what is charged.
                  const discount =
                    tier.price_center_eur != null &&
                    tier.price_eur != null &&
                    tier.price_center_eur > tier.price_eur
                      ? Math.round(
                          (1 - tier.price_eur / tier.price_center_eur) * 100,
                        )
                      : null;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => onEditTier(id, tier)}
                      style={{
                        backgroundColor: `color-mix(in srgb, ${tier.color ?? "#6b7280"} 6%, white)`,
                        borderColor: `color-mix(in srgb, ${tier.color ?? "#6b7280"} 40%, white)`,
                      }}
                      className="hover:ring-petroleum-300 flex flex-col gap-3 rounded-2xl border p-4 text-left transition-shadow hover:ring-2"
                    >
                      <div className="flex items-start gap-3">
                        <TierThumbnail
                          imageUrl={tier.image_url}
                          color={tier.color}
                          label={tier.label}
                          className="size-12 shrink-0"
                          sizes="48px"
                        />
                        <span className="text-petroleum-700 min-w-0 flex-1 truncate text-sm font-medium">
                          {tier.label ?? "—"}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            tier.active
                              ? "bg-green-100 text-green-700"
                              : "text-petroleum-400 bg-white/70"
                          }`}
                        >
                          {tier.active ? tTiers("active") : tTiers("off")}
                        </span>
                      </div>

                      <dl className="flex flex-col gap-1 border-t border-black/10 pt-3 text-xs">
                        {(
                          [
                            [
                              "duration",
                              tier.duration_minutes != null
                                ? `${tier.duration_minutes} min`
                                : "—",
                            ],
                            [
                              "priceWeb",
                              tier.price_eur != null
                                ? `${tier.price_eur} €${
                                    discount != null ? ` (−${discount} %)` : ""
                                  }`
                                : "—",
                            ],
                            [
                              "priceCentre",
                              tier.price_center_eur != null
                                ? `${tier.price_center_eur} €`
                                : "—",
                            ],
                            [
                              "priceSuite",
                              tier.price_suite_eur != null
                                ? `${tier.price_suite_eur} €`
                                : "—",
                            ],
                          ] as const
                        ).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-2">
                            <dt className="text-petroleum-400">
                              {t(`card.${key}`)}
                            </dt>
                            <dd className="text-petroleum-700 font-medium">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>

                      {/* Nobody assigned means nobody can be booked for it,
                          so the empty case is spelled out rather than blank. */}
                      <div className="flex flex-col gap-1.5 border-t border-black/10 pt-3">
                        <span className="text-petroleum-400 text-xs">
                          {t("card.staff")}
                        </span>
                        {(tierStaff[tier.id] ?? []).length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {(tierStaff[tier.id] ?? []).map((name) => (
                              <span
                                key={name}
                                className="text-petroleum-700 rounded-full bg-white/70 px-2 py-0.5 text-xs"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-red-600">
                            {t("card.noStaff")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="border-sand-200 rounded-2xl border bg-white px-5 py-4">
                <p className="text-petroleum-300 text-sm">{t("noTiers")}</p>
              </div>
            )}
          </div>,
        ];
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function BookingsSettings() {
  const tToasts = useTranslations("dashboard.toasts");

  const [data, dispatch] = useReducer(dataReducer, initialDataState);

  async function reloadServiceTiers(serviceId: string) {
    const { data: rows } = await insforge.database
      .from("service_tiers")
      .select(
        "id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color, image_url, active, sort_order",
      )
      .eq("service_id", serviceId)
      .order("sort_order");
    dispatch({
      type: "SET_SERVICE_TIERS",
      serviceTiers: {
        ...data.serviceTiers,
        [serviceId]: (rows as TierRow[] | null) ?? [],
      },
    });
    dispatch({ type: "SET_TIER_STAFF", tierStaff: await loadTierStaff() });
    notifySuccess(tToasts("tierSaved"));
  }

  useEffect(() => {
    async function init() {
      const colors = loadColorSettings();

      // Neither reads the other, so they wait together rather than in turn.
      const [tiersRes, tierStaff] = await Promise.all([
        insforge.database
          .from("service_tiers")
          .select(
            "id, service_id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color, image_url, active, sort_order",
          )
          .order("sort_order"),
        loadTierStaff(),
      ]);

      const serviceTiers: Record<string, TierRow[]> = {};
      if (tiersRes.data) {
        for (const r of tiersRes.data as (TierRow & { service_id: string })[]) {
          if (!serviceTiers[r.service_id]) serviceTiers[r.service_id] = [];
          serviceTiers[r.service_id].push(r);
        }
      }

      dispatch({ type: "INIT_DONE", colors, serviceTiers, tierStaff });
    }
    void init();
  }, []);

  // ── Skeleton ──

  if (!data.mounted) {
    return (
      <div className="flex flex-col gap-4">
        {/* Same shape as the loaded page: service tabs, then the card grid. */}
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-sand-100 h-9 w-28 animate-pulse rounded-full"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="border-sand-200 flex flex-col gap-3 rounded-2xl border bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <div className="bg-sand-100 size-12 shrink-0 animate-pulse rounded-xl" />
                <div className="flex-1">
                  <div className="bg-sand-100 h-4 w-28 animate-pulse rounded" />
                </div>
                <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
              </div>
              <div className="flex flex-col gap-2 border-t border-black/10 pt-3">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="flex justify-between gap-2">
                    <div className="bg-sand-100 h-3 w-20 animate-pulse rounded" />
                    <div className="bg-sand-100 h-3 w-12 animate-pulse rounded" />
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2 border-t border-black/10 pt-3">
                <div className="bg-sand-100 h-3 w-24 animate-pulse rounded" />
                <div className="flex gap-1.5">
                  <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                  <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ServicesContent
        serviceTiers={data.serviceTiers}
        tierStaff={data.tierStaff}
        onEditTier={(serviceId, tier) =>
          dispatch({ type: "SET_MODAL", modal: { serviceId, tier } })
        }
      />

      {data.modal && (
        <TierModal
          modal={data.modal}
          onClose={() => dispatch({ type: "SET_MODAL", modal: null })}
          onSaved={reloadServiceTiers}
        />
      )}
    </div>
  );
}
