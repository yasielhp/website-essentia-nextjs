"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Building2, Home, ChevronDown, Check, X } from "lucide-react";
import type { LocationAddress } from "@/components/sections/booking/booking-content";

export type BookingLocation = "centro" | "domicilio";

const LOCATIONS: {
  id: BookingLocation;
  label: string;
  description: string;
  Icon: React.FC<{ size?: number; className?: string }>;
}[] = [
  {
    id: "centro",
    label: "At the center",
    description: "Visit us at our facilities",
    Icon: Building2,
  },
  {
    id: "domicilio",
    label: "Home visit",
    description: "We come to your address",
    Icon: Home,
  },
];

const INPUT_CLASS =
  "bg-sand-100 text-petroleum-700 placeholder:text-petroleum-100 border border-sand-300 rounded-xl px-4 py-3 text-sm outline-none transition-all duration-200 focus:border-petroleum-400 focus:ring-2 focus:ring-petroleum-100 w-full";

function LocationItems({
  selected,
  onSelect,
}: {
  selected: BookingLocation | null;
  onSelect: (l: BookingLocation) => void;
}) {
  return (
    <div className="p-3">
      {LOCATIONS.map(({ id, label, description, Icon }) => (
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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (window.matchMedia("(max-width: 767px)").matches) return;
    const handle = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const active = LOCATIONS.find((l) => l.id === selected);

  const handleSelect = (l: BookingLocation) => {
    onSelect(l);
    setIsOpen(false);
  };

  const trigger = (
    <button
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
          <p className="text-petroleum-400 flex-1 text-sm">Select a location</p>
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
  );

  return (
    <div ref={containerRef} className="relative">
      {trigger}

      {isOpen && (
        <div className="border-sand-300 bg-sand-50 animate-fade-in-down absolute top-full right-0 left-0 z-10 mt-2 hidden overflow-hidden rounded-2xl border shadow-lg md:block">
          <LocationItems selected={selected} onSelect={handleSelect} />
        </div>
      )}

      {isOpen &&
        createPortal(
          <div className="animate-slide-up-modal fixed inset-0 z-50 flex flex-col bg-white md:hidden">
            <div className="border-sand-100 flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-petroleum-700 font-medium">
                Select a location
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="hover:bg-sand-50 rounded-xl p-2 transition-colors"
                aria-label="Close"
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

function AddressFields({
  address,
  onChange,
}: {
  address: LocationAddress;
  onChange: (addr: LocationAddress) => void;
}) {
  const set = (key: keyof LocationAddress) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...address, [key]: e.target.value });

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="addr-street" className="text-petroleum-500 text-sm font-medium">
          Street & number<span className="ml-0.5 text-red-400">*</span>
        </label>
        <input
          id="addr-street"
          type="text"
          value={address.street}
          onChange={set("street")}
          placeholder="Main St, 42"
          autoComplete="address-line1"
          className={INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="addr-apartment" className="text-petroleum-500 text-sm font-medium">
          Apartment / floor
        </label>
        <input
          id="addr-apartment"
          type="text"
          value={address.apartment}
          onChange={set("apartment")}
          placeholder="3rd floor, apt B"
          autoComplete="address-line2"
          className={INPUT_CLASS}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="addr-city" className="text-petroleum-500 text-sm font-medium">
            City<span className="ml-0.5 text-red-400">*</span>
          </label>
          <input
            id="addr-city"
            type="text"
            value={address.city}
            onChange={set("city")}
            placeholder="Santander"
            autoComplete="address-level2"
            className={INPUT_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="addr-postal" className="text-petroleum-500 text-sm font-medium">
            Postal code<span className="ml-0.5 text-red-400">*</span>
          </label>
          <input
            id="addr-postal"
            type="text"
            value={address.postalCode}
            onChange={set("postalCode")}
            placeholder="39001"
            autoComplete="postal-code"
            className={INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}

export function LocationStep({
  selected,
  address,
  onSelect,
  onAddressChange,
}: {
  selected: string | null;
  address: LocationAddress;
  onSelect: (location: BookingLocation) => void;
  onAddressChange: (address: LocationAddress) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        Where would you like to receive the service?
      </p>
      <LocationSelect
        selected={selected as BookingLocation | null}
        onSelect={onSelect}
      />
      {selected === "domicilio" && (
        <AddressFields address={address} onChange={onAddressChange} />
      )}
    </div>
  );
}
