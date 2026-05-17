"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import {
  loadColorSettings,
  saveColorSettings,
  DEFAULT_COLORS,
  SERVICES,
} from "@/utils/color-settings";
import type { ColorSettings } from "@/utils/color-settings";
import type {
  Tab,
  TierRow,
  PlanRow,
  StaffRow,
  ModalState,
} from "@/types/settings";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import { SectionCard } from "@/components/dashboard/settings/section-card";
import { ColorRow } from "@/components/dashboard/settings/color-row";
import { TierModal } from "@/components/dashboard/settings/tier-modal";
import { PlanModal } from "@/components/dashboard/settings/plan-modal";

// ─── Constants ────────────────────────────────────────────────

const STAFF_PAGE_SIZE = 10;

// ─── Page ─────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("services");
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { push } = useRouter();

  // Colors
  const [colors, setColors] = useState<ColorSettings>(DEFAULT_COLORS);

  // Services tiers
  const [serviceTiers, setServiceTiers] = useState<Record<string, TierRow[]>>(
    {},
  );

  // Plans
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [planModal, setPlanModal] = useState<PlanRow | null>(null);

  // Staff
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const staffLoaded = useRef(false);
  const [staffPage, setStaffPage] = useState(0);

  // Modal
  const [modal, setModal] = useState<ModalState | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  // ── Load tiers for one service (called after modal save/delete) ──

  async function reloadServiceTiers(serviceId: string) {
    const { data } = await insforge.database
      .from("service_tiers")
      .select(
        "id, label, duration_minutes, price_eur, color, active, sort_order",
      )
      .eq("service_id", serviceId)
      .order("sort_order");
    setServiceTiers((p) => ({
      ...p,
      [serviceId]: (data as TierRow[] | null) ?? [],
    }));
    showToast("Saved");
  }

  // ── Initial load ──

  useEffect(() => {
    async function init() {
      setColors(loadColorSettings());

      const [tiersRes, plansRes] = await Promise.all([
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
      ]);

      if (tiersRes.data) {
        const map: Record<string, TierRow[]> = {};
        for (const r of tiersRes.data as (TierRow & {
          service_id: string;
        })[]) {
          if (!map[r.service_id]) map[r.service_id] = [];
          map[r.service_id].push(r);
        }
        setServiceTiers(map);
      }

      if (plansRes.data) {
        setPlans(plansRes.data as PlanRow[]);
      }

      setMounted(true);
    }
    void init();
  }, []);

  // ── Lazy-load staff ──

  useEffect(() => {
    if (tab !== "staff" || staffLoaded.current) return;
    async function loadStaff() {
      setStaffLoading(true);
      const { data } = await insforge.database
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .eq("role", "staff")
        .order("created_at", { ascending: false });
      setStaff((data as StaffRow[] | null) ?? []);
      staffLoaded.current = true;
      setStaffLoading(false);
    }
    void loadStaff();
  }, [tab]);

  // ── Plans handlers ──

  async function reloadPlans() {
    const { data } = await insforge.database
      .from("membership_plans")
      .select("id, label, price_monthly")
      .order("price_monthly");
    if (data) setPlans(data as PlanRow[]);
    showToast("Saved");
  }

  // ── Appearance handlers ──

  function handleRacesColor(color: string) {
    const next = { ...colors, races: color };
    setColors(next);
    saveColorSettings(next);
  }

  function handleSessionsColor(color: string) {
    const next = { ...colors, sessions: color };
    setColors(next);
    saveColorSettings(next);
  }

  // ── Skeleton ──

  if (!mounted) {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="space-y-4">
          {(["a", "b", "c"] as const).map((n) => (
            <div
              key={n}
              className="border-sand-200 h-40 animate-pulse rounded-2xl border bg-white"
            />
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
      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["services", "Services"],
            ["plans", "Membership Plans"],
            ["staff", "Staff"],
            ["appearance", "Appearance"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <TabButton key={key} active={tab === key} onClick={() => setTab(key)}>
            {label}
          </TabButton>
        ))}
      </div>

      <div className="space-y-4">
        {/* ── Services ── */}
        {tab === "services" && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {SERVICES.map(({ id, label }) => {
              const tiers = serviceTiers[id] ?? [];
              return (
                <div
                  key={id}
                  className="border-sand-200 rounded-2xl border bg-white"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-5 py-4">
                    <span className="text-petroleum-700 font-semibold">
                      {label}
                    </span>
                    <Button
                      variant="solid"
                      size="sm"
                      onClick={() => setModal({ serviceId: id })}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
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

                  {/* Tier table */}
                  {tiers.length > 0 ? (
                    <div className="border-sand-100 border-t">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_48px_88px_72px_72px] items-center gap-3 px-5 py-2">
                        <span className="text-petroleum-400 text-xs font-medium">
                          Name
                        </span>
                        <span className="text-petroleum-400 text-xs font-medium">
                          Color
                        </span>
                        <span className="text-petroleum-400 text-xs font-medium">
                          Duration
                        </span>
                        <span className="text-petroleum-400 text-right text-xs font-medium">
                          Price
                        </span>
                        <span className="text-petroleum-400 text-center text-xs font-medium">
                          Status
                        </span>
                      </div>

                      {/* Rows */}
                      {tiers.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setModal({ serviceId: id, tier: t })}
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
                        No tiers yet. Add one to enable this service in
                        bookings.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Membership Plans ── */}
        {tab === "plans" && (
          <SectionCard
            title="Membership Plans"
            description="Click a plan to edit its name and monthly price."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanModal(plan)}
                  className="border-sand-200 hover:border-petroleum-300 hover:bg-sand-50 flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors active:scale-[0.98]"
                >
                  <span className="text-petroleum-700 text-sm font-semibold">
                    {plan.label}
                  </span>
                  <span className="text-petroleum-400 text-xs">
                    {plan.price_monthly != null
                      ? `€${plan.price_monthly} / mo`
                      : "No price set"}
                  </span>
                </button>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Staff ── */}
        {tab === "staff" && (
          <div className="border-sand-200 rounded-2xl border bg-white">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <span className="text-petroleum-700 font-semibold">Staff</span>
              <Button
                variant="solid"
                size="sm"
                href="/dashboard/settings/staff/new"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add staff
              </Button>
            </div>

            {staffLoading ? (
              <div className="border-sand-100 space-y-3 border-t px-5 py-4">
                {(["a", "b", "c"] as const).map((n) => (
                  <div
                    key={n}
                    className="bg-sand-100 h-10 animate-pulse rounded-xl"
                  />
                ))}
              </div>
            ) : staff.length === 0 ? (
              <div className="border-sand-100 border-t px-5 py-4">
                <p className="text-petroleum-300 text-sm">
                  No staff members yet. Add one to get started.
                </p>
              </div>
            ) : (
              <div className="border-sand-100 border-t">
                {/* Column headers */}
                <div className="grid grid-cols-[36px_1fr_1fr_1fr] items-center gap-3 px-5 py-2">
                  <span />
                  <span className="text-petroleum-400 text-xs font-medium">
                    Name
                  </span>
                  <span className="text-petroleum-400 text-xs font-medium">
                    Email
                  </span>
                  <span className="text-petroleum-400 text-xs font-medium">
                    Phone
                  </span>
                </div>
                {/* Rows — current page */}
                {staff
                  .slice(
                    staffPage * STAFF_PAGE_SIZE,
                    (staffPage + 1) * STAFF_PAGE_SIZE,
                  )
                  .map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => push(`/dashboard/staff/${member.id}`)}
                      className="border-sand-100 hover:bg-sand-50 grid w-full grid-cols-[36px_1fr_1fr_1fr] items-center gap-3 border-t px-5 py-3 text-left transition-colors"
                    >
                      {/* Avatar */}
                      {member.avatar_url ? (
                        <div className="relative size-9 shrink-0 overflow-hidden rounded-lg">
                          <Image
                            src={member.avatar_url}
                            alt={member.full_name ?? ""}
                            fill
                            sizes="36px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="bg-sand-100 flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            className="text-petroleum-300"
                          >
                            <circle
                              cx="12"
                              cy="8"
                              r="4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                            />
                            <path
                              d="M4 20c0-4 3.6-7 8-7s8 3 8 7"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      )}
                      {/* Name */}
                      <span className="text-petroleum-700 min-w-0 truncate text-sm font-medium">
                        {member.full_name ?? "—"}
                      </span>
                      {/* Email */}
                      <span className="text-petroleum-400 min-w-0 truncate text-sm">
                        {member.email ?? "—"}
                      </span>
                      {/* Phone */}
                      <span className="text-petroleum-400 min-w-0 truncate text-sm">
                        {member.phone ?? "—"}
                      </span>
                    </button>
                  ))}
                {/* Pagination */}
                {staff.length > STAFF_PAGE_SIZE && (
                  <div className="border-sand-100 flex items-center justify-between border-t px-5 py-3">
                    <span className="text-petroleum-400 text-xs">
                      {staffPage * STAFF_PAGE_SIZE + 1}–
                      {Math.min(
                        (staffPage + 1) * STAFF_PAGE_SIZE,
                        staff.length,
                      )}{" "}
                      of {staff.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={staffPage === 0}
                        onClick={() => setStaffPage((p) => p - 1)}
                        className="border-sand-200 text-petroleum-500 hover:bg-sand-50 disabled:text-petroleum-200 rounded-lg border p-1.5 transition-colors disabled:cursor-not-allowed"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M15 18l-6-6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={
                          (staffPage + 1) * STAFF_PAGE_SIZE >= staff.length
                        }
                        onClick={() => setStaffPage((p) => p + 1)}
                        className="border-sand-200 text-petroleum-500 hover:bg-sand-50 disabled:text-petroleum-200 rounded-lg border p-1.5 transition-colors disabled:cursor-not-allowed"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M9 18l6-6-6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
                value={colors.races}
                onChange={handleRacesColor}
              />
            </SectionCard>
            <SectionCard
              title="Education Sessions"
              description="Color used to represent education sessions in the calendar."
            >
              <ColorRow
                label="Education Sessions"
                value={colors.sessions}
                onChange={handleSessionsColor}
              />
            </SectionCard>
          </>
        )}
      </div>

      {/* Tier modal */}
      {modal && (
        <TierModal
          modal={modal}
          onClose={() => setModal(null)}
          onSaved={reloadServiceTiers}
        />
      )}

      {/* Plan modal */}
      {planModal && (
        <PlanModal
          plan={planModal}
          onClose={() => setPlanModal(null)}
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
