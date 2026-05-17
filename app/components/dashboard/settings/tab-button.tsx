"use client";

export function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-petroleum-700 text-white"
          : "text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700"
      }`}
    >
      {children}
    </button>
  );
}
