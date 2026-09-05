"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { listSegments } from "@/actions/campaigns";
import type { SegmentList } from "@/types/campaign";

/**
 * Saved segments: named sets of conditions the campaign form picks from.
 * Built on their own pages, not inside a campaign, so a segment is a thing in
 * its own right — reused, renamed, retired.
 */
export default function SegmentsPage() {
  const t = useTranslations("dashboard.campaigns.segments");
  const { push } = useRouter();
  const [list, setList] = useState<SegmentList | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listSegments(getAccessToken())
      .catch(() => ({ everyone: 0, segments: [] }))
      .then((rows) => {
        if (!cancelled) setList(rows);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Button href="/dashboard/campaigns/segments/new" className="gap-2">
          <IconPlus />
          {t("new")}
        </Button>
        <Button variant="outline" size="md" href="/dashboard/campaigns">
          {t("back")}
        </Button>
      </div>

      <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
        {list === null ? (
          <div className="divide-sand-100 divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-5 py-4">
                <div className="bg-sand-100 h-4 w-48 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : list.segments.length === 0 ? (
          <p className="text-petroleum-400 px-5 py-16 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-sand-100 divide-y">
            {list.segments.map((segment) => (
              <li key={segment.id}>
                <button
                  type="button"
                  onClick={() =>
                    push(`/dashboard/campaigns/segments/${segment.id}`)
                  }
                  className="hover:bg-sand-50 flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors"
                >
                  <span className="text-petroleum-700 truncate text-sm font-medium">
                    {segment.name}
                  </span>
                  <span className="text-petroleum-500 shrink-0 text-sm tabular-nums">
                    {t("count", { count: segment.count })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
