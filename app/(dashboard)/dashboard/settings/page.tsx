"use client";

import { useState, useEffect, useReducer } from "react";
import { useSearchParams } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  loadColorSettings,
  saveColorSettings,
  DEFAULT_COLORS,
  SERVICES,
} from "@/utils/color-settings";
import type { ColorSettings } from "@/utils/color-settings";
import type { Tab, TierRow, PlanRow, ModalState } from "@/types/settings";
import { SectionCard } from "@/components/dashboard/settings/section-card";
import { ColorRow } from "@/components/dashboard/settings/color-row";
import { TierModal } from "@/components/dashboard/settings/tier-modal";
import { PlanModal } from "@/components/dashboard/settings/plan-modal";
import { PlansTabContent } from "@/components/dashboard/settings/plans-tab-content";

// ─── Google Calendar types ────────────────────────────────────────────────────

type ServiceCalendarConfig = {
  service_id: string;
  google_connected_email: string | null;
  google_calendar_id: string | null;
};

// ─── Google Calendar connect/disconnect widget ────────────────────────────────

function GoogleCalendarWidget({
  serviceId,
  config,
  onDisconnected,
}: {
  serviceId: string;
  config: ServiceCalendarConfig | undefined;
  onDisconnected: (serviceId: string) => void;
}) {
  const [disconnecting, setDisconnecting] = useState(false);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`/api/google/calendar/disconnect?service_id=${serviceId}`, {
        method: "DELETE",
      });
      onDisconnected(serviceId);
    } catch {
      // ignore
    } finally {
      setDisconnecting(false);
    }
  };

  if (config?.google_connected_email) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
          <span className="size-1.5 rounded-full bg-green-500" />
          Connected
        </span>
        <span className="text-petroleum-400 max-w-[160px] truncate text-xs">
          {config.google_connected_email}
        </span>
        <button
          type="button"
          onClick={() => void handleDisconnect()}
          disabled={disconnecting}
          className="text-petroleum-300 text-xs transition-colors hover:text-red-500"
        >
          {disconnecting ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => {
          window.location.href = `/api/google/calendar/connect?service_id=${serviceId}`;
        }}
        className="border-sand-200 text-petroleum-600 hover:border-petroleum-200 hover:bg-petroleum-50 inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <path
            d="M15.5 5H19a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 2h8v6H8z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Connect Google Calendar
      </button>
    </div>
  );
}

// ─── Data state reducer ───────────────────────────────────────

type DataState = {
  // useState (not useRef) — read in the early-return guard below: `if (!mounted) return <skeleton>`
  mounted: boolean;
  colors: ColorSettings;
  serviceTiers: Record<string, TierRow[]>;
  plans: PlanRow[];
  planModal: PlanRow | null;
  modal: ModalState | null;
  calendarConfigs: ServiceCalendarConfig[];
};

type DataAction =
  | {
      type: "INIT_DONE";
      colors: ColorSettings;
      serviceTiers: Record<string, TierRow[]>;
      plans: PlanRow[];
      calendarConfigs: ServiceCalendarConfig[];
    }
  | { type: "SET_SERVICE_TIERS"; serviceTiers: Record<string, TierRow[]> }
  | { type: "SET_PLANS"; plans: PlanRow[] }
  | { type: "SET_PLAN_MODAL"; planModal: PlanRow | null }
  | { type: "SET_MODAL"; modal: ModalState | null }
  | { type: "SET_COLORS"; colors: ColorSettings }
  | { type: "REMOVE_CALENDAR_CONFIG"; serviceId: string };

const initialDataState: DataState = {
  mounted: false,
  colors: DEFAULT_COLORS,
  serviceTiers: {},
  plans: [],
  planModal: null,
  modal: null,
  calendarConfigs: [],
};

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case "INIT_DONE":
      return {
        ...state,
        mounted: true,
        colors: action.colors,
        serviceTiers: action.serviceTiers,
        plans: action.plans,
        calendarConfigs: action.calendarConfigs,
      };
    case "SET_SERVICE_TIERS":
      return { ...state, serviceTiers: action.serviceTiers };
    case "SET_PLANS":
      return { ...state, plans: action.plans };
    case "SET_PLAN_MODAL":
      return { ...state, planModal: action.planModal };
    case "SET_MODAL":
      return { ...state, modal: action.modal };
    case "SET_COLORS":
      return { ...state, colors: action.colors };
    case "REMOVE_CALENDAR_CONFIG":
      return {
        ...state,
        calendarConfigs: state.calendarConfigs.filter(
          (c) => c.service_id !== action.serviceId,
        ),
      };
    default:
      return state;
  }
}

// ─── Tab section components ───────────────────────────────────

function ServicesTabContent({
  serviceTiers,
  calendarConfigs,
  onAddTier,
  onEditTier,
  onCalendarDisconnected,
}: {
  serviceTiers: Record<string, TierRow[]>;
  calendarConfigs: ServiceCalendarConfig[];
  onAddTier: (serviceId: string) => void;
  onEditTier: (serviceId: string, tier: TierRow) => void;
  onCalendarDisconnected: (serviceId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {SERVICES.map(({ id, label }) => {
        const tiers = serviceTiers[id] ?? [];
        const calConfig = calendarConfigs.find((c) => c.service_id === id);
        return (
          <div key={id} className="border-sand-200 rounded-2xl border bg-white">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-petroleum-700 font-semibold">
                  {label}
                </span>
                <Button variant="solid" size="sm" onClick={() => onAddTier(id)}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5v14M5 12h14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  Add tier
                </Button>
              </div>
              <GoogleCalendarWidget
                serviceId={id}
                config={calConfig}
                onDisconnected={onCalendarDisconnected}
              />
            </div>

            {tiers.length > 0 ? (
              <div className="border-sand-100 border-t">
                <div className="grid grid-cols-[1fr_48px_88px_72px_72px] items-center gap-3 px-5 py-2">
                  {["Name", "Color", "Duration", "Price", "Status"].map(
                    (h, i) => (
                      <span
                        key={h}
                        className={`text-petroleum-400 text-xs font-medium ${i === 3 ? "text-right" : i === 4 ? "text-center" : ""}`}
                      >
                        {h}
                      </span>
                    ),
                  )}
                </div>
                {tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onEditTier(id, t)}
                    className="border-sand-100 hover:bg-sand-50 grid w-full grid-cols-[1fr_48px_88px_72px_72px] items-center gap-3 border-t px-5 py-3 text-left transition-colors"
                  >
                    <span className="text-petroleum-700 min-w-0 truncate text-sm">
                      {t.label ?? "—"}
                    </span>
                    <div
                      className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ backgroundColor: t.color ?? "#6b7280" }}
                    />
                    <span className="text-petroleum-500 text-sm">
                      {t.duration_minutes != null
                        ? `${t.duration_minutes} min`
                        : "—"}
                    </span>
                    <span className="text-petroleum-700 text-right text-sm font-medium">
                      {t.price_eur != null ? `€${t.price_eur}` : "—"}
                    </span>
                    <span className="flex justify-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          t.active
                            ? "bg-green-100 text-green-700"
                            : "bg-sand-100 text-petroleum-400"
                        }`}
                      >
                        {t.active ? "Active" : "Off"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="border-sand-100 border-t px-5 py-4">
                <p className="text-petroleum-300 text-sm">
                  No tiers yet. Add one to enable this service in bookings.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(
    (searchParams.get("tab") as Tab | null) ?? "services",
  );

  // Derive an initial toast from OAuth callback query params (evaluated once on mount)
  const initialToast =
    searchParams.get("connected") === "1"
      ? "Google Calendar connected"
      : searchParams.get("error")
        ? `Calendar error: ${searchParams.get("error")}`
        : null;

  const [toast, setToast] = useState<string | null>(initialToast);

  // Auto-dismiss the initial OAuth toast after mount
  useEffect(() => {
    if (!initialToast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
    // initialToast is stable (derived from URL at mount) — exhaustive-deps is intentionally not a concern here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, dispatch] = useReducer(dataReducer, initialDataState);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  // ── Load tiers for one service (called after modal save/delete) ──

  async function reloadServiceTiers(serviceId: string) {
    const { data: rows } = await insforge.database
      .from("service_tiers")
      .select(
        "id, label, duration_minutes, price_eur, color, active, sort_order",
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
    showToast("Saved");
  }

  // ── Initial load ──

  useEffect(() => {
    async function init() {
      const colors = loadColorSettings();

      const [tiersRes, plansRes, calRes] = await Promise.all([
        insforge.database
          .from("service_tiers")
          .select(
            "id, service_id, label, duration_minutes, price_eur, color, active, sort_order",
          )
          .order("sort_order"),
        insforge.database
          .from("membership_plans")
          .select("id, label, price_monthly")
          .order("price_monthly"),
        // Calendar configs are fetched via the API route (uses service key server-side)
        fetch("/api/google/calendar/configs").then(async (r) => {
          if (!r.ok) return { data: [] };
          return r.json() as Promise<{ data: ServiceCalendarConfig[] }>;
        }),
      ]);

      const serviceTiers: Record<string, TierRow[]> = {};
      if (tiersRes.data) {
        for (const r of tiersRes.data as (TierRow & { service_id: string })[]) {
          if (!serviceTiers[r.service_id]) serviceTiers[r.service_id] = [];
          serviceTiers[r.service_id].push(r);
        }
      }

      const plans = plansRes.data ? (plansRes.data as PlanRow[]) : [];
      const calendarConfigs = (calRes.data ?? []) as ServiceCalendarConfig[];

      dispatch({
        type: "INIT_DONE",
        colors,
        serviceTiers,
        plans,
        calendarConfigs,
      });
    }
    void init();
  }, []);

  // ── Plans handlers ──

  async function reloadPlans() {
    const { data: rows } = await insforge.database
      .from("membership_plans")
      .select("id, label, price_monthly")
      .order("price_monthly");
    if (rows) dispatch({ type: "SET_PLANS", plans: rows as PlanRow[] });
    showToast("Saved");
  }

  // ── Appearance handlers ──

  function handleRacesColor(color: string) {
    const next = { ...data.colors, races: color };
    dispatch({ type: "SET_COLORS", colors: next });
    saveColorSettings(next);
  }

  function handleSessionsColor(color: string) {
    const next = { ...data.colors, sessions: color };
    dispatch({ type: "SET_COLORS", colors: next });
    saveColorSettings(next);
  }

  // ── Skeleton ──

  if (!data.mounted) {
    return (
      <div className="px-6 py-8 lg:px-10">
        {/* Header */}
        <div className="mb-8 space-y-2">
          <div className="bg-sand-100 h-8 w-40 animate-pulse rounded-lg" />
          <div className="bg-sand-100 h-4 w-72 animate-pulse rounded" />
        </div>

        {/* Tab bar */}
        <div className="border-sand-200 mb-6 flex gap-1 border-b">
          {[20, 36, 28].map((w, i) => (
            <div
              key={i}
              className="bg-sand-100 mb-[-1px] h-9 animate-pulse rounded-t-md"
              style={{ width: `${w * 4}px` }}
            />
          ))}
        </div>

        {/* Services grid — 2-col, 4 cards visible */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="border-sand-200 rounded-2xl border bg-white"
            >
              <div className="flex items-center justify-between px-5 py-4">
                <div className="bg-sand-100 h-5 w-36 animate-pulse rounded" />
                <div className="bg-sand-100 h-8 w-20 animate-pulse rounded-lg" />
              </div>
              <div className="border-sand-100 border-t">
                {[0, 1].map((j) => (
                  <div
                    key={j}
                    className="border-sand-100 flex items-center gap-3 border-t px-5 py-3"
                  >
                    <div className="bg-sand-100 h-4 flex-1 animate-pulse rounded" />
                    <div className="bg-sand-100 size-4 shrink-0 animate-pulse rounded-full" />
                    <div className="bg-sand-100 h-4 w-16 animate-pulse rounded" />
                    <div className="bg-sand-100 h-4 w-12 animate-pulse rounded" />
                    <div className="bg-sand-100 h-5 w-12 animate-pulse rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8">
        <h1 className="font-display text-petroleum-700 text-3xl">Settings</h1>
        <p className="text-petroleum-400 mt-1 text-sm">
          Manage services, membership plans, staff, and display preferences.
        </p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Settings categories"
        className="border-sand-200 mb-6 flex flex-wrap gap-1 border-b"
      >
        {(
          [
            ["services", "Services"],
            ["plans", "Membership Plans"],
            ["appearance", "Appearance"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`relative -mb-px rounded-t-md px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? "border-petroleum-700 text-petroleum-700 border-b-2"
                : "text-petroleum-400 hover:text-petroleum-500 border-b-2 border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* ── Services ── */}
        {tab === "services" && (
          <ServicesTabContent
            serviceTiers={data.serviceTiers}
            calendarConfigs={data.calendarConfigs}
            onAddTier={(serviceId) =>
              dispatch({ type: "SET_MODAL", modal: { serviceId } })
            }
            onEditTier={(serviceId, tier) =>
              dispatch({ type: "SET_MODAL", modal: { serviceId, tier } })
            }
            onCalendarDisconnected={(serviceId) => {
              dispatch({ type: "REMOVE_CALENDAR_CONFIG", serviceId });
              showToast("Google Calendar disconnected");
            }}
          />
        )}

        {/* ── Membership Plans ── */}
        {tab === "plans" && (
          <PlansTabContent
            plans={data.plans}
            onEdit={(plan) =>
              dispatch({ type: "SET_PLAN_MODAL", planModal: plan })
            }
          />
        )}

        {/* ── Appearance ── */}
        {tab === "appearance" && (
          <>
            <SectionCard
              title="Races"
              description="Color used to represent races in the calendar."
            >
              <ColorRow
                label="Races"
                value={data.colors.races}
                onChange={handleRacesColor}
              />
            </SectionCard>
            <SectionCard
              title="Education Sessions"
              description="Color used to represent education sessions in the calendar."
            >
              <ColorRow
                label="Education Sessions"
                value={data.colors.sessions}
                onChange={handleSessionsColor}
              />
            </SectionCard>
          </>
        )}
      </div>

      {/* Tier modal */}
      {data.modal && (
        <TierModal
          modal={data.modal}
          onClose={() => dispatch({ type: "SET_MODAL", modal: null })}
          onSaved={reloadServiceTiers}
        />
      )}

      {/* Plan modal */}
      {data.planModal && (
        <PlanModal
          plan={data.planModal}
          onClose={() => dispatch({ type: "SET_PLAN_MODAL", planModal: null })}
          onSaved={reloadPlans}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="bg-petroleum-700 fixed right-6 bottom-6 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-white shadow-lg">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}
