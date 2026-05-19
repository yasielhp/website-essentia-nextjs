"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";

type RaceAccess = "members" | "open";

type Race = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  image_url: string | null;
  access: RaceAccess;
  created_at: string | null;
  registrations_count: number;
};

const PAGE_SIZE = 10;

const RACE_ACCESS_LABELS: Record<RaceAccess, string> = {
  members: "Members only",
  open: "Open · free",
};

const RACE_ACCESS_COLORS: Record<RaceAccess, string> = {
  members: "bg-petroleum-50 text-petroleum-500",
  open: "bg-green-50 text-green-700",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function IconPlus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconFilter() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 6h16M7 12h10M10 18h4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">Filters</h3>
          <button
            onClick={onClose}
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
              Access
            </span>
            <select
              value={pending.access}
              onChange={(e) => onChange("access", e.target.value)}
              className={fieldCls}
            >
              <option value="">All</option>
              <option value="members">Members only</option>
              <option value="open">Open · free</option>
            </select>
          </label>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onClear}
            className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors"
          >
            Clear all
          </button>
          <Button variant="solid" size="md" onClick={onApply}>
            Apply filters
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RacesPage() {
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
          Create Race
        </Button>
        <Button
          variant={activeFilterCount > 0 ? "soft" : "outline"}
          size="md"
          onClick={openModal}
          className="gap-2"
        >
          <IconFilter />
          Filters{activeFilterCount > 0 ? ` [${activeFilterCount}]` : ""}
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="border-sand-200 divide-sand-200 mb-4 divide-y overflow-hidden rounded-2xl border bg-white sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-stretch">
              <div className="bg-sand-100 w-20 shrink-0 animate-pulse" />
              <div className="min-w-0 flex-1 px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="bg-sand-100 h-4 w-36 animate-pulse rounded" />
                  <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
                </div>
                <div className="bg-sand-100 mt-2 h-3 w-40 animate-pulse rounded" />
                <div className="bg-sand-100 mt-1 h-3 w-28 animate-pulse rounded" />
              </div>
            </div>
          ))
        ) : races.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            No races yet.
          </p>
        ) : (
          races.map((race) => (
            <div
              key={race.id}
              onClick={() => push(`/dashboard/races/${race.id}/edit`)}
              className="hover:bg-sand-50 flex cursor-pointer items-stretch transition-colors"
            >
              <div className="bg-sand-100 relative w-20 shrink-0 overflow-hidden">
                {race.image_url ? (
                  <Image
                    src={race.image_url}
                    alt={race.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                ) : (
                  <div className="bg-petroleum-700/10 flex size-full items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-petroleum-400"
                    >
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx="8.5"
                        cy="8.5"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d="M21 15l-5-5L5 21"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 px-5 py-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-petroleum-700 truncate font-medium">
                    {race.title}
                  </p>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RACE_ACCESS_COLORS[race.access]}`}
                  >
                    {RACE_ACCESS_LABELS[race.access]}
                  </span>
                </div>
                <p className="text-petroleum-400 mt-1 text-xs">
                  {formatDate(race.date)}
                  {race.location ? ` · ${race.location}` : ""}
                </p>
                <p className="text-petroleum-400 mt-0.5 text-xs">
                  {race.distance_km != null ? `${race.distance_km} km · ` : ""}
                  {race.registrations_count}
                  {race.max_participants != null
                    ? ` / ${race.max_participants} registered`
                    : " registered"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Table (desktop only) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="w-14 px-4 py-3.5"></th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Title
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Access
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Date
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Location
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Distance
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Registered / Max
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    {/* Image thumbnail */}
                    <td className="px-4 py-3"><div className="bg-sand-100 size-10 animate-pulse rounded-lg" /></td>
                    {/* Title */}
                    <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-40 animate-pulse rounded" /></td>
                    {/* Access badge */}
                    <td className="px-5 py-4"><div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" /></td>
                    {/* Date */}
                    <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-24 animate-pulse rounded" /></td>
                    {/* Location */}
                    <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-32 animate-pulse rounded" /></td>
                    {/* Distance */}
                    <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-16 animate-pulse rounded" /></td>
                    {/* Registered/Max */}
                    <td className="px-5 py-4"><div className="bg-sand-100 h-4 w-20 animate-pulse rounded" /></td>
                  </tr>
                ))
              ) : races.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No races yet.
                  </td>
                </tr>
              ) : (
                races.map((race) => (
                  <tr
                    key={race.id}
                    onClick={() => push(`/dashboard/races/${race.id}/edit`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        push(`/dashboard/races/${race.id}/edit`);
                    }}
                    tabIndex={0}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="bg-sand-100 relative size-10 shrink-0 overflow-hidden rounded-lg">
                        {race.image_url ? (
                          <Image
                            src={race.image_url}
                            alt={race.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        ) : (
                          <div className="bg-petroleum-700/10 flex size-full items-center justify-center">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              className="text-petroleum-400"
                            >
                              <rect
                                x="3"
                                y="3"
                                width="18"
                                height="18"
                                rx="3"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx="8.5"
                                cy="8.5"
                                r="1.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <path
                                d="M21 15l-5-5L5 21"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-petroleum-700 px-5 py-4 font-medium">
                      {race.title}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${RACE_ACCESS_COLORS[race.access]}`}
                      >
                        {RACE_ACCESS_LABELS[race.access]}
                      </span>
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {formatDate(race.date)}
                    </td>
                    <td className="text-petroleum-400 px-5 py-4">
                      {race.location ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      {race.distance_km != null ? (
                        `${race.distance_km} km`
                      ) : (
                        <span className="text-petroleum-400">{"—"}</span>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-5 py-4">
                      <span
                        className={
                          race.max_participants != null &&
                          race.registrations_count >= race.max_participants
                            ? "font-medium text-red-500"
                            : ""
                        }
                      >
                        {race.registrations_count}
                      </span>
                      {race.max_participants != null ? (
                        <span className="text-petroleum-400">
                          {" "}
                          / {race.max_participants}
                        </span>
                      ) : (
                        <span className="text-petroleum-400">{" / —"}</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
