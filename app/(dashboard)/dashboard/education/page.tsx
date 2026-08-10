"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/dashboard/pagination";
import { IconPlus, IconFilter } from "@/components/ui/icons";
import { SessionList } from "./session-list";
import type { Session } from "./types";

const PAGE_SIZE = 10;

type SessionFilter = { access: string };
const emptySessionFilter: SessionFilter = { access: "" };

const fieldCls =
  "border-sand-200 text-petroleum-500 placeholder:text-petroleum-300 w-full rounded-xl border bg-white px-3 py-2.5 text-sm focus:outline-none focus:border-petroleum-300";

function FilterModal({
  pending,
  onChange,
  onApply,
  onClear,
  onClose,
}: {
  pending: SessionFilter;
  onChange: (key: keyof SessionFilter, value: string) => void;
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
              {t("education.filters.access")}
            </span>
            <select
              value={pending.access}
              onChange={(e) => onChange("access", e.target.value)}
              className={fieldCls}
            >
              <option value="">{t("education.access.all")}</option>
              <option value="members_only">
                {t("education.access.members_only")}
              </option>
              <option value="open">{t("education.access.open")}</option>
              <option value="paid">{t("education.access.paid")}</option>
              <option value="paid_members_free">
                {t("education.access.paid_members_free")}
              </option>
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

export default function EducationPage() {
  const t = useTranslations("dashboard");
  const locale = useDashboardLocale();
  const [page, setPage] = useState(0);
  const [state, setState] = useState<{
    sessions: Session[];
    loading: boolean;
    total: number;
  }>({ sessions: [], loading: true, total: 0 });
  const { sessions, loading, total } = state;

  const [appliedFilter, setAppliedFilter] =
    useState<SessionFilter>(emptySessionFilter);
  const [pendingFilter, setPendingFilter] =
    useState<SessionFilter>(emptySessionFilter);
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
    setAppliedFilter(emptySessionFilter);
    setPendingFilter(emptySessionFilter);
    setPage(0);
    setFilterOpen(false);
  }

  const { push } = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let query = insforge.database
        .from("education_sessions")
        .select(
          "id, title, description, date, duration_minutes, location, max_participants, image_url, access",
          { count: "exact" },
        )
        .order("date", { ascending: false });

      if (appliedFilter.access) {
        query = query.eq("access", appliedFilter.access);
      }

      const { data: rows, count } = await query.range(
        page * PAGE_SIZE,
        page * PAGE_SIZE + PAGE_SIZE - 1,
      );

      if (cancelled) return;

      if (!rows || (rows as unknown[]).length === 0) {
        setState({ sessions: [], loading: false, total: count ?? 0 });
        return;
      }

      const sessionList = rows as Omit<Session, "registrations_count">[];
      const ids = sessionList.map((s) => s.id);

      const { data: regs } = await insforge.database
        .from("education_registrations")
        .select("session_id")
        .in("session_id", ids);

      if (cancelled) return;

      const countMap: Record<string, number> = {};
      if (regs) {
        for (const r of regs as { session_id: string }[]) {
          countMap[r.session_id] = (countMap[r.session_id] ?? 0) + 1;
        }
      }

      setState({
        sessions: sessionList.map((s) => ({
          ...s,
          registrations_count: countMap[s.id] ?? 0,
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
          href="/dashboard/education/new"
          className="gap-2"
        >
          <IconPlus />
          {t("education.createSession")}
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
      <SessionList
        sessions={sessions}
        loading={loading}
        locale={locale}
        onOpen={(id) => push(`/dashboard/education/${id}/edit`)}
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
          onChange={(key, value) =>
            setPendingFilter((prev) => ({ ...prev, [key]: value }))
          }
          onApply={applyFilters}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
