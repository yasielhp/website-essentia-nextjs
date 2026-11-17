"use client";

import { useTranslations } from "next-intl";
import { segmentKindOf } from "@/lib/campaigns/segment-conditions";
import type { SegmentConditions } from "@/types/campaign";

/** "By filter" or "Manual list": which kind of segment it is, in words. */
export function SegmentKindBadge({
  conditions,
  kind: given,
  title,
}: {
  /** What a saved segment holds; its kind is read from it. */
  conditions?: SegmentConditions;
  /** The kind itself, for a screen where it changes as the admin picks people. */
  kind?: "filter" | "list";
  /** The long explanation, as a tooltip. */
  title?: string;
}) {
  const t = useTranslations("dashboard.campaigns.segments.kind");
  const kind = given ?? (conditions ? segmentKindOf(conditions) : "filter");
  return (
    <span
      title={title}
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
