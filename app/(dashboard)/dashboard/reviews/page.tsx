"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";

type Review = {
  id: string;
  quote: string;
  name: string;
  age: string;
  initials: string;
  style: "dark" | "light";
  display_order: number;
  status: "draft" | "published";
  created_at: string;
};

const statusBadge: Record<string, string> = {
  published: "bg-green-100 text-green-800",
  draft: "bg-yellow-100 text-yellow-800",
};

const styleBadge: Record<string, string> = {
  dark: "bg-petroleum-100 text-petroleum-700",
  light: "bg-sand-100 text-petroleum-500",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusBadge[status] ?? "bg-sand-100 text-petroleum-500"}`}
    >
      {status}
    </span>
  );
}

function StyleBadge({ style }: { style: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styleBadge[style] ?? "bg-sand-100 text-petroleum-500"}`}
    >
      {style}
    </span>
  );
}

function Avatar({ initials, style }: { initials: string; style: string }) {
  const cls =
    style === "dark"
      ? "bg-petroleum-500 text-sand-50"
      : "bg-petroleum-100 text-petroleum-700";
  return (
    <div
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${cls}`}
    >
      {initials}
    </div>
  );
}

export default function ReviewsPage() {
  const { push } = useRouter();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void insforge.database
      .from("reviews")
      .select("*")
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        setReviews((data as Review[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  const counts = {
    published: reviews.filter((r) => r.status === "published").length,
    draft: reviews.filter((r) => r.status === "draft").length,
  };

  return (
    <div className="px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button
          variant="solid"
          size="md"
          href="/dashboard/reviews/new"
          className="gap-2"
        >
          <IconPlus />
          New Review
        </Button>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {[
          { label: "Published", value: counts.published },
          { label: "Draft", value: counts.draft },
          { label: "Total", value: reviews.length },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="border-sand-200 flex flex-col gap-1 rounded-2xl border bg-white px-5 py-4"
          >
            <p className="text-petroleum-400 text-xs font-medium">{label}</p>
            {loading ? (
              <div className="bg-sand-100 h-7 w-10 animate-pulse rounded" />
            ) : (
              <p className="text-petroleum-700 font-display text-2xl font-medium">
                {value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="border-sand-200 divide-sand-200 mb-4 divide-y rounded-2xl border bg-white sm:hidden">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="bg-sand-100 h-8 w-8 animate-pulse rounded-full" />
                <div>
                  <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                  <div className="bg-sand-100 mt-1 h-3 w-16 animate-pulse rounded" />
                </div>
              </div>
              <div className="bg-sand-100 mt-2 h-3 w-full animate-pulse rounded" />
            </div>
          ))
        ) : reviews.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            No reviews found.
          </p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar initials={r.initials} style={r.style} />
                  <div className="min-w-0">
                    <p className="text-petroleum-700 truncate font-medium">
                      {r.name}
                    </p>
                    <p className="text-petroleum-400 text-xs">{r.age}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <StatusBadge status={r.status} />
                  <StyleBadge style={r.style} />
                </div>
              </div>
              <p className="text-petroleum-500 mt-2 line-clamp-2 text-sm italic">
                &ldquo;{r.quote}&rdquo;
              </p>
              <p className="text-petroleum-300 mt-1 text-xs">
                Order: {r.display_order}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Table (desktop) */}
      <div className="border-sand-200 hidden rounded-2xl border bg-white sm:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-sand-200 border-b text-left">
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  #
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Author
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Quote
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Style
                </th>
                <th className="text-petroleum-400 px-5 py-3.5 font-medium">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-sand-50 border-b">
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-6 animate-pulse rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-sand-100 h-8 w-8 animate-pulse rounded-full" />
                        <div>
                          <div className="bg-sand-100 h-4 w-24 animate-pulse rounded" />
                          <div className="bg-sand-100 mt-1 h-3 w-12 animate-pulse rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-4 w-64 animate-pulse rounded" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-14 animate-pulse rounded-full" />
                    </td>
                    <td className="px-5 py-4">
                      <div className="bg-sand-100 h-5 w-20 animate-pulse rounded-full" />
                    </td>
                  </tr>
                ))
              ) : reviews.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-petroleum-400 px-6 py-12 text-center"
                  >
                    No reviews found.
                  </td>
                </tr>
              ) : (
                reviews.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => push(`/dashboard/reviews/${r.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors"
                  >
                    <td className="text-petroleum-400 px-5 py-4 font-mono text-xs">
                      {r.display_order}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar initials={r.initials} style={r.style} />
                        <div>
                          <p className="text-petroleum-700 font-medium">
                            {r.name}
                          </p>
                          <p className="text-petroleum-400 text-xs">{r.age}</p>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-xs px-5 py-4">
                      <p className="text-petroleum-500 line-clamp-2 italic">
                        &ldquo;{r.quote}&rdquo;
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <StyleBadge style={r.style} />
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
