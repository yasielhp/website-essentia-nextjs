"use client";

import Link from "next/link";

export function StatCard({
  label,
  value,
  loading,
  href,
  active = false,
}: {
  label: string;
  value: number;
  loading: boolean;
  href?: string;
  /** Marks the card whose figure is the one the list below is showing. */
  active?: boolean;
}) {
  const inner = (
    <>
      <p className="text-petroleum-400 text-sm">{label}</p>
      {loading ? (
        <div className="bg-sand-100 mt-2 h-8 w-16 animate-pulse rounded-lg" />
      ) : (
        <p className="font-display text-petroleum-700 mt-1 text-3xl">{value}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="border-sand-200 hover:border-petroleum-200 block rounded-2xl border bg-white p-6 transition-colors"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={`rounded-2xl border bg-white p-6 ${
        active
          ? "border-petroleum-400 ring-petroleum-100 ring-2"
          : "border-sand-200"
      }`}
    >
      {inner}
    </div>
  );
}
