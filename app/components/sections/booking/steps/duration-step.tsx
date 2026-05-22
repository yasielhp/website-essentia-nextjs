"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, X } from "lucide-react";
import { insforge } from "@/lib/insforge";

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
};

export type TierSelection = {
  tierId: string;
  label: string | null;
  duration: string | null;
  price: number | null;
};

function tierLabel(t: Tier, fallback: string): string {
  const parts: string[] = [];
  if (t.label) parts.push(t.label);
  if (t.duration_minutes != null) parts.push(`${t.duration_minutes} min`);
  if (t.price_eur != null) parts.push(`€${t.price_eur}`);
  return parts.join(" · ") || fallback;
}

function TierItems({
  tiers,
  selectedId,
  onSelect,
}: {
  tiers: Tier[];
  selectedId: string | null;
  onSelect: (t: Tier) => void;
}) {
  const tt = useTranslations("booking.durationStep");
  return (
    <div className="p-3">
      {tiers.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className="hover:bg-sand-100 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-petroleum-700 font-medium">
              {t.label ?? tt("standard")}
            </span>
            {(t.duration_minutes != null || t.price_eur != null) && (
              <span className="text-petroleum-400 text-xs">
                {[
                  t.duration_minutes != null
                    ? `${t.duration_minutes} min`
                    : null,
                  t.price_eur != null ? `€${t.price_eur}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>
          {selectedId === t.id && (
            <Check className="text-petroleum-700 shrink-0" size={14} />
          )}
        </button>
      ))}
    </div>
  );
}

function TierSelect({
  tiers,
  selectedId,
  onSelect,
}: {
  tiers: Tier[];
  selectedId: string | null;
  onSelect: (t: Tier) => void;
}) {
  const tt = useTranslations("booking.durationStep");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selected = tiers.find((t) => t.id === selectedId) ?? null;

  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    });
  };

  useEffect(() => {
    if (!isOpen || isMobile()) return;
    updatePosition();
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    const handleScroll = () => updatePosition();
    document.addEventListener("mousedown", handleClose);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClose);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isMobile()) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSelect = (t: Tier) => {
    onSelect(t);
    setIsOpen(false);
  };

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        {selected ? (
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-petroleum-400 text-xs">{tt("sessionType")}</p>
            <p className="text-petroleum-700 font-medium">
              {tierLabel(selected, tt("standard"))}
            </p>
          </div>
        ) : (
          <p className="text-petroleum-400 flex-1 text-sm">
            {tt("selectSessionType")}
          </p>
        )}
        <ChevronDown
          className={[
            "shrink-0 transition-transform duration-200",
            selected ? "text-petroleum-400" : "text-petroleum-100",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {/* Desktop: dropdown portal */}
      {isOpen &&
        !isMobile() &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] max-h-96 overflow-y-auto rounded-2xl border shadow-lg"
          >
            <TierItems
              tiers={tiers}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          </div>,
          document.body,
        )}

      {/* Mobile: full-screen modal */}
      {isOpen &&
        isMobile() &&
        createPortal(
          <div className="animate-slide-up-modal fixed inset-0 z-50 flex flex-col bg-white">
            <div className="border-sand-100 flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-petroleum-700 font-medium">
                {tt("modalTitle")}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label={tt("close")}
              >
                <X size={20} className="text-petroleum-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TierItems
                tiers={tiers}
                selectedId={selectedId}
                onSelect={handleSelect}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export function DurationStep({
  serviceId,
  selectedTierId,
  onSelect,
  preselectedLabel,
}: {
  serviceId: string;
  selectedTierId: string | null;
  onSelect: (sel: TierSelection) => void;
  preselectedLabel?: string | null;
}) {
  const tt = useTranslations("booking.durationStep");
  const [tiers, setTiers] = useState<Tier[] | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("service_tiers")
        .select("id, label, duration_minutes, price_eur, price_center_eur")
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");
      const rows = (data as Tier[] | null) ?? [];
      setTiers(rows);
      if (rows.length === 1 && rows[0]) {
        const t = rows[0];
        onSelectRef.current({
          tierId: t.id,
          label: t.label,
          duration:
            t.duration_minutes != null ? `${t.duration_minutes} min` : null,
          price: t.price_center_eur ?? t.price_eur,
        });
      } else if (preselectedLabel) {
        const match = rows.find(
          (t) => t.label?.toLowerCase() === preselectedLabel.toLowerCase(),
        );
        if (match) {
          onSelectRef.current({
            tierId: match.id,
            label: match.label,
            duration:
              match.duration_minutes != null
                ? `${match.duration_minutes} min`
                : null,
            price: match.price_center_eur ?? match.price_eur,
          });
        }
      }
    }
    void load();
  }, [serviceId, preselectedLabel]);

  if (tiers === null) {
    return (
      <div className="border-sand-300 bg-sand-50 h-16 animate-pulse rounded-2xl border" />
    );
  }

  if (tiers.length === 0) {
    return <p className="text-petroleum-400 text-sm">{tt("noneAvailable")}</p>;
  }

  const isFixed = tiers.length === 1;
  const singleTier = tiers[0]!;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        {isFixed ? tt("fixedDescription") : tt("chooseDescription")}
      </p>
      {isFixed ? (
        <div className="border-sand-300 bg-sand-50 flex items-center gap-4 rounded-2xl border p-4">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-petroleum-400 text-xs">{tt("sessionType")}</p>
            <p className="text-petroleum-700 font-medium">
              {tierLabel(singleTier, tt("standard"))}
            </p>
          </div>
          <Check className="text-petroleum-100 shrink-0" size={16} />
        </div>
      ) : (
        <TierSelect
          tiers={tiers}
          selectedId={selectedTierId}
          onSelect={(t) =>
            onSelect({
              tierId: t.id,
              label: t.label,
              duration:
                t.duration_minutes != null ? `${t.duration_minutes} min` : null,
              price: t.price_center_eur ?? t.price_eur,
            })
          }
        />
      )}
    </div>
  );
}
