"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, Check } from "lucide-react";
import { bookableServices, type BookableService } from "@/data/services-data";

function ServiceSelect({
  selected,
  onSelect,
}: {
  selected: BookableService | null;
  onSelect: (s: BookableService | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const wellness = bookableServices.filter((s) => s.category === "wellness");
  const medicine = bookableServices.filter((s) => s.category === "medicine");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (s: BookableService) => {
    onSelect(s);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
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
        {selected ? (
          <>
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl">
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
              <p className="text-petroleum-500 text-sm">
                {selected.durations.join(" | ")}
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
            <p className="text-petroleum-100 flex-1 text-sm">
              Select a service
            </p>
            <ChevronDown
              className={[
                "text-petroleum-100 shrink-0 transition-transform duration-200",
                isOpen ? "rotate-180" : "",
              ].join(" ")}
              size={16}
            />
          </>
        )}
      </button>

      {isOpen && (
        <div className="border-sand-300 bg-sand-50 absolute top-full right-0 left-0 z-10 mt-2 max-h-96 overflow-y-auto rounded-2xl border shadow-lg">
          <div className="p-3">
            <p className="text-petroleum-100 px-2 py-2 text-xs tracking-widest uppercase">
              Wellness
            </p>
            {wellness.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={s.image}
                    alt={s.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <p className="text-petroleum-700 text-sm font-medium">
                    {s.title}
                  </p>
                  <p className="text-petroleum-400 line-clamp-1 text-xs">
                    {s.description}
                  </p>
                  <p className="text-petroleum-500 text-xs">
                    {s.durations.join(" | ")}
                  </p>
                </div>
                {selected?.id === s.id && (
                  <Check className="text-petroleum-700 shrink-0" size={14} />
                )}
              </button>
            ))}

            <p className="text-petroleum-100 mt-2 px-2 py-2 text-xs tracking-widest uppercase">
              Medicine
            </p>
            {medicine.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className="hover:bg-sand-100 flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors"
              >
                <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={s.image}
                    alt={s.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <p className="text-petroleum-700 text-sm font-medium">
                    {s.title}
                  </p>
                  <p className="text-petroleum-400 line-clamp-1 text-xs">
                    {s.description}
                  </p>
                  <p className="text-petroleum-500 text-xs">
                    {s.durations.join(" | ")}
                  </p>
                </div>
                {selected?.id === s.id && (
                  <Check className="text-petroleum-700 shrink-0" size={14} />
                )}
              </button>
            ))}
          </div>
        </div>
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
  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        Which service would you like to book?
      </p>
      <ServiceSelect selected={selected} onSelect={onSelect} />
    </div>
  );
}
