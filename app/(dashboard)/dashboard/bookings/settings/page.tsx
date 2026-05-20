"use client";

import { useState, useEffect, useReducer } from "react";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  loadColorSettings,
  DEFAULT_COLORS,
  SERVICES,
} from "@/utils/color-settings";
import type { ColorSettings } from "@/utils/color-settings";
import type { TierRow, ModalState } from "@/types/settings";
import { TierModal } from "@/components/dashboard/settings/tier-modal";

// ─── Google Calendar types ────────────────────────────────────────────────────

type ServiceCalendarConfig = {
  service_id: string;
  google_connected_email: string | null;
  google_calendar_id: string | null;
};

// ─── Google Calendar widget ───────────────────────────────────────────────────

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
  const [syncing, setSyncing] = useState(false);

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

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/google/calendar/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: serviceId }),
      });
    } catch {
      // ignore
    } finally {
      setSyncing(false);
    }
  };

  const isConnected = !!config?.google_connected_email;

  return (
    <div
      className={`mt-2 flex items-center justify-between rounded-xl border px-4 py-3 ${isConnected ? "border-green-200 bg-green-50" : "border-petroleum-100 bg-petroleum-100"}`}
    >
      <div className="flex flex-col gap-0.5">
        <span
          className={`text-sm font-medium ${isConnected ? "text-green-700" : "text-petroleum-400"}`}
        >
          {isConnected ? "Connected" : "Not connected"}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className={`size-1.5 shrink-0 rounded-full ${isConnected ? "bg-green-500" : "hidden"}`}
          />
          <span className="text-petroleum-500 max-w-50 truncate text-xs">
            {isConnected
              ? config!.google_connected_email
              : "No calendar linked"}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isConnected ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSync()}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Re-sync"}
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => void handleDisconnect()}
              disabled={disconnecting}
            >
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              window.location.href = `/api/google/calendar/connect?service_id=${serviceId}`;
            }}
          >
            Connect Google Calendar
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type DataState = {
  mounted: boolean;
  colors: ColorSettings;
  serviceTiers: Record<string, TierRow[]>;
  modal: ModalState | null;
  calendarConfigs: ServiceCalendarConfig[];
};

type DataAction =
  | {
      type: "INIT_DONE";
      colors: ColorSettings;
      serviceTiers: Record<string, TierRow[]>;
      calendarConfigs: ServiceCalendarConfig[];
    }
  | { type: "SET_SERVICE_TIERS"; serviceTiers: Record<string, TierRow[]> }
  | { type: "SET_MODAL"; modal: ModalState | null }
  | { type: "SET_COLORS"; colors: ColorSettings }
  | { type: "REMOVE_CALENDAR_CONFIG"; serviceId: string };

const initialDataState: DataState = {
  mounted: false,
  colors: DEFAULT_COLORS,
  serviceTiers: {},
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
        calendarConfigs: action.calendarConfigs,
      };
    case "SET_SERVICE_TIERS":
      return { ...state, serviceTiers: action.serviceTiers };
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

// ─── Services content ─────────────────────────────────────────────────────────

function ServicesContent({
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
    <div className="flex flex-col gap-4">
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
                <div className="grid grid-cols-[1fr_48px_88px_80px_80px_72px] items-center gap-3 px-5 py-2">
                  {[
                    "Name",
                    "Color",
                    "Duration",
                    "Centre",
                    "Suite",
                    "Status",
                  ].map((h, i) => (
                    <span
                      key={h}
                      className={`text-petroleum-400 text-xs font-medium ${i >= 3 && i <= 4 ? "text-right" : i === 5 ? "text-center" : ""}`}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onEditTier(id, t)}
                    className="border-sand-100 hover:bg-sand-50 grid w-full grid-cols-[1fr_48px_88px_80px_80px_72px] items-center gap-3 border-t px-5 py-3 text-left transition-colors"
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
                      {t.price_center_eur != null
                        ? `€${t.price_center_eur}`
                        : t.price_eur != null
                          ? `€${t.price_eur}`
                          : "—"}
                    </span>
                    <span className="text-petroleum-500 text-right text-sm">
                      {t.price_suite_eur != null
                        ? `€${t.price_suite_eur}`
                        : "—"}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookingsSettingsPage() {
  const [initialToast] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const p = new URLSearchParams(window.location.search);
    if (p.get("connected") === "1") return "Google Calendar connected";
    if (p.get("error")) return `Calendar error: ${p.get("error")}`;
    return null;
  });

  const [toast, setToast] = useState<string | null>(initialToast);

  useEffect(() => {
    if (!initialToast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [data, dispatch] = useReducer(dataReducer, initialDataState);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  async function reloadServiceTiers(serviceId: string) {
    const { data: rows } = await insforge.database
      .from("service_tiers")
      .select(
        "id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color, active, sort_order",
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

  useEffect(() => {
    async function init() {
      const colors = loadColorSettings();

      const [tiersRes, calRes] = await Promise.all([
        insforge.database
          .from("service_tiers")
          .select(
            "id, service_id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color, active, sort_order",
          )
          .order("sort_order"),
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

      const calendarConfigs = (calRes.data ?? []) as ServiceCalendarConfig[];

      dispatch({ type: "INIT_DONE", colors, serviceTiers, calendarConfigs });
    }
    void init();
  }, []);

  // ── Skeleton ──

  if (!data.mounted) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="mb-8">
          <div className="bg-sand-100 h-8 w-32 animate-pulse rounded-lg" />
        </div>
        <div className="flex flex-col gap-4">
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

  return (
    <div className="px-6 py-8 lg:px-10">
      <ServicesContent
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

      {data.modal && (
        <TierModal
          modal={data.modal}
          onClose={() => dispatch({ type: "SET_MODAL", modal: null })}
          onSaved={reloadServiceTiers}
        />
      )}

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
