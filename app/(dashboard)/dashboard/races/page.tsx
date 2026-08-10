"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { RaceList } from "./race-list";
import type { Race } from "./types";

const PAGE_SIZE = 10;

type RaceFilter = { access: string };
const emptyRaceFilter: RaceFilter = { access: "" };

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: RaceFilter;
  onChange: (key: keyof RaceFilter, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("dashboard");
  return (
    <div
      // Decorative: the click that closes is a convenience for a mouse. The
      // dialog itself is the element inside, and Escape closes it too.
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">
            {t("common.filters")}
          </h3>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-petroleum-400 text-xs font-medium">
              {t("races.filters.access")}
            </span>
            <select
              value={pending.access}
              onChange={(e) => onChange("access", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("races.access.all")}</option>
              <option value="members">{t("races.access.members")}</option>
              <option value="open">{t("races.access.open")}</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClear}
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
          >
            {t("common.clearAll")}
          </button>
          <Button variant="solid" size="md" onClick={onApply}>
            {t("common.applyFilters")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RacesPage() {
  const t = useTranslations("dashboard");
  const locale = useDashboardLocale();
  const [page, setPage] = useState(0);
  const [state, setState] = useState<{
    races: Race[];
    loading: boolean;
    total: number;
  }>({ races: [], loading: true, total: 0 });
  const { races, loading, total } = state;

  const [appliedFilter, setAppliedFilter] =
    useState<RaceFilter>(emptyRaceFilter);
  const [pendingFilter, setPendingFilter] =
    useState<RaceFilter>(emptyRaceFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = Object.values(appliedFilter).filter(Boolean).length;

  function openModal() {
    setPendingFilter(appliedFilter);
    setFilterOpen(true);
  }
  function applyFilters() {
    setAppliedFilter(pendingFilter);
    setPage(0);
    setFilterOpen(false);
  }
  function clearFilters() {
    setAppliedFilter(emptyRaceFilter);
    setPendingFilter(emptyRaceFilter);
    setPage(0);
    setFilterOpen(false);
  }

  const { push } = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let query = insforge.database
        .from("races")
        .select(
          "id, title, description, date, location, distance_km, max_participants, image_url, access, created_at",
          { count: "exact" },
        )
        .order("date", { ascending: false });

      if (appliedFilter.access) {
        query = query.eq("access", appliedFilter.access);
      }

      const { data: racesData, count } = await query.range(
        page * PAGE_SIZE,
        page * PAGE_SIZE + PAGE_SIZE - 1,
      );

      if (cancelled) return;

      if (!racesData || (racesData as unknown[]).length === 0) {
        setState({ races: [], loading: false, total: count ?? 0 });
        return;
      }

      const list = racesData as Omit<Race, "registrations_count">[];
      const ids = list.map((r) => r.id);

      const { data: regData } = await insforge.database
        .from("race_registrations")
        .select("race_id")
        .in("race_id", ids);

      if (cancelled) return;

      const countMap: Record<string, number> = {};
      if (regData) {
        for (const row of regData as { race_id: string }[]) {
          countMap[row.race_id] = (countMap[row.race_id] ?? 0) + 1;
        }
      }

      setState({
        races: list.map((r) => ({
          ...r,
          registrations_count: countMap[r.id] ?? 0,
        })),
        loading: false,
        total: count ?? 0,
      });
    }
    void run();

    return () => {
      cancelled = true;
    };
  }, [page, appliedFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-8 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/races/new"
          className="gap-2"
        >
          <IconPlus />
          {t("races.createRace")}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant={activeFilterCount > 0 ? "soft" : "outline"}
            size="md"
            onClick={openModal}
            className="gap-2"
          >
            <IconFilter />
            {activeFilterCount > 0
              ? t("common.filtersWithCount", { count: activeFilterCount })
              : t("common.filters")}
          </Button>
        </div>
      </div>
      <RaceList
        races={races}
        loading={loading}
        locale={locale}
        onOpen={(id) => push(`/dashboard/races/${id}/edit`)}
      />

      {total > PAGE_SIZE && (
        <div className="border-sand-200 mt-4 rounded-2xl border bg-white">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPage={setPage}
            loading={loading}
            className="border-t-0"
          />
        </div>
      )}

      {filterOpen && (
        <FilterModal
          pending={pendingFilter}
          onChange={(key, val) =>
            setPendingFilter((p) => ({ ...p, [key]: val }))
          }
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
