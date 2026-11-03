"use client";

import { useEffect, useReducer } from "react";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { notifySuccess } from "@/lib/feedback";
import { loadColorSettings, DEFAULT_COLORS } from "@/utils/color-settings";
import { bookableServices } from "@/data/services-data";
import type { ColorSettings } from "@/utils/color-settings";
import type { TierRow, ModalState } from "@/types/settings";
import { TierModal } from "@/components/dashboard/settings/tier-modal";
import { TierThumbnail } from "@/components/ui/tier-thumbnail";

// ─── Reducer ──────────────────────────────────────────────────────────────────

type DataState = {
  mounted: boolean;
  colors: ColorSettings;
  serviceTiers: Record<string, TierRow[]>;
  modal: ModalState | null;
};

type DataAction =
  | {
      type: "INIT_DONE";
      colors: ColorSettings;
      serviceTiers: Record<string, TierRow[]>;
    }
  | { type: "SET_SERVICE_TIERS"; serviceTiers: Record<string, TierRow[]> }
  | { type: "SET_MODAL"; modal: ModalState | null }
  | { type: "SET_COLORS"; colors: ColorSettings };

const initialDataState: DataState = {
  mounted: false,
  colors: DEFAULT_COLORS,
  serviceTiers: {},
  modal: null,
};

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "INIT_DONE":
      return {
        ...state,
        mounted: true,
        colors: action.colors,
        serviceTiers: action.serviceTiers,
      };
    case "SET_SERVICE_TIERS":
      return { ...state, serviceTiers: action.serviceTiers };
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
  onEditTier,
}: {
  serviceTiers: Record<string, TierRow[]>;
  onEditTier: (serviceId: string, tier: TierRow) => void;
}) {
  const t = useTranslations("dashboard.settings.services");
  const tServices = useTranslations("dashboard.services");
  const tTiers = useTranslations("dashboard.settings.tiers");
  // The catalogue is fixed in code: these are the services that exist, and
  // their session types are seeded rather than added from here.
  return (
    <div className="flex flex-col gap-6">
      {/* One card per service, its session types inside. */}
      {bookableServices.map(({ id }) => {
        const tiers = serviceTiers[id] ?? [];
        return (
          <section
            key={id}
            className="border-sand-200 rounded-2xl border bg-white p-6"
          >
            <h3 className="font-display text-petroleum-700 mb-4 text-xl">
              {tServices(id)}
            </h3>
            {tiers.length > 0 ? (
              <div className="flex flex-col gap-2">
                {/* The calendar colour tints the row, so a tier is
                    recognisable here the same way it is on the calendar.
                    Kept faint: the text still has to read on top of it. The
                    rest — prices, duration, who performs it — is in the modal
                    this opens. */}
                {tiers.map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => onEditTier(id, tier)}
                    style={{
                      backgroundColor: `color-mix(in srgb, ${tier.color ?? "#6b7280"} 6%, white)`,
                      borderColor: `color-mix(in srgb, ${tier.color ?? "#6b7280"} 40%, white)`,
                    }}
                    className="hover:ring-petroleum-300 flex items-center gap-3 rounded-2xl border p-3 text-left transition-shadow hover:ring-2"
                  >
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
                  </button>
                ))}
              </div>
            ) : (
              <div className="border-sand-200 rounded-2xl border bg-white px-5 py-4">
                <p className="text-petroleum-300 text-sm">{t("noTiers")}</p>
              </div>
            )}
          </section>
        );
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
    notifySuccess(tToasts("tierSaved"));
  }

  useEffect(() => {
    async function init() {
      const colors = loadColorSettings();

      const tiersRes = await insforge.database
        .from("service_tiers")
        .select(
          "id, service_id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color, image_url, active, sort_order",
        )
        .order("sort_order");

      const serviceTiers: Record<string, TierRow[]> = {};
      if (tiersRes.data) {
        for (const r of tiersRes.data as (TierRow & { service_id: string })[]) {
          if (!serviceTiers[r.service_id]) serviceTiers[r.service_id] = [];
          serviceTiers[r.service_id].push(r);
        }
      }

      dispatch({ type: "INIT_DONE", colors, serviceTiers });
    }
    void init();
  }, []);

  // ── Skeleton ──

  if (!data.mounted) {
    return (
      <div className="flex flex-col gap-4">
        {/* Same shape as the loaded page: a card per service, its rows inside. */}
        {[0, 1].map((card) => (
          <div
            key={card}
            className="border-sand-200 rounded-2xl border bg-white p-6"
          >
            <div className="bg-sand-100 mb-4 h-6 w-44 animate-pulse rounded" />
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="border-sand-200 flex items-center gap-3 rounded-2xl border bg-white p-3"
                >
                  <div className="bg-sand-100 size-12 shrink-0 animate-pulse rounded-xl" />
                  <div className="bg-sand-100 h-4 w-40 flex-1 animate-pulse rounded" />
                  <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <ServicesContent
        serviceTiers={data.serviceTiers}
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
