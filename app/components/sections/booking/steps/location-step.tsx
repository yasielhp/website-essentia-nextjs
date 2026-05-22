"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Building2, Home, ChevronDown, Check, X } from "lucide-react";
import { contact } from "@/constants/contact";

export type LocationAddress = {
  street: string;
  building: string;
  postalCode: string;
  municipality: string;
};

export type BookingLocation = "centro" | "domicilio";

type LocationOption = {
  id: BookingLocation;
  label: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
};

function useLocationOptions(): LocationOption[] {
  const t = useTranslations("booking.locationStep");
  return [
    {
      id: "centro",
      label: t("atTheCenter"),
      description: contact.address,
      Icon: Building2,
    },
    {
      id: "domicilio",
      label: t("homeVisit"),
      description: t("homeVisitDescription"),
      Icon: Home,
    },
  ];
}

const INPUT_BASE =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-100 border rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:ring-2 w-full";
const INPUT_CLASS = `${INPUT_BASE} border-sand-300 focus:border-petroleum-400 focus:ring-petroleum-100`;
const INPUT_ERR = `${INPUT_BASE} border-red-300 focus:border-red-400 focus:ring-red-100`;

export type AddressErrors = Partial<Record<keyof LocationAddress, string>>;

function LocationItems({
  selected,
  onSelect,
}: {
  selected: BookingLocation | null;
  onSelect: (l: BookingLocation) => void;
}) {
  const locations = useLocationOptions();
  return (
    <div className="p-3">
      {locations.map(({ id, label, description, Icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
        >
          <div className="bg-sand-200 flex size-12 shrink-0 items-center justify-center rounded-lg">
            <Icon size={20} className="text-petroleum-500" />
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <p className="text-petroleum-700 text-sm font-medium">{label}</p>
            <p className="text-petroleum-400 text-xs">{description}</p>
          </div>
          {selected === id && (
            <Check className="text-petroleum-700 shrink-0" size={14} />
          )}
        </button>
      ))}
    </div>
  );
}

function LocationSelect({
  selected,
  onSelect,
}: {
  selected: BookingLocation | null;
  onSelect: (l: BookingLocation) => void;
}) {
  const t = useTranslations("booking.locationStep");
  const locations = useLocationOptions();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches;

  const updateDropdownPosition = () => {
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
    updateDropdownPosition();
    const handleClose = (e: MouseEvent) => {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      )
        return;
      setIsOpen(false);
    };
    const handleScroll = () => updateDropdownPosition();
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

  const active = locations.find((l) => l.id === selected);

  const handleSelect = (l: BookingLocation) => {
    onSelect(l);
    setIsOpen(false);
  };

  return (
    <div>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((o) => !o)}
        className={[
          "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-200",
          isOpen
            ? "border-petroleum-400 ring-petroleum-100 ring-2"
            : "border-sand-300 hover:border-petroleum-400",
          "bg-sand-50",
        ].join(" ")}
      >
        {active ? (
          <>
            <div className="bg-sand-200 animate-fade-in-up flex size-20 shrink-0 items-center justify-center rounded-xl">
              <active.Icon size={28} className="text-petroleum-500" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
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
          </>
        ) : (
          <>
            <div className="bg-sand-200 flex size-20 shrink-0 items-center justify-center rounded-xl">
              <span className="text-petroleum-100 text-lg">+</span>
            </div>
            <p className="text-petroleum-400 flex-1 text-sm">
              {t("selectLocation")}
            </p>
            <ChevronDown
              className={[
                "text-petroleum-400 shrink-0 transition-transform duration-200",
                isOpen ? "rotate-180" : "",
              ].join(" ")}
              size={16}
            />
          </>
        )}
      </button>

      {/* Desktop: fixed-position portal to escape stacking contexts */}
      {isOpen &&
        !isMobile() &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] overflow-hidden rounded-2xl border shadow-lg"
          >
            <LocationItems selected={selected} onSelect={handleSelect} />
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
                {t("modalTitle")}
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label={t("close")}
              >
                <X size={20} className="text-petroleum-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <LocationItems selected={selected} onSelect={handleSelect} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

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

function AddressFields({
  address,
  errors = {},
  onChange,
  onClearError,
}: {
  address: LocationAddress;
  errors?: AddressErrors;
  onChange: (addr: LocationAddress) => void;
  onClearError?: (key: keyof LocationAddress) => void;
}) {
  const t = useTranslations("booking.locationStep");
  const set =
    (key: keyof LocationAddress) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...address, [key]: e.target.value });
      onClearError?.(key);
    };

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="addr-street"
          className="text-petroleum-500 text-sm font-medium"
        >
          {t("street")}
          <span className="ml-0.5 text-red-400">*</span>
        </label>
        <input
          id="addr-street"
          type="text"
          value={address.street}
          onChange={set("street")}
          placeholder={t("streetPlaceholder")}
          autoComplete="address-line1"
          className={errors.street ? INPUT_ERR : INPUT_CLASS}
        />
        {errors.street && (
          <p className="text-xs text-red-500">{errors.street}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="addr-building"
          className="text-petroleum-500 text-sm font-medium"
        >
          {t("building")}
        </label>
        <input
          id="addr-building"
          type="text"
          value={address.building}
          onChange={set("building")}
          placeholder={t("buildingPlaceholder")}
          autoComplete="address-line2"
          className={INPUT_CLASS}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="addr-postal"
            className="text-petroleum-500 text-sm font-medium"
          >
            {t("postalCode")}
            <span className="ml-0.5 text-red-400">*</span>
          </label>
          <input
            id="addr-postal"
            type="text"
            inputMode="numeric"
            maxLength={5}
            value={address.postalCode}
            onChange={set("postalCode")}
            placeholder={t("postalCodePlaceholder")}
            autoComplete="postal-code"
            className={errors.postalCode ? INPUT_ERR : INPUT_CLASS}
          />
          {errors.postalCode && (
            <p className="text-xs text-red-500">{errors.postalCode}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="addr-municipality"
            className="text-petroleum-500 text-sm font-medium"
          >
            {t("municipality")}
            <span className="ml-0.5 text-red-400">*</span>
          </label>
          <input
            id="addr-municipality"
            type="text"
            list="tenerife-municipalities"
            value={address.municipality}
            onChange={set("municipality")}
            placeholder={t("municipalityPlaceholder")}
            autoComplete="address-level2"
            className={errors.municipality ? INPUT_ERR : INPUT_CLASS}
          />
          {errors.municipality && (
            <p className="text-xs text-red-500">{errors.municipality}</p>
          )}
          <datalist id="tenerife-municipalities">
            {TENERIFE_MUNICIPALITIES.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}

export function LocationStep({
  selected,
  address,
  addressErrors,
  onSelect,
  onAddressChange,
  onClearAddressError,
}: {
  selected: string | null;
  address: LocationAddress;
  addressErrors?: AddressErrors;
  onSelect: (location: BookingLocation) => void;
  onAddressChange: (address: LocationAddress) => void;
  onClearAddressError?: (key: keyof LocationAddress) => void;
}) {
  const t = useTranslations("booking.locationStep");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">{t("label")}</p>
      <LocationSelect
        selected={selected as BookingLocation | null}
        onSelect={onSelect}
      />
      {selected === "domicilio" && (
        <AddressFields
          address={address}
          errors={addressErrors}
          onChange={onAddressChange}
          onClearError={onClearAddressError}
        />
      )}
    </div>
  );
}
