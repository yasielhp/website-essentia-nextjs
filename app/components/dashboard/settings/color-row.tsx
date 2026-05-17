"use client";

export function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="border-sand-100 flex items-center justify-between border-b py-3.5 last:border-0">
      <div className="flex items-center gap-3">
        <div
          className="size-4 shrink-0 rounded-full ring-1 ring-black/10"
          style={{ backgroundColor: value }}
        />
        <span className="text-petroleum-700 text-sm">{label}</span>
      </div>
      <label className="flex cursor-pointer items-center gap-2.5">
        <span className="text-petroleum-400 font-mono text-xs">{value}</span>
        <div
          className="border-sand-200 relative size-8 overflow-hidden rounded-lg border shadow-sm"
          style={{ backgroundColor: value }}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </label>
    </div>
  );
}
