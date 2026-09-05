"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { Button } from "@/components/ui/button";
import { IconPlus } from "@/components/ui/icons";
import { TableSkeleton } from "@/components/dashboard/skeletons";
import { listSegments } from "@/actions/campaigns";
import { EMPTY_AUDIENCE, type SegmentList } from "@/types/campaign";
import { useDashboardLocale } from "@/hooks/use-dashboard-locale";
import { formatMediumDate } from "@/utils/format";
import { describeAudience } from "../_form/review-step";

const TH =
  "text-petroleum-400 px-5 py-3 text-left text-xs font-medium whitespace-nowrap";

/**
 * Saved segments: named sets of conditions the campaign form picks from.
 * Built on their own pages, not inside a campaign, so a segment is a thing in
 * its own right — reused, renamed, retired.
 */
export default function SegmentsPage() {
  const t = useTranslations("dashboard.campaigns.segments");
  const tReview = useTranslations("dashboard.campaigns.review");
  const tAudience = useTranslations("dashboard.campaigns.audience");
  const locale = useDashboardLocale();
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
          <TableSkeleton cols={4} />
        ) : list.segments.length === 0 ? (
          <p className="text-petroleum-400 px-5 py-16 text-center text-sm">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-100 border-b">
                  <th className={TH}>{t("table.created")}</th>
                  <th className={TH}>{t("table.name")}</th>
                  <th className={TH}>{t("table.conditions")}</th>
                  <th className={`${TH} text-right`}>{t("table.people")}</th>
                </tr>
              </thead>
              <tbody>
                {list.segments.map((segment) => {
                  const conditions = describeAudience(
                    { ...EMPTY_AUDIENCE, ...segment.conditions },
                    tReview,
                    tAudience,
                  );
                  return (
                    <tr
                      key={segment.id}
                      onClick={() =>
                        push(`/dashboard/campaigns/segments/${segment.id}`)
                      }
                      className="border-sand-100 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                    >
                      <td className="text-petroleum-500 px-5 py-3.5 text-xs whitespace-nowrap">
                        {formatMediumDate(segment.created_at, locale)}
                      </td>
                      <td className="text-petroleum-700 px-5 py-3.5 font-medium">
                        {segment.name}
                      </td>
                      <td className="text-petroleum-500 max-w-md truncate px-5 py-3.5 text-xs">
                        {conditions.length > 0
                          ? conditions.join(" · ")
                          : t("noConditions")}
                      </td>
                      <td className="text-petroleum-500 px-5 py-3.5 text-right tabular-nums">
                        {segment.count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
