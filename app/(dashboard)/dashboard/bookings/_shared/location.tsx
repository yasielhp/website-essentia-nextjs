"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, Building2, Home, BedDouble } from "lucide-react";
import { useDropdownPortal } from "@/hooks/use-dropdown-portal";
import { contact } from "@/constants/contact";

/**
 * Where a booking takes place, and how somebody picks it.
 *
 * The new-booking screen and the edit screen asked the same question with the
 * same three answers, the same municipality list and the same dropdown — twice,
 * character for character, in two files of two thousand lines each. One of the
 * copies had already drifted a Tailwind class.
 */
export type DashboardLocation = "centro" | "habitacion" | "domicilio";

export type LocationAddress = {
  street: string;
  building: string;
  postalCode: string;
  municipality: string;
};

export const TENERIFE_MUNICIPALITIES = [
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

export type LocationOption = {
  id: DashboardLocation;
  label: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
};

const LOCATION_ICONS: Record<
  DashboardLocation,
  React.FC<{ size?: number; className?: string }>
> = {
  centro: Building2,
  habitacion: BedDouble,
  domicilio: Home,
};

export /**
 * The wording comes from `dashboard.bookings.form.locations`; only the centre's
 * description is a real-world address, so it keeps coming from `contact`.
 */
function useLocationOptions(): LocationOption[] {
  const t = useTranslations("dashboard.bookings.form.locations");
  return [
    {
      id: "centro",
      label: t("centro.label"),
      description: contact.address,
      Icon: LOCATION_ICONS.centro,
    },
    {
      id: "habitacion",
      label: t("habitacion.label"),
      description: t("habitacion.description"),
      Icon: LOCATION_ICONS.habitacion,
    },
    {
      id: "domicilio",
      label: t("domicilio.label"),
      description: t("domicilio.description"),
      Icon: LOCATION_ICONS.domicilio,
    },
  ];
}

export const EMPTY_ADDRESS: LocationAddress = {
  street: "",
  building: "",
  postalCode: "",
  municipality: "",
};

export // ─── Location Select ──────────────────────────────────────────

function LocationSelect({
  selected,
  onSelect,
  locations,
}: {
  selected: DashboardLocation | null;
  onSelect: (l: DashboardLocation) => void;
  locations: LocationOption[];
}) {
  const t = useTranslations("dashboard.bookings.form.locations");
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
          "bg-sand-50 flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors duration-200",
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
              {t("selectPrompt")}
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
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-9999 overflow-hidden rounded-2xl border shadow-lg"
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
                  className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-[background-color,transform] duration-150 active:scale-[0.98]"
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
