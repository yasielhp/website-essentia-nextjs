"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, X } from "lucide-react";
import { insforge } from "@/lib/insforge";
import {
  TierPicker,
  TierSummaryCard,
  type TierPickerOption,
} from "@/components/ui/tier-picker";

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
  image_url: string | null;
  color: string | null;
};

/** The picker takes a resolved price; the public flow always pays centre rates. */
function toPickerOption(t: Tier): TierPickerOption {
  return {
    id: t.id,
    label: t.label,
    durationMinutes: t.duration_minutes,
    price: t.price_center_eur ?? t.price_eur,
    imageUrl: t.image_url,
    color: t.color,
  };
}

export type TierSelection = {
  tierId: string;
  label: string | null;
  duration: string | null;
  price: number | null;
};

type GenderOption = {
  id: "male" | "female";
  label: string;
};

function GenderItems({
  options,
  selected,
  onSelect,
}: {
  options: GenderOption[];
  selected: "male" | "female" | null;
  onSelect: (g: "male" | "female") => void;
}) {
  return (
    <div className="p-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className="hover:bg-sand-100 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]"
        >
          <span className="text-petroleum-700 font-medium">{opt.label}</span>
          {selected === opt.id && (
            <Check className="text-petroleum-700 shrink-0" size={14} />
          )}
        </button>
      ))}
    </div>
  );
}

function TherapistGenderSelect({
  selected,
  onSelect,
}: {
  selected: "male" | "female" | null;
  onSelect: (g: "male" | "female") => void;
}) {
  const tt = useTranslations("booking.durationStep");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const options: GenderOption[] = [
    { id: "male", label: tt("therapistMale") },
    { id: "female", label: tt("therapistFemale") },
  ];

  const selectedOption = options.find((o) => o.id === selected) ?? null;

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

  const handleSelect = (g: "male" | "female") => {
    onSelect(g);
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
        {selectedOption ? (
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-petroleum-400 text-xs">{tt("therapistLabel")}</p>
            <p className="text-petroleum-700 font-medium">
              {selectedOption.label}
            </p>
          </div>
        ) : (
          <p className="text-petroleum-400 flex-1 text-sm">
            {tt("selectTherapist")}
          </p>
        )}
        <ChevronDown
          className={[
            "shrink-0 transition-transform duration-200",
            selectedOption ? "text-petroleum-400" : "text-petroleum-100",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {isOpen &&
        !isMobile() &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] max-h-96 overflow-y-auto rounded-2xl border shadow-lg"
          >
            <GenderItems
              options={options}
              selected={selected}
              onSelect={handleSelect}
            />
          </div>,
          document.body,
        )}

      {isOpen &&
        isMobile() &&
        createPortal(
          <div className="animate-slide-up-modal fixed inset-0 z-50 flex flex-col bg-white">
            <div className="border-sand-100 flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-petroleum-700 font-medium">
                {tt("therapistModalTitle")}
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
              <GenderItems
                options={options}
                selected={selected}
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
  therapistGender,
  onSelect,
  onSelectGender,
  preselectedLabel,
}: {
  serviceId: string;
  selectedTierId: string | null;
  therapistGender: "male" | "female" | null;
  onSelect: (sel: TierSelection) => void;
  onSelectGender: (g: "male" | "female") => void;
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
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, image_url, color",
        )
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
  const options = tiers.map(toPickerOption);

  const isManualTherapies = serviceId === "manual-therapies";

  const pickerLabels = {
    fieldLabel: tt("sessionType"),
    placeholder: tt("selectSessionType"),
    modalTitle: tt("modalTitle"),
    close: tt("close"),
    standard: tt("standard"),
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        {isFixed ? tt("fixedDescription") : tt("chooseDescription")}
      </p>
      {isFixed ? (
        <TierSummaryCard option={options[0]!} labels={pickerLabels} />
      ) : (
        <TierPicker
          options={options}
          selectedId={selectedTierId}
          labels={pickerLabels}
          onSelect={(o) =>
            onSelect({
              tierId: o.id,
              label: o.label,
              duration:
                o.durationMinutes != null ? `${o.durationMinutes} min` : null,
              price: o.price,
            })
          }
        />
      )}
      {/* Only once a session type is chosen — the preference is about that
          session, so asking first put the question before its subject. */}
      {isManualTherapies && selectedTierId !== null && (
        <div className="flex flex-col gap-2">
          <p className="text-petroleum-400 text-sm">
            {tt("therapistDescription")}
          </p>
          <TherapistGenderSelect
            selected={therapistGender}
            onSelect={onSelectGender}
          />
        </div>
      )}
    </div>
  );
}
