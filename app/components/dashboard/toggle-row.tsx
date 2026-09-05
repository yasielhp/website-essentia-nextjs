"use client";

/**
 * A labelled switch in a card, the way the contact page shows its newsletter
 * preference. One component so the three places that ask the same question
 * look the same and cannot drift.
 */
export function ToggleRow({
  checked,
  onToggle,
  label,
  hint,
  disabled = false,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  /** What the current state means, or what turning it on does. */
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className={[
        "flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-colors duration-200",
        checked
          ? "border-petroleum-200 bg-petroleum-50"
          : "border-sand-200 bg-sand-50",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-petroleum-700 text-sm font-medium">{label}</p>
        {hint && <p className="text-petroleum-400 text-xs">{hint}</p>}
      </div>
      <div
        className={[
          "flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors duration-200",
          checked ? "bg-petroleum-500" : "bg-sand-300",
        ].join(" ")}
      >
        <div
          className={[
            "size-5 rounded-full bg-white shadow-sm transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0",
          ].join(" ")}
        />
      </div>
    </button>
  );
}
