"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { IconFilter } from "@/components/ui/icons";
import { Pagination } from "@/components/dashboard/pagination";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { useFieldError } from "@/hooks/use-field-error";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { listSegmentPeople, saveSegment } from "@/actions/campaigns";
import {
  EMPTY_AUDIENCE,
  type CampaignSegment,
  type SegmentPerson,
} from "@/types/campaign";
import {
  activeFilters,
  conditionsToSave,
  isDirty,
  listIsFull,
  removeFilter,
  segmentSentence,
  selectAllShown,
  selectionBanner,
  toggleOne,
  toggleVisible,
  visiblePeople,
  type SegmentFilters,
} from "@/lib/campaigns/segment-people";
import { MAX_LIST_PEOPLE } from "@/lib/campaigns/segment-conditions";
import { UnsavedBar } from "../../../messages/email/page-parts";
import { FilterChips } from "./filter-chips";
import { SegmentFilterModal } from "./filter-modal";
import { SegmentPeopleTable } from "./people-table";

const LIST = "/dashboard/campaigns/segments";
const detailOf = (id: string) => `${LIST}/${id}`;
const PAGE_SIZE = 50;

const NO_FILTERS: SegmentFilters = {
  language: EMPTY_AUDIENCE.language,
  newsletter: EMPTY_AUDIENCE.newsletter,
  services: EMPTY_AUDIENCE.services,
  lastBooking: EMPTY_AUDIENCE.lastBooking,
  neverBooked: EMPTY_AUDIENCE.neverBooked,
  hasBooked: false,
};

type People =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; people: SegmentPerson[] };

/** What a saved segment starts the form with: its filters, or its people. */
function startOf(segment?: CampaignSegment) {
  const c = segment?.conditions;
  const filters: SegmentFilters = c
    ? {
        language: c.language,
        newsletter: c.newsletter,
        services: c.services,
        lastBooking: c.lastBooking,
        neverBooked: c.neverBooked,
        hasBooked: c.hasBooked ?? false,
      }
    : NO_FILTERS;
  const selected = new Set(c?.manualOnly ? (c.manualIds ?? []) : []);
  return { name: segment?.name ?? "", filters, selected };
}

/**
 * One segment, new or existing, made on one screen: everyone in a table, with
 * the filters to find people and a checkbox to pick them. A segment with nobody
 * picked is a FILTER (it keeps including whoever meets it later); with people
 * picked it is a LIST (only them, whether or not they meet the filters). The
 * sentence under the header says which, always. A list never skips an exclusion
 * when it is sent: that is the engine's, not this screen's.
 */
export function SegmentForm({ segment }: { segment?: CampaignSegment }) {
  const t = useTranslations("dashboard.campaigns.segments");
  const tForm = useTranslations("dashboard.campaigns.segments.form");
  const tSeg = useTranslations("dashboard.campaigns.segment");
  const tCommon = useTranslations("dashboard.common");
  const tToasts = useTranslations("dashboard.toasts");
  const fieldError = useFieldError();
  const locale = useDashboardLocale();
  const { push } = useRouter();

  const start = useMemo(() => startOf(segment), [segment]);
  const [name, setName] = useState(start.name);
  const [filters, setFilters] = useState<SegmentFilters>(start.filters);
  const [selected, setSelected] = useState<ReadonlySet<string>>(start.selected);
  const [search, setSearch] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [page, setPage] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [pending, setPending] = useState<SegmentFilters>(start.filters);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<People>({ status: "loading" });
  // A date that does not move while the admin works.
  const [now] = useState(() => new Date());

  useDynamicBreadcrumb(segment?.name ?? null);

  useEffect(() => {
    let cancelled = false;
    void listSegmentPeople(getAccessToken())
      .catch(() => ({ ok: false as const, error: "generic" }))
      .then((result) => {
        if (cancelled) return;
        setLoaded(
          result.ok
            ? { status: "ready", people: result.people }
            : { status: "error" },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const dirty = isDirty(start, { name, filters, selected });
  const guard = useUnsavedGuard(dirty);

  const people = useMemo(
    () => (loaded.status === "ready" ? loaded.people : []),
    [loaded],
  );
  const shown = useMemo(
    () =>
      visiblePeople({ people, filters, search, onlySelected, selected, now }),
    [people, filters, search, onlySelected, selected, now],
  );
  const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const rows = shown.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // Whoever was deleted since simply stops counting.
  const existing = useMemo(() => new Set(people.map((p) => p.id)), [people]);
  const selectedCount =
    loaded.status === "ready"
      ? [...selected].filter((id) => existing.has(id)).length
      : selected.size;
  const matching = useMemo(
    () =>
      visiblePeople({
        people,
        filters,
        search: "",
        onlySelected: false,
        selected,
        now,
      }).length,
    [people, filters, selected, now],
  );
  const sentence = segmentSentence(selectedCount, matching);
  // After the header checkbox has taken a page: offer the rest of who matches.
  const banner = selectionBanner({
    pageIds: rows.map((p) => p.id),
    shownIds: shown.map((p) => p.id),
    selected,
  });
  const filterCount = activeFilters(filters).length;

  function openFilters() {
    setPending(filters);
    setFilterOpen(true);
  }
  function applyFilters() {
    setFilters(pending);
    setPage(0);
    setFilterOpen(false);
  }
  function changeFilters(next: SegmentFilters) {
    setFilters(next);
    setPage(0);
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(fieldError("nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    // Only the people who still exist are saved.
    const keep =
      loaded.status === "ready"
        ? new Set([...selected].filter((id) => existing.has(id)))
        : selected;
    const result = await saveSegment(getAccessToken(), {
      id: segment?.id ?? null,
      name: trimmed,
      conditions: conditionsToSave(filters, keep),
    }).catch(() => ({ ok: false as const, error: "generic" }));
    setSaving(false);
    if (!result.ok) {
      setError(
        result.error === "nameTaken"
          ? fieldError("nameTaken")
          : // A list too long is refused as invalid: say why, not "could not save".
            result.error === "invalid" && keep.size > MAX_LIST_PEOPLE
            ? tForm("listFull")
            : tSeg("saveFailed"),
      );
      return;
    }
    notifySuccess(tToasts("segmentSaved"));
    push(result.segment ? detailOf(result.segment.id) : LIST);
  }

  const empty =
    loaded.status === "ready" && shown.length === 0
      ? people.length === 0
        ? tForm("noPeople")
        : onlySelected
          ? tForm("searchEmpty")
          : search.trim() !== "" && filterCount === 0
            ? tForm("searchEmpty")
            : tForm("filteredEmpty")
      : null;

  return (
    <div className="flex flex-col gap-5 px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-display text-petroleum-700 min-w-0 text-3xl break-words">
          {segment ? segment.name : t("new")}
        </h1>
        <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
          <Button
            variant={filterCount > 0 ? "soft" : "outline"}
            onClick={openFilters}
            disabled={saving}
            className="gap-2"
          >
            <IconFilter />
            {filterCount > 0
              ? tCommon("filtersWithCount", { count: filterCount })
              : tCommon("filters")}
          </Button>
          <Button
            disabled={
              saving || name.trim() === "" || selected.size > MAX_LIST_PEOPLE
            }
            onClick={() => void save()}
          >
            {saving ? tSeg("saving") : tCommon("save")}
          </Button>
        </div>
      </header>

      {guard.pending && (
        <UnsavedBar onStay={guard.stay} onLeave={guard.leave} />
      )}

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="segment-name"
            className="text-petroleum-500 text-xs font-medium"
          >
            {tSeg("name")}
          </label>
          <input
            id="segment-name"
            type="text"
            autoFocus={!segment}
            value={name}
            disabled={saving}
            placeholder={tSeg("namePlaceholder")}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "segment-name-error" : undefined}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
          />
          {error && (
            <p
              id="segment-name-error"
              role="alert"
              className="text-xs text-red-500"
            >
              {error}
            </p>
          )}
        </div>
      </section>

      <FilterChips
        filters={filters}
        onRemove={(id) => changeFilters(removeFilter(filters, id))}
        onClear={() => changeFilters(NO_FILTERS)}
      />

      {loaded.status === "ready" && (
        <p
          aria-live="polite"
          className="text-petroleum-500 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
        >
          <span>
            {sentence.key === "list"
              ? tForm("listSentence", { count: sentence.count })
              : tForm("filterSentence", { count: sentence.count })}
          </span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setOnlySelected(false);
              }}
              className="text-petroleum-700 min-h-8 font-medium underline underline-offset-2"
            >
              {tForm("clearSelection")}
            </button>
          )}
        </p>
      )}

      {listIsFull(selected) && (
        <p role="status" className="text-sm font-medium text-yellow-800">
          {tForm("listFull")}
        </p>
      )}

      <section className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
        <div className="border-sand-100 flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={tForm("search")}
            aria-label={tForm("search")}
            className={`${INPUT_CLASS} sm:max-w-sm`}
          />
          <div className="flex flex-wrap items-center gap-3">
            {loaded.status === "ready" && (
              <p className="text-petroleum-400 text-xs">
                {tForm("shown", { count: shown.length })}
              </p>
            )}
            <button
              type="button"
              aria-pressed={onlySelected}
              disabled={selected.size === 0 && !onlySelected}
              onClick={() => {
                setOnlySelected((on) => !on);
                setPage(0);
              }}
              className={`min-h-11 rounded-full border px-4 text-sm transition-colors disabled:opacity-50 ${
                onlySelected
                  ? "border-petroleum-700 bg-petroleum-700 text-white"
                  : "border-sand-200 text-petroleum-700 hover:border-petroleum-400 bg-white"
              }`}
            >
              {tForm("onlySelected", { count: selectedCount })}
            </button>
          </div>
        </div>

        {banner && (
          <p
            aria-live="polite"
            className="bg-sand-50 text-petroleum-700 flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-5 py-3 text-sm"
          >
            <span>
              {banner.kind === "page"
                ? tForm("bannerPage", { count: banner.count })
                : tForm("bannerAllDone", { count: banner.count })}
            </span>
            {banner.kind === "page" ? (
              <button
                type="button"
                onClick={() =>
                  setSelected((s) =>
                    selectAllShown(
                      s,
                      shown.map((p) => p.id),
                    ),
                  )
                }
                className="text-petroleum-700 min-h-8 font-medium underline underline-offset-2"
              >
                {tForm("bannerAll", { total: banner.total })}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setOnlySelected(false);
              }}
              className="text-petroleum-700 min-h-8 font-medium underline underline-offset-2"
            >
              {tForm("clearSelection")}
            </button>
          </p>
        )}

        {loaded.status === "loading" ? (
          <TableSkeleton cols={6} />
        ) : loaded.status === "error" ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p role="alert" className="text-petroleum-400 text-sm">
              {tForm("loadFailed")}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setLoaded({ status: "loading" });
                setAttempt((n) => n + 1);
              }}
            >
              {tForm("retry")}
            </Button>
          </div>
        ) : empty ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="text-petroleum-400 text-sm">{empty}</p>
            {filterCount > 0 && (
              <Button
                variant="outline"
                onClick={() => changeFilters(NO_FILTERS)}
              >
                {tForm("clearFilters")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <SegmentPeopleTable
              rows={rows}
              selected={selected}
              locale={locale}
              onToggle={(id) => setSelected((s) => toggleOne(s, id))}
              onToggleVisible={() =>
                setSelected((s) =>
                  toggleVisible(
                    s,
                    rows.map((p) => p.id),
                  ),
                )
              }
            />
            {totalPages > 1 && (
              <Pagination
                page={safePage}
                totalPages={totalPages}
                onPage={setPage}
              />
            )}
          </>
        )}
      </section>

      {filterOpen && (
        <SegmentFilterModal
          pending={pending}
          onChange={setPending}
          onApply={applyFilters}
          onClear={() => setPending(NO_FILTERS)}
          onClose={() => setFilterOpen(false)}
        />
      )}
    </div>
  );
}
