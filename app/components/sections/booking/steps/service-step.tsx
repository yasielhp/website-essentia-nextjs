"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronDown, Check, X } from "lucide-react";
import { bookableServices, type BookableService } from "@/data/services-data";

function ServiceItems({
  selected,
  onSelect,
  imageClass = "size-12",
  imageSizes = "48px",
}: {
  selected: BookableService | null;
  onSelect: (s: BookableService) => void;
  imageClass?: string;
  imageSizes?: string;
}) {
  const t = useTranslations("booking.serviceStep");
  const wellness = bookableServices.filter((s) => s.category === "wellness");
  const medicine = bookableServices.filter((s) => s.category === "medicine");

  const row = (s: BookableService) => (
    <button
      key={s.id}
      onClick={() => onSelect(s)}
      className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-all duration-150 active:scale-[0.98]"
    >
      <div
        className={`relative ${imageClass} shrink-0 overflow-hidden rounded-lg`}
      >
        <Image
          src={s.image}
          alt={s.title}
          fill
          sizes={imageSizes}
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="text-petroleum-700 text-sm font-medium">{s.title}</p>
        <p className="text-petroleum-400 line-clamp-1 text-xs">
          {s.description}
        </p>
        <p className="text-petroleum-500 text-xs">
          {s.category === "wellness" ? t("wellness") : t("medicine")}
        </p>
      </div>
      {selected?.id === s.id && (
        <Check className="text-petroleum-700 shrink-0" size={14} />
      )}
    </button>
  );

  return (
    <div className="p-3">
      {wellness.length > 0 && (
        <>
          <p className="text-petroleum-500 p-2 text-xs tracking-widest uppercase">
            {t("wellness")}
          </p>
          {wellness.map(row)}
        </>
      )}
      {medicine.length > 0 && (
        <>
          <p className="text-petroleum-500 mt-2 p-2 text-xs tracking-widest uppercase">
            {t("medicine")}
          </p>
          {medicine.map(row)}
        </>
      )}
    </div>
  );
}

function ServiceSelect({
  selected,
  onSelect,
}: {
  selected: BookableService | null;
  onSelect: (s: BookableService | null) => void;
}) {
  const t = useTranslations("booking.serviceStep");
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  const handleSelect = (s: BookableService) => {
    onSelect(s);
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
        {selected ? (
          <>
            <div className="animate-fade-in-up relative size-20 shrink-0 overflow-hidden rounded-xl">
              <Image
                src={selected.image}
                alt={selected.title}
                fill
                sizes="80px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
              <p className="text-petroleum-700 font-medium">{selected.title}</p>
              <p className="text-petroleum-400 line-clamp-2 text-sm">
                {selected.description}
              </p>
              <p className="text-petroleum-500 text-sm capitalize">
                {selected.category}
              </p>
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
              {t("placeholder")}
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
            className="border-sand-300 bg-sand-50 animate-fade-in-down z-[9999] max-h-96 overflow-y-auto rounded-2xl border shadow-lg"
          >
            <ServiceItems selected={selected} onSelect={handleSelect} />
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
              <ServiceItems
                selected={selected}
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

export function ServiceStep({
  selected,
  onSelect,
}: {
  selected: BookableService | null;
  onSelect: (s: BookableService | null) => void;
}) {
  const t = useTranslations("booking.serviceStep");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">{t("label")}</p>
      <ServiceSelect selected={selected} onSelect={onSelect} />
    </div>
  );
}
