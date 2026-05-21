"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconX } from "@/components/ui/icons";

export function CalendarColorModal({
  label,
  initialColor,
  onSave,
  onClose,
}: {
  label: string;
  initialColor: string;
  onSave: (color: string) => void;
  onClose: () => void;
}) {
  const [color, setColor] = useState(initialColor);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-petroleum-700 text-xl">
            Calendar settings
          </h3>
          <button
            onClick={onClose}
            className="text-petroleum-300 hover:text-petroleum-500 transition-colors"
          >
            <IconX />
          </button>
        </div>

        <div className="border-petroleum-50 bg-petroleum-50 flex items-center justify-between rounded-xl border px-4 py-3">
          <div className="flex items-center gap-3">
            <div
              className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: color }}
            />
            <span className="text-petroleum-700 text-sm">{label} color</span>
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <span className="text-petroleum-400 font-mono text-xs">
              {color}
            </span>
            <div
              className="border-sand-200 relative size-8 overflow-hidden rounded-lg border shadow-sm"
              style={{ backgroundColor: color }}
            >
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <Button variant="ghost" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="solid"
            size="md"
            onClick={() => {
              onSave(color);
              onClose();
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
