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
  // their session types are seeded rather than added from here. All of them in
  // one list, each saying which category it belongs to.
  const rows = bookableServices.flatMap(({ id }) =>
    (serviceTiers[id] ?? []).map((tier) => ({ serviceId: id, tier })),
  );

  if (rows.length === 0) {
    return (
      <div className="border-sand-200 rounded-2xl border bg-white px-5 py-4">
        <p className="text-petroleum-300 text-sm">{t("noTiers")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* The calendar colour tints the row, so a tier is recognisable here the
          same way it is on the calendar. Kept faint: the text still has to
          read on top of it. The rest — prices, duration, who performs it — is
          in the modal this opens. */}
      {rows.map(({ serviceId, tier }) => (
        <button
          key={tier.id}
          type="button"
          onClick={() => onEditTier(serviceId, tier)}
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
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-petroleum-700 truncate text-sm font-medium">
              {tier.label ?? "—"}
            </span>
            <span className="text-petroleum-400 truncate text-xs">
              {tServices(serviceId)}
            </span>
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
        {/* Same shape as the loaded page: one list of rows. */}
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="border-sand-200 flex items-center gap-3 rounded-2xl border bg-white p-3"
            >
              <div className="bg-sand-100 size-12 shrink-0 animate-pulse rounded-xl" />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="bg-sand-100 h-4 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 h-3 w-28 animate-pulse rounded" />
              </div>
              <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
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
