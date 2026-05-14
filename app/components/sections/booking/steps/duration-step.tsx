"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import type { BookableService } from "@/data/services-data";

function DurationSelect({
  durations,
  selected,
  onSelect,
}: {
  durations: string[];
  selected: string | null;
  onSelect: (d: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div ref={containerRef} className="relative">
      <button
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
            <p className="text-petroleum-400 text-xs">Duration</p>
            <p className="text-petroleum-700 font-medium">{selected}</p>
          </div>
        ) : (
          <p className="text-petroleum-100 flex-1 text-sm">Select a duration</p>
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

      {isOpen && (
        <div className="border-sand-300 bg-sand-50 absolute top-full right-0 left-0 z-10 mt-2 overflow-hidden rounded-2xl border shadow-lg">
          <div className="p-3">
            {durations.map((d) => (
              <button
                key={d}
                onClick={() => {
                  onSelect(d);
                  setIsOpen(false);
                }}
                className="hover:bg-sand-100 flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
              >
                <span className="text-petroleum-700 font-medium">{d}</span>
                {selected === d && (
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

export function DurationStep({
  service,
  selectedDuration,
  onSelect,
}: {
  service: BookableService;
  selectedDuration: string | null;
  onSelect: (d: string) => void;
}) {
  const isFixed = service.durations.length === 1;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-petroleum-400 text-sm">
        {isFixed
          ? "This service has a fixed session duration."
          : "How long would you like your session?"}
      </p>
      {isFixed ? (
        <div className="border-sand-300 bg-sand-50 flex items-center gap-4 rounded-2xl border p-4">
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-petroleum-400 text-xs">Duration</p>
            <p className="text-petroleum-700 font-medium">
              {service.durations[0]}
            </p>
          </div>
          <Check className="text-petroleum-100 shrink-0" size={16} />
        </div>
      ) : (
        <DurationSelect
          durations={service.durations}
          selected={selectedDuration}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
