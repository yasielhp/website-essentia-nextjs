"use client";

import Link from "next/link";

export function StatCard({
  label,
  value,
  loading,
  href,
}: {
  label: string;
  value: number;
  loading: boolean;
  href?: string;
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
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      {inner}
    </div>
  );
}
