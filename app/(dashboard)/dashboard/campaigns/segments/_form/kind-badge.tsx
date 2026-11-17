"use client";

import { useTranslations } from "next-intl";
import { segmentKindOf } from "@/lib/campaigns/segment-conditions";
import type { SegmentConditions } from "@/types/campaign";

/** "By filter" or "Manual list": which kind of segment it is, in words. */
export function SegmentKindBadge({
  conditions,
}: {
  conditions: SegmentConditions;
}) {
  const t = useTranslations("dashboard.campaigns.segments.kind");
  const kind = segmentKindOf(conditions);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
        kind === "list"
          ? "bg-green-100 text-green-800"
          : "bg-sand-100 text-petroleum-500"
      }`}
    >
      {t(kind)}
    </span>
  );
}
