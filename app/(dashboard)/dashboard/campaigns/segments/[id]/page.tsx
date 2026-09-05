"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { Button } from "@/components/ui/button";
import {
  deleteSegment,
  listSegmentMembers,
  listSegments,
} from "@/actions/campaigns";
import type { CampaignSegment, SegmentMember } from "@/types/campaign";
import { describeAudience } from "../../_form/review-step";
import { EMPTY_AUDIENCE } from "@/types/campaign";

type Loaded =
  | { kind: "loading" }
  | { kind: "missing" }
  | {
      kind: "ready";
      segment: CampaignSegment & { count: number };
      members: SegmentMember[] | null;
    };

const LIST = "/dashboard/campaigns/segments";

/**
 * One segment: what it selects, and who that is today. Edit opens the form;
 * delete asks first. The member list is the resolver's answer at this moment,
 * so it is the list a campaign sent now would go to.
 */
export default function SegmentDetailPage() {
  const t = useTranslations("dashboard.campaigns.segments");
  const tSeg = useTranslations("dashboard.campaigns.segment");
  const tReview = useTranslations("dashboard.campaigns.review");
  const tAudience = useTranslations("dashboard.campaigns.audience");
  const tCommon = useTranslations("dashboard.common");
  const tToasts = useTranslations("dashboard.toasts");
  const { id } = useParams<{ id: string }>();
  const { push, replace } = useRouter();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useDynamicBreadcrumb(loaded.kind === "ready" ? loaded.segment.name : null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listSegments(getAccessToken()).catch(() => ({
        everyone: 0,
        segments: [],
      }));
      const segment = list.segments.find((s) => s.id === id);
      if (cancelled) return;
      if (!segment) {
        setLoaded({ kind: "missing" });
        return;
      }
      setLoaded({ kind: "ready", segment, members: null });
      const members = await listSegmentMembers(
        getAccessToken(),
        segment.conditions,
      ).catch(() => []);
      if (!cancelled) setLoaded({ kind: "ready", segment, members });
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function remove() {
    setBusy(true);
    const result = await deleteSegment(getAccessToken(), id).catch(() => ({
      ok: false as const,
      error: "generic",
    }));
    setBusy(false);
    if (!result.ok) {
      toast.error(tSeg("saveFailed"));
      return;
    }
    notifySuccess(tToasts("segmentDeleted"));
    replace(LIST);
  }

  if (loaded.kind === "loading") {
    return (
      <div className="px-6 py-8 lg:px-10">
        <div className="bg-sand-100 h-10 w-64 animate-pulse rounded-xl" />
        <div className="bg-sand-100 mt-6 h-64 animate-pulse rounded-2xl" />
      </div>
    );
  }
  if (loaded.kind === "missing") {
    return (
      <div className="text-petroleum-400 px-6 py-20 text-center text-sm">
        {t("notFound")}
      </div>
    );
  }

  const { segment, members } = loaded;
  const conditions = describeAudience(
    { ...EMPTY_AUDIENCE, ...segment.conditions },
    tReview,
    tAudience,
  );

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-petroleum-700 truncate text-3xl">
            {segment.name}
          </h1>
          <p className="text-petroleum-400 mt-1 text-sm">
            {t("count", { count: segment.count })}
            {conditions.length > 0 ? ` · ${conditions.join(" · ")}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {confirmDelete ? (
            <>
              <span className="text-petroleum-500 text-xs">
                {t("confirmDelete")}
              </span>
              <Button
                variant="outline"
                size="md"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                size="md"
                disabled={busy}
                className="bg-red-600 hover:bg-red-700"
                onClick={() => void remove()}
              >
                {t("delete")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="md"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                {t("delete")}
              </Button>
              <Button size="md" onClick={() => push(`${LIST}/${id}/edit`)}>
                {t("edit")}
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
        <div className="border-sand-100 border-b px-6 py-4">
          <h2 className="text-petroleum-500 text-sm font-semibold">
            {t("members")}
            {members && (
              <span className="text-petroleum-400 ml-1.5 text-xs">
                {members.length}
              </span>
            )}
          </h2>
        </div>
        {members === null ? (
          <div className="divide-sand-100 divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4">
                <div className="bg-sand-100 h-4 w-56 animate-pulse rounded" />
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
            {t("membersEmpty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-sand-100 border-b text-left">
                  {(
                    [
                      "name",
                      "email",
                      "phone",
                      "language",
                      "newsletter",
                    ] as const
                  ).map((column) => (
                    <th
                      key={column}
                      className="text-petroleum-400 px-6 py-2.5 text-xs font-medium whitespace-nowrap"
                    >
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    onClick={() => push(`/dashboard/contacts/${member.id}`)}
                    className="border-sand-50 hover:bg-sand-50 cursor-pointer border-b transition-colors last:border-0"
                  >
                    <td className="text-petroleum-700 px-6 py-3 font-medium">
                      {[member.first_name, member.last_name]
                        .filter(Boolean)
                        .join(" ") || "—"}
                    </td>
                    <td className="text-petroleum-500 px-6 py-3">
                      {member.email}
                    </td>
                    <td className="text-petroleum-500 px-6 py-3 whitespace-nowrap">
                      {member.phone ?? "—"}
                    </td>
                    <td className="text-petroleum-500 px-6 py-3 uppercase">
                      {member.language}
                    </td>
                    <td className="text-petroleum-500 px-6 py-3">
                      {member.newsletter ? t("subscribed") : t("notSubscribed")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
