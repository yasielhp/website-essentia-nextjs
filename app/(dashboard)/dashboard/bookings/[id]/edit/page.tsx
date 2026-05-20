"use client";

import { useState, useEffect, useRef, useReducer } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Building2,
  Home,
  BedDouble,
} from "lucide-react";
import { insforge } from "@/lib/insforge";
import { bookableServices } from "@/data/services-data";
import { notifyBooking } from "@/actions/booking-notifications";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { useRole } from "@/context/role-context";
import { Button } from "@/components/ui/button";
import { INPUT_CLASS } from "@/constants/form-styles";
import { contact } from "@/constants/contact";
import { TIME_SLOTS } from "@/constants/booking";
import {
  MONTH_NAMES,
  DAY_NAMES,
  isAvailableDay,
  isSameDay,
  getCalendarDays,
} from "@/utils/calendar-helpers";

// ─── Types ────────────────────────────────────────────────────

type Service = {
  id: string;
  title: string;
  image?: string;
  description?: string;
  category?: string;
};

type Tier = {
  id: string;
  label: string | null;
  duration_minutes: number | null;
  price_eur: number | null;
  price_center_eur: number | null;
  price_suite_eur: number | null;
};

function resolvePrice(
  tier: Tier,
  location: DashboardLocation | "",
): number | null {
  if (location === "habitacion") {
    return tier.price_suite_eur ?? tier.price_center_eur ?? tier.price_eur;
  }
  return tier.price_center_eur ?? tier.price_eur;
}

type DashboardLocation = "centro" | "habitacion" | "domicilio";

type LocationAddress = {
  street: string;
  building: string;
  postalCode: string;
  municipality: string;
};

type BookingStatus = "pending" | "confirmed" | "cancelled";

// ─── Constants ────────────────────────────────────────────────

const TENERIFE_MUNICIPALITIES = [
  "Adeje",
  "Arona",
  "Granadilla de Abona",
  "Guía de Isora",
  "San Miguel de Abona",
  "Santiago del Teide",
  "Los Cristianos",
  "Playa de las Américas",
  "Costa Adeje",
  "El Médano",
  "Los Abrigos",
  "Puerto de la Cruz",
  "Santa Cruz de Tenerife",
  "San Cristóbal de La Laguna",
  "Los Realejos",
  "Candelaria",
  "Güímar",
];

const LOCATIONS: {
  id: DashboardLocation;
  label: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  {
    id: "centro",
    label: "At the center",
    description: contact.address,
    Icon: Building2,
  },
  {
    id: "habitacion",
    label: "Room",
    description: "Baobab Suites room",
    Icon: BedDouble,
  },
  {
    id: "domicilio",
    label: "Home visit",
    description: "We come to your address",
    Icon: Home,
  },
];

const EMPTY_ADDRESS: LocationAddress = {
  street: "",
  building: "",
  postalCode: "",
  municipality: "",
};

const STATUSES: {
  id: BookingStatus;
  label: string;
  description: string;
  dot: string;
}[] = [
  {
    id: "pending",
    label: "Pending",
    description: "Awaiting confirmation",
    dot: "bg-yellow-400",
  },
  {
    id: "confirmed",
    label: "Confirmed",
    description: "Appointment confirmed",
    dot: "bg-green-500",
  },
  {
    id: "cancelled",
    label: "Cancelled",
    description: "Appointment cancelled",
    dot: "bg-red-400",
  },
];

// ─── Helpers ──────────────────────────────────────────────────

function tierLabel(t: Tier): string {
  const parts: string[] = [];
  if (t.label) parts.push(t.label);
  if (t.duration_minutes != null) parts.push(`${t.duration_minutes} min`);
  if (t.price_eur != null) parts.push(`€${t.price_eur}`);
  return parts.join(" · ") || "Standard";
}

const DROPDOWN_MAX_H = 320;

const isMobile = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 767px)").matches;

function useDropdownPortal(isOpen: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUpward = spaceBelow < DROPDOWN_MAX_H && rect.top > DROPDOWN_MAX_H;
    setDropdownStyle({
      position: "fixed",
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 8 }
        : { top: rect.bottom + 8 }),
      left: rect.left,
      width: rect.width,
      maxHeight: openUpward ? rect.top - 16 : spaceBelow,
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const handleScroll = () => updatePosition();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  return { triggerRef, dropdownRef, dropdownStyle };
}

// ─── Service Select ───────────────────────────────────────────

function ServiceItems({
  services,
  selectedId,
  onSelect,
  imageClass = "size-12",
  imageSizes = "48px",
}: {
  services: Service[];
  selectedId: string | null;
  onSelect: (s: Service) => void;
  imageClass?: string;
  imageSizes?: string;
}) {
  const wellness = services.filter((s) => s.category === "wellness" || !s.category);
  const medicine = services.filter((s) => s.category === "medicine");

  const row = (s: Service) => (
    <button
      key={s.id}
      type="button"
      onClick={() => onSelect(s)}
      className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
    >
      {s.image ? (
        <div className={`relative ${imageClass} shrink-0 overflow-hidden rounded-lg`}>
          <Image src={s.image} alt={s.title} fill sizes={imageSizes} className="object-cover" />
        </div>
      ) : (
        <div className={`bg-petroleum-100 flex ${imageClass} shrink-0 items-center justify-center rounded-lg`}>
          <span className="text-petroleum-700 text-sm font-bold">{s.title[0]?.toUpperCase()}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="text-petroleum-700 text-sm font-medium">{s.title}</p>
        {s.description && (
          <p className="text-petroleum-400 line-clamp-1 text-xs">{s.description}</p>
        )}
        {s.category && (
          <p className="text-petroleum-500 text-xs capitalize">{s.category}</p>
        )}
      </div>
      {selectedId === s.id && (
        <Check className="text-petroleum-700 shrink-0" size={14} />
      )}
    </button>
  );

  return (
    <div className="p-3">
      {wellness.length > 0 && (
        <>
          <p className="text-petroleum-500 p-2 text-xs tracking-widest uppercase">Wellness</p>
          {wellness.map(row)}
        </>
      )}
      {medicine.length > 0 && (
        <>
          <p className="text-petroleum-500 mt-2 p-2 text-xs tracking-widest uppercase">Medicine</p>
          {medicine.map(row)}
        </>
      )}
    </div>
  );
}

function ServiceSelect({
  services,
  selected,
  onSelect,
}: {
  services: Service[];
  selected: Service | null;
  onSelect: (s: Service) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);

  useEffect(() => {
    if (!isOpen || isMobile()) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

  useEffect(() => {
    if (!isOpen || !isMobile()) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSelect = (s: Service) => {
    onSelect(s);
    setIsOpen(false);
  };

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        {selected ? (
          <>
            {selected.image ? (
              <div className="animate-fade-in-up relative size-16 shrink-0 overflow-hidden rounded-xl">
                <Image src={selected.image} alt={selected.title} fill sizes="64px" className="object-cover" />
              </div>
            ) : (
              <div className="animate-fade-in-up bg-petroleum-100 flex size-16 shrink-0 items-center justify-center rounded-xl">
                <span className="text-petroleum-700 text-xl font-bold">{selected.title[0]?.toUpperCase()}</span>
              </div>
            )}
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              <p className="text-petroleum-700 font-medium">{selected.title}</p>
              {selected.description && (
                <p className="text-petroleum-400 line-clamp-1 text-sm">{selected.description}</p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-sand-200 flex size-16 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-100 text-lg">+</span>
            </div>
            <p className="text-petroleum-400 flex-1 text-sm">
              Select a service
            </p>
          </>
        )}
        <ChevronDown
          className={[
            "text-petroleum-400 shrink-0 transition-transform duration-200",
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
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-y-auto rounded-2xl border shadow-lg"
          >
            <ServiceItems
              services={services}
              selectedId={selected?.id ?? null}
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
              <h3 className="text-petroleum-700 font-medium">Select a service</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-petroleum-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ServiceItems
                services={services}
                selectedId={selected?.id ?? null}
                onSelect={handleSelect}
                imageClass="size-16"
                imageSizes="64px"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Tier Select ──────────────────────────────────────────────

function TierItems({
  tiers,
  selectedId,
  onSelect,
}: {
  tiers: Tier[];
  selectedId: string;
  onSelect: (t: Tier) => void;
}) {
  return (
    <div className="p-3">
      {tiers.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t)}
          className="hover:bg-sand-100 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all duration-150 active:scale-[0.98]"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-petroleum-700 font-medium">
              {t.label ?? "Standard"}
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
  selectedId: string;
  onSelect: (t: Tier) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const selected = tiers.find((t) => t.id === selectedId) ?? null;

  useEffect(() => {
    if (!isOpen || isMobile()) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

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

  if (tiers.length === 1) {
    return (
      <div className="border-sand-300 bg-sand-50 flex items-center gap-4 rounded-2xl border p-4">
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-petroleum-400 text-xs">Duration & Price</p>
          <p className="text-petroleum-700 font-medium">
            {tierLabel(tiers[0]!)}
          </p>
        </div>
        <Check className="text-petroleum-100 shrink-0" size={16} />
      </div>
    );
  }

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
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
            <p className="text-petroleum-400 text-xs">Duration & Price</p>
            <p className="text-petroleum-700 font-medium">
              {tierLabel(selected)}
            </p>
          </div>
        ) : (
          <p className="text-petroleum-400 flex-1 text-sm">
            Select a duration & price
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
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-y-auto rounded-2xl border shadow-lg"
          >
            <TierItems tiers={tiers} selectedId={selectedId} onSelect={handleSelect} />
          </div>,
          document.body,
        )}

      {/* Mobile: full-screen modal */}
      {isOpen &&
        isMobile() &&
        createPortal(
          <div className="animate-slide-up-modal fixed inset-0 z-50 flex flex-col bg-white">
            <div className="border-sand-100 flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-petroleum-700 font-medium">Select a session type</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label="Close"
              >
                <X size={20} className="text-petroleum-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TierItems tiers={tiers} selectedId={selectedId} onSelect={handleSelect} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Status Select ────────────────────────────────────────────

function StatusSelect({
  selected,
  onSelect,
}: {
  selected: BookingStatus;
  onSelect: (s: BookingStatus) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const active = STATUSES.find((s) => s.id === selected) ?? STATUSES[0]!;

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        <div className="bg-sand-200 flex size-14 shrink-0 items-center justify-center rounded-xl">
          <span className={`size-3.5 rounded-full ${active.dot}`} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <p className="text-petroleum-700 font-medium">{active.label}</p>
          <p className="text-petroleum-400 text-sm">{active.description}</p>
        </div>
        <ChevronDown
          className={[
            "text-petroleum-400 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : "",
          ].join(" ")}
          size={16}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-hidden rounded-2xl border shadow-lg"
          >
            <div className="p-3">
              {STATUSES.map(({ id, label, description, dot }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                  className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
                >
                  <div className="bg-sand-200 flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <span className={`size-3 rounded-full ${dot}`} />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-petroleum-700 text-sm font-medium">
                      {label}
                    </p>
                    <p className="text-petroleum-400 text-xs">{description}</p>
                  </div>
                  {selected === id && (
                    <Check className="text-petroleum-700 shrink-0" size={14} />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Location Select ──────────────────────────────────────────

function LocationSelect({
  selected,
  onSelect,
  locations = LOCATIONS,
}: {
  selected: DashboardLocation | null;
  onSelect: (l: DashboardLocation) => void;
  locations?: typeof LOCATIONS;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { triggerRef, dropdownRef, dropdownStyle } = useDropdownPortal(isOpen);
  const active = locations.find((l) => l.id === selected);
  const single = locations.length === 1;

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClose);
    return () => document.removeEventListener("mousedown", handleClose);
  }, [isOpen, triggerRef, dropdownRef]);

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !single && setIsOpen((o) => !o)}
        className={[
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          single
            ? "border-sand-300 cursor-default"
            : isOpen
              ? "border-petroleum-400 ring-petroleum-100 ring-2"
              : "border-sand-300 hover:border-petroleum-400",
        ].join(" ")}
      >
        {active ? (
          <>
            <div className="bg-sand-200 animate-fade-in-up flex size-14 shrink-0 items-center justify-center rounded-xl">
              <active.Icon size={22} className="text-petroleum-500" />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-petroleum-700 font-medium">{active.label}</p>
              <p className="text-petroleum-400 text-sm">{active.description}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-sand-200 flex size-14 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-100 text-lg">+</span>
            </div>
            <p className="text-petroleum-400 flex-1 text-sm">
              Select a location
            </p>
          </>
        )}
        {!single && (
          <ChevronDown
            className={[
              "text-petroleum-400 shrink-0 transition-transform duration-200",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
            size={16}
          />
        )}
      </button>

      {!single &&
        isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-hidden rounded-2xl border shadow-lg"
          >
            <div className="p-3">
              {locations.map(({ id, label, description, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelect(id);
                    setIsOpen(false);
                  }}
                  className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
                >
                  <div className="bg-sand-200 flex size-12 shrink-0 items-center justify-center rounded-lg">
                    <Icon size={20} className="text-petroleum-500" />
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <p className="text-petroleum-700 text-sm font-medium">
                      {label}
                    </p>
                    <p className="text-petroleum-400 text-xs">{description}</p>
                  </div>
                  {selected === id && (
                    <Check className="text-petroleum-700 shrink-0" size={14} />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────

function CalendarView({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(
    () => selected?.getFullYear() ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    () => selected?.getMonth() ?? today.getMonth(),
  );
  const days = getCalendarDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevMonth}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-petroleum-700 text-sm font-semibold tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </p>
        <button
          type="button"
          onClick={nextMonth}
          className="text-petroleum-400 hover:text-petroleum-700 hover:bg-sand-200 rounded-lg p-2 transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-petroleum-400 py-2 text-center text-xs font-semibold tracking-wide uppercase"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const cellKey = day ? day.toISOString().slice(0, 10) : `empty-${i}`;
          if (!day) return <div key={cellKey} />;
          const available = isAvailableDay(day);
          const isSelected = selected ? isSameDay(day, selected) : false;
          const isToday = isSameDay(day, today);
          return (
            <button
              key={cellKey}
              type="button"
              disabled={!available}
              onClick={() => available && onSelect(day)}
              className={[
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-medium transition-all",
                isSelected
                  ? "bg-petroleum-400 text-sand-50 shadow-sm"
                  : available
                    ? "text-petroleum-700 hover:bg-petroleum-100 border-petroleum-100 bg-petroleum-50 cursor-pointer border"
                    : "text-sand-400 border-sand-200 cursor-not-allowed border opacity-40",
              ].join(" ")}
            >
              {day.getDate()}
              {isToday && !isSelected && (
                <span className="bg-petroleum-400 mt-0.5 size-1 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Delete dialog ────────────────────────────────────────────

function DeleteDialog({
  deleting,
  onConfirm,
  onCancel,
}: {
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex flex-col gap-1">
          <h3 className="font-display text-petroleum-700 text-xl">
            Delete booking?
          </h3>
          <p className="text-petroleum-400 text-sm">
            This booking will be permanently deleted.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            size="md"
            onClick={onConfirm}
            disabled={deleting}
            className="w-full"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </Button>
          <Button
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={deleting}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Async state ──────────────────────────────────────────────

type AsyncState = {
  submitting: boolean;
  error: string | null;
  services: Service[];
  servicesLoading: boolean;
  tiers: Tier[];
  tiersLoading: boolean;
  bookingLoading: boolean;
};

type AsyncAction =
  | { type: "SERVICES_LOADED"; payload: Service[] }
  | { type: "TIERS_LOADING" }
  | { type: "TIERS_LOADED"; payload: Tier[] }
  | { type: "BOOKING_LOADED" }
  | { type: "SUBMIT_START" }
  | { type: "SUBMIT_END" }
  | { type: "SET_ERROR"; payload: string | null };

const asyncInitial: AsyncState = {
  submitting: false,
  error: null,
  services: [],
  servicesLoading: true,
  tiers: [],
  tiersLoading: false,
  bookingLoading: true,
};

function asyncReducer(state: AsyncState, action: AsyncAction): AsyncState {
  switch (action.type) {
    case "SERVICES_LOADED":
      return { ...state, services: action.payload, servicesLoading: false };
    case "TIERS_LOADING":
      return { ...state, tiersLoading: true };
    case "TIERS_LOADED":
      return { ...state, tiers: action.payload, tiersLoading: false };
    case "BOOKING_LOADED":
      return { ...state, bookingLoading: false };
    case "SUBMIT_START":
      return { ...state, submitting: true };
    case "SUBMIT_END":
      return { ...state, submitting: false };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// ─── Form state ───────────────────────────────────────────────

type FormState = {
  serviceId: string;
  tierId: string;
  location: DashboardLocation | "";
  roomNumber: string;
  reservationNumber: string;
  notes: string;
  address: LocationAddress;
  selectedDate: Date | null;
  selectedTime: string;
  calendarView: "date" | "time";
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
};

type FormAction =
  | { type: "LOAD_BOOKING"; payload: Partial<FormState> }
  | { type: "SET_SERVICE"; id: string }
  | { type: "SET_TIER"; id: string }
  | { type: "SET_LOCATION"; value: DashboardLocation }
  | { type: "SET_ROOM_NUMBER"; value: string }
  | { type: "SET_RESERVATION_NUMBER"; value: string }
  | { type: "SET_NOTES"; value: string }
  | { type: "SET_ADDRESS"; value: LocationAddress }
  | { type: "SET_DATE"; value: Date }
  | { type: "SET_TIME"; value: string }
  | { type: "SET_CALENDAR_VIEW"; value: "date" | "time" }
  | {
      type: "SET_FIELD";
      field: "firstName" | "lastName" | "email" | "phone" | "status";
      value: string;
    }
  | { type: "RESET_TIERS" };

const formInitial: FormState = {
  serviceId: "",
  tierId: "",
  location: "",
  roomNumber: "",
  reservationNumber: "",
  notes: "",
  address: EMPTY_ADDRESS,
  selectedDate: null,
  selectedTime: "",
  calendarView: "date",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  status: "pending",
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "LOAD_BOOKING":
      return { ...state, ...action.payload };
    case "SET_SERVICE":
      return { ...state, serviceId: action.id, tierId: "" };
    case "SET_TIER":
      return { ...state, tierId: action.id };
    case "SET_LOCATION":
      return {
        ...state,
        location: action.value,
        roomNumber: "",
        reservationNumber: "",
        address: EMPTY_ADDRESS,
      };
    case "SET_ROOM_NUMBER":
      return { ...state, roomNumber: action.value };
    case "SET_RESERVATION_NUMBER":
      return { ...state, reservationNumber: action.value };
    case "SET_NOTES":
      return { ...state, notes: action.value };
    case "SET_ADDRESS":
      return { ...state, address: action.value };
    case "SET_DATE":
      return {
        ...state,
        selectedDate: action.value,
        selectedTime: "",
        calendarView: "time",
      };
    case "SET_TIME":
      return { ...state, selectedTime: action.value };
    case "SET_CALENDAR_VIEW":
      return { ...state, calendarView: action.value };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "RESET_TIERS":
      return { ...state, tierId: "" };
    default:
      return state;
  }
}

// ─── Page ─────────────────────────────────────────────────────

export default function EditBookingPage() {
  const { id } = useParams<{ id: string }>();
  const { push } = useRouter();
  const { role } = useRole();
  const [async_, dispatchAsync] = useReducer(asyncReducer, asyncInitial);
  const [form, dispatchForm] = useReducer(formReducer, formInitial);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const pendingTierId = useRef<string>("");
  const originalRef = useRef<{
    status: string;
    date: string | null;
    time: string;
    serviceId: string;
  } | null>(null);

  const {
    submitting,
    error,
    services,
    servicesLoading,
    tiers,
    tiersLoading,
    bookingLoading,
  } = async_;
  const {
    serviceId,
    tierId,
    location,
    roomNumber,
    reservationNumber,
    notes,
    address,
    selectedDate,
    selectedTime,
    calendarView,
    firstName,
    lastName,
    email,
    phone,
    status,
  } = form;

  const fullNameForCrumb =
    [firstName, lastName].filter(Boolean).join(" ") || null;
  useDynamicBreadcrumb(!bookingLoading ? fullNameForCrumb : null);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedTier = tiers.find((t) => t.id === tierId) ?? null;

  const allowedLocations =
    role === "partner"
      ? LOCATIONS.filter((l) => l.id === "centro" || l.id === "habitacion")
      : LOCATIONS;

  const sortedServices = [...services].sort((a, b) => {
    if (a.id === "manual-therapies") return -1;
    if (b.id === "manual-therapies") return 1;
    return a.title.localeCompare(b.title);
  });

  // Load services with enrichment from bookableServices
  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("service_settings")
        .select("id, title")
        .eq("active", true)
        .order("title");
      const raw = (data as { id: string; title: string }[] | null) ?? [];
      const enriched: Service[] = raw.map((s) => {
        const static_ = bookableServices.find((b) => b.id === s.id);
        return {
          ...s,
          image: static_?.image,
          description: static_?.description,
          category: static_?.category,
        };
      });
      dispatchAsync({ type: "SERVICES_LOADED", payload: enriched });
    }
    void load();
  }, []);

  // Load booking
  useEffect(() => {
    async function load() {
      const { data } = await insforge.database
        .from("bookings")
        .select(
          "service_id, tier_id, location, location_address, notes, date, time, first_name, last_name, email, phone, status",
        )
        .eq("id", id)
        .limit(1);

      const b = (
        data as Array<{
          service_id: string | null;
          tier_id: string | null;
          location: string | null;
          location_address: string | null;
          notes: string | null;
          date: string | null;
          time: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          status: string | null;
        }> | null
      )?.[0];

      if (!b) {
        dispatchAsync({ type: "BOOKING_LOADED" });
        return;
      }

      // Parse location address
      let parsedRoomNumber = "";
      let parsedReservationNumber = "";
      let parsedAddress = EMPTY_ADDRESS;
      if (b.location_address) {
        try {
          const parsed = JSON.parse(b.location_address) as Record<
            string,
            string
          >;
          if (b.location === "habitacion") {
            parsedRoomNumber = parsed.roomNumber ?? "";
            parsedReservationNumber = parsed.reservationNumber ?? "";
          } else if (b.location === "domicilio") {
            parsedAddress = {
              street: parsed.street ?? "",
              building: parsed.building ?? "",
              postalCode: parsed.postalCode ?? "",
              municipality: parsed.municipality ?? "",
            };
          }
        } catch {
          /* ignore */
        }
      }

      // Parse date
      let parsedDate: Date | null = null;
      let parsedCalendarView: "date" | "time" = "date";
      if (b.date) {
        const [y, m, d] = b.date.split("-").map(Number) as [
          number,
          number,
          number,
        ];
        parsedDate = new Date(y, m - 1, d);
        parsedCalendarView = "time";
      }

      pendingTierId.current = b.tier_id ?? "";
      originalRef.current = {
        status: b.status ?? "pending",
        date: b.date ?? null,
        time: b.time ?? "",
        serviceId: b.service_id ?? "",
      };

      dispatchForm({
        type: "LOAD_BOOKING",
        payload: {
          serviceId: b.service_id ?? "",
          location: (b.location as DashboardLocation) ?? "",
          roomNumber: parsedRoomNumber,
          reservationNumber: parsedReservationNumber,
          notes: b.notes ?? "",
          address: parsedAddress,
          selectedDate: parsedDate,
          selectedTime: b.time ?? "",
          calendarView: parsedCalendarView,
          firstName: b.first_name ?? "",
          lastName: b.last_name ?? "",
          email: b.email ?? "",
          phone: b.phone ?? "",
          status: b.status ?? "pending",
        },
      });
      dispatchAsync({ type: "BOOKING_LOADED" });
    }
    void load();
  }, [id]);

  // Load tiers when service changes
  useEffect(() => {
    async function load() {
      if (!serviceId) {
        dispatchAsync({ type: "TIERS_LOADED", payload: [] });
        return;
      }
      dispatchAsync({ type: "TIERS_LOADING" });
      const { data } = await insforge.database
        .from("service_tiers")
        .select(
          "id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur",
        )
        .eq("service_id", serviceId)
        .eq("active", true)
        .order("sort_order");
      const rows = (data as Tier[] | null) ?? [];
      dispatchAsync({ type: "TIERS_LOADED", payload: rows });

      if (pendingTierId.current) {
        const match = rows.find((r) => r.id === pendingTierId.current);
        if (match) dispatchForm({ type: "SET_TIER", id: match.id });
        pendingTierId.current = "";
      } else if (rows.length === 1 && rows[0]) {
        dispatchForm({ type: "SET_TIER", id: rows[0].id });
      }
    }
    void load();
  }, [serviceId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    dispatchAsync({ type: "SET_ERROR", payload: null });

    if (!serviceId) {
      dispatchAsync({ type: "SET_ERROR", payload: "Please select a service." });
      return;
    }
    if (!firstName.trim()) {
      dispatchAsync({ type: "SET_ERROR", payload: "First name is required." });
      return;
    }
    if (!email.trim()) {
      dispatchAsync({ type: "SET_ERROR", payload: "Email is required." });
      return;
    }
    if (location === "habitacion" && !reservationNumber.trim()) {
      dispatchAsync({
        type: "SET_ERROR",
        payload: "Reservation number is required for room bookings.",
      });
      return;
    }

    let locationAddress: string | null = null;
    if (location === "habitacion")
      locationAddress = JSON.stringify({ roomNumber, reservationNumber });
    else if (location === "domicilio")
      locationAddress = JSON.stringify(address);

    const durationText =
      selectedTier?.duration_minutes != null
        ? `${selectedTier.duration_minutes} min`
        : null;
    const dateStr = selectedDate
      ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
      : null;

    dispatchAsync({ type: "SUBMIT_START" });

    const { error: updateError } = await insforge.database
      .from("bookings")
      .update({
        service_id: serviceId,
        service_title: selectedService?.title ?? serviceId,
        tier_id: tierId || null,
        price_eur: selectedTier ? resolvePrice(selectedTier, location) : null,
        duration: durationText,
        date: dateStr,
        time: selectedTime || null,
        location: location || null,
        location_address: locationAddress,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        status,
      })
      .eq("id", id);

    dispatchAsync({ type: "SUBMIT_END" });

    if (updateError) {
      dispatchAsync({
        type: "SET_ERROR",
        payload:
          (updateError as { message?: string })?.message ??
          "Failed to save booking.",
      });
      return;
    }

    // Send email notifications based on what changed (non-blocking)
    const orig = originalRef.current;
    if (orig && email) {
      const clientName = [firstName.trim(), lastName.trim()]
        .filter(Boolean)
        .join(" ");
      const service = selectedService?.title ?? serviceId;
      const dur =
        selectedTier?.duration_minutes != null
          ? `${selectedTier.duration_minutes} min`
          : null;

      const statusChanged = status !== orig.status;
      const dateTimeChanged =
        (dateStr ?? null) !== orig.date || (selectedTime || "") !== orig.time;

      try {
        if (statusChanged && status === "confirmed") {
          await notifyBooking({
            bookingId: id,
            event: "confirmed",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        } else if (statusChanged && status === "cancelled") {
          await notifyBooking({
            bookingId: id,
            event: "cancelled",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        } else if (!statusChanged && dateTimeChanged) {
          await notifyBooking({
            bookingId: id,
            event: "rescheduled",
            clientName,
            clientEmail: email.trim(),
            service,
            serviceId,
            date: dateStr ?? orig.date ?? "",
            time: selectedTime || orig.time,
            duration: dur,
          });
        }
      } catch {
        // Notification failed silently — booking is already saved
      }

      // Update original ref so re-saves don't re-send
      originalRef.current = {
        status,
        date: dateStr ?? null,
        time: selectedTime,
        serviceId,
      };
    }

    push(`/dashboard/bookings/${id}`);
  }

  async function handleDelete() {
    setDeleting(true);
    await insforge.database.from("bookings").delete().eq("id", id);
    push("/dashboard/bookings");
  }

  const loading = bookingLoading || servicesLoading;

  return (
    <div className="px-6 py-8 lg:px-10">
      <form onSubmit={(e) => void handleSubmit(e)} noValidate>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Edit Booking
          </h1>
          {/* Desktop buttons */}
          <div className="hidden items-center gap-3 sm:flex">
            <Button
              type="button"
              variant="outline-danger"
              size="md"
              onClick={() => setDeleteOpen(true)}
              disabled={loading}
            >
              Delete
            </Button>
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || loading}
            >
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {/* Desktop error */}
        {error && (
          <p className="mb-6 hidden rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600 sm:block">
            {error}
          </p>
        )}

        <div className="space-y-3">

          {/* ── 1. Status ── */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Status
            </h2>
            <StatusSelect
              selected={(status as BookingStatus) || "pending"}
              onSelect={(s) =>
                dispatchForm({ type: "SET_FIELD", field: "status", value: s })
              }
            />
          </div>

          {/* ── 2. Service ── */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Service
            </h2>
            {loading ? (
              <div className="border-sand-200 bg-sand-50 h-[74px] animate-pulse rounded-2xl border" />
            ) : (
              <ServiceSelect
                services={sortedServices}
                selected={selectedService}
                onSelect={(s) =>
                  dispatchForm({ type: "SET_SERVICE", id: s.id })
                }
              />
            )}
          </div>

          {/* ── 3. Location ── */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Location
            </h2>
            <div className="flex flex-col gap-4">
              <LocationSelect
                selected={location || null}
                onSelect={(l) =>
                  dispatchForm({ type: "SET_LOCATION", value: l })
                }
                locations={allowedLocations}
              />

              {location === "habitacion" && (
                <div className="animate-fade-in-up flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="reservationNumber"
                        className="text-petroleum-500 text-xs font-medium"
                      >
                        Reservation number{" "}
                        <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="reservationNumber"
                        type="text"
                        value={reservationNumber}
                        onChange={(e) =>
                          dispatchForm({
                            type: "SET_RESERVATION_NUMBER",
                            value: e.target.value,
                          })
                        }
                        placeholder="83943"
                        disabled={submitting}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="roomNumber"
                        className="text-petroleum-500 text-xs font-medium"
                      >
                        Room number
                      </label>
                      <input
                        id="roomNumber"
                        type="text"
                        value={roomNumber}
                        onChange={(e) =>
                          dispatchForm({
                            type: "SET_ROOM_NUMBER",
                            value: e.target.value,
                          })
                        }
                        placeholder="AK201"
                        disabled={submitting}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>
                </div>
              )}

              {location === "domicilio" && (
                <div className="animate-fade-in-up flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="addr-street"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Street & number <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="addr-street"
                      type="text"
                      value={address.street}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_ADDRESS",
                          value: { ...address, street: e.target.value },
                        })
                      }
                      placeholder="Calle El Peñón, 23"
                      autoComplete="address-line1"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="addr-building"
                      className="text-petroleum-500 text-xs font-medium"
                    >
                      Block, floor & door
                    </label>
                    <input
                      id="addr-building"
                      type="text"
                      value={address.building}
                      onChange={(e) =>
                        dispatchForm({
                          type: "SET_ADDRESS",
                          value: { ...address, building: e.target.value },
                        })
                      }
                      placeholder="Block 3, 2nd floor, apt B"
                      autoComplete="address-line2"
                      disabled={submitting}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="addr-postal"
                        className="text-petroleum-500 text-xs font-medium"
                      >
                        Postal code <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="addr-postal"
                        type="text"
                        inputMode="numeric"
                        maxLength={5}
                        value={address.postalCode}
                        onChange={(e) =>
                          dispatchForm({
                            type: "SET_ADDRESS",
                            value: { ...address, postalCode: e.target.value },
                          })
                        }
                        placeholder="38670"
                        autoComplete="postal-code"
                        disabled={submitting}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="addr-municipality"
                        className="text-petroleum-500 text-xs font-medium"
                      >
                        Municipality <span className="text-red-400">*</span>
                      </label>
                      <input
                        id="addr-municipality"
                        type="text"
                        list="edit-municipalities"
                        value={address.municipality}
                        onChange={(e) =>
                          dispatchForm({
                            type: "SET_ADDRESS",
                            value: { ...address, municipality: e.target.value },
                          })
                        }
                        placeholder="Adeje"
                        autoComplete="address-level2"
                        disabled={submitting}
                        className={INPUT_CLASS}
                      />
                      <datalist id="edit-municipalities">
                        {TENERIFE_MUNICIPALITIES.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 4. Session type ── */}
          {serviceId && (
            <div className="border-sand-200 rounded-2xl border bg-white p-6">
              <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
                Session type
              </h2>
              {tiersLoading ? (
                <div className="border-sand-200 bg-sand-50 h-[74px] animate-pulse rounded-2xl border" />
              ) : tiers.length === 0 ? (
                <p className="text-petroleum-300 border-sand-200 rounded-xl border border-dashed px-4 py-3 text-sm">
                  No session types configured for this service.
                </p>
              ) : (
                <TierSelect
                  tiers={tiers}
                  selectedId={tierId}
                  onSelect={(t) => dispatchForm({ type: "SET_TIER", id: t.id })}
                />
              )}
            </div>
          )}

          {/* ── 5. Date & Time ── */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Date & Time
            </h2>
            {calendarView === "date" ? (
              <CalendarView
                selected={selectedDate}
                onSelect={(d) => dispatchForm({ type: "SET_DATE", value: d })}
              />
            ) : (
              <div className="flex flex-col gap-5">
                <button
                  type="button"
                  onClick={() =>
                    dispatchForm({ type: "SET_CALENDAR_VIEW", value: "date" })
                  }
                  className="border-sand-300 bg-sand-50 hover:border-petroleum-100 flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-200"
                >
                  <div className="flex flex-col gap-1">
                    <p className="text-petroleum-400 text-xs">Date</p>
                    <p className="text-petroleum-700 font-medium">
                      {selectedDate?.toLocaleDateString("en-GB", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <ChevronDown
                    className="text-petroleum-400 shrink-0"
                    size={16}
                  />
                </button>
                <div className="flex flex-col gap-3">
                  <p className="text-petroleum-400 text-sm">Available times</p>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {TIME_SLOTS.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() =>
                          dispatchForm({ type: "SET_TIME", value: slot })
                        }
                        className={[
                          "rounded-xl border py-2.5 text-sm font-medium transition-all",
                          selectedTime === slot
                            ? "bg-petroleum-400 border-petroleum-400 text-sand-50 shadow-sm"
                            : "bg-petroleum-50 border-petroleum-100 text-petroleum-700 hover:bg-petroleum-100 cursor-pointer",
                        ].join(" ")}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── 6. Client ── */}
          <div className="border-sand-200 rounded-2xl border bg-white p-6">
            <h2 className="text-petroleum-500 mb-4 text-sm font-semibold">
              Client
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="firstName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    First name <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "firstName",
                        value: e.target.value,
                      })
                    }
                    placeholder="Jane"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="lastName"
                    className="text-petroleum-500 text-xs font-medium"
                  >
                    Last name
                  </label>
                  <input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) =>
                      dispatchForm({
                        type: "SET_FIELD",
                        field: "lastName",
                        value: e.target.value,
                      })
                    }
                    placeholder="Doe"
                    disabled={submitting}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) =>
                    dispatchForm({
                      type: "SET_FIELD",
                      field: "email",
                      value: e.target.value,
                    })
                  }
                  placeholder="jane@example.com"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="phone"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) =>
                    dispatchForm({
                      type: "SET_FIELD",
                      field: "phone",
                      value: e.target.value,
                    })
                  }
                  placeholder="+34 600 000 000"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="notes"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) =>
                    dispatchForm({ type: "SET_NOTES", value: e.target.value })
                  }
                  placeholder="Any additional notes for this booking…"
                  rows={3}
                  disabled={submitting}
                  className={INPUT_CLASS + " resize-none"}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="mt-6 sm:hidden">
          {error && (
            <p className="mb-3 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <Button
              type="submit"
              variant="solid"
              size="md"
              disabled={submitting || loading}
              className="w-full justify-center"
            >
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </form>

      {deleteOpen && (
        <DeleteDialog
          deleting={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setDeleteOpen(false)}
        />
      )}
    </div>
  );
}
