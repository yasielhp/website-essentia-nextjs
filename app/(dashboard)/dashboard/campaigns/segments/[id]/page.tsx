"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import { Button } from "@/components/ui/button";
import {
  HeaderSkeleton,
  TableSkeleton,
} from "@/components/dashboard/skeletons";
import {
  deleteSegment,
  listSegmentMembers,
  listSegmentPeople,
  listSegments,
} from "@/actions/campaigns";
import type { CampaignSegment, SegmentMember } from "@/types/campaign";
import { segmentKindOf } from "@/lib/campaigns/segment-conditions";
import { SegmentKindBadge } from "../_form/kind-badge";
import { Issue } from "../_form/people-table";
import { LoadFailed } from "@/components/dashboard/load-failed";
import { describeAudience } from "../../_form/review-step";
import { EMPTY_AUDIENCE } from "@/types/campaign";

type Loaded =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "missing" }
  | {
      kind: "ready";
      segment: CampaignSegment & { count: number };
      /** What the page lists: who a filter reaches today, or the people of a list. */
      members: Member[] | null;
      /** Reading them failed: said as such, never an empty list. */
      membersFailed?: boolean;
    };

/** A person on the page, with what already keeps a channel from reaching her. */
type Member = SegmentMember & {
  emailIssue?: "unsubscribed" | "bounced" | null;
  whatsappIssue?: "stopped" | "unreachable" | null;
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
  const [attempt, setAttempt] = useState(0);

  useDynamicBreadcrumb(loaded.kind === "ready" ? loaded.segment.name : null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await listSegments(getAccessToken()).catch(() => ({
        failed: true as const,
        everyone: 0,
        segments: [],
      }));
      const segment = list.segments.find((s) => s.id === id);
      if (cancelled) return;
      // A failed read is not "not found": the segment may well be there.
      if (list.failed) {
        setLoaded({ kind: "failed" });
        return;
      }
      if (!segment) {
        setLoaded({ kind: "missing" });
        return;
      }
      setLoaded({ kind: "ready", segment, members: null });
      // A read of the people that failed is not an empty list.
      let members: Member[] | null;
      if (segmentKindOf(segment.conditions) === "list") {
        // A list shows the people picked, with the reasons a channel would
        // not reach some of them, not only who is reached: the difference is
        // the point of showing it. A person deleted since is not there.
        const picked = new Set(segment.conditions.manualIds ?? []);
        const result = await listSegmentPeople(getAccessToken()).catch(
          () => null,
        );
        members =
          result && result.ok
            ? result.people
                .filter((p) => picked.has(p.id))
                .map((p) => ({
                  id: p.id,
                  first_name: p.firstName || null,
                  last_name: p.lastName,
                  email: p.email,
                  phone: p.phone,
                  language: p.language === "es" ? "es" : "en",
                  newsletter: p.newsletter,
                  emailIssue: p.emailIssue,
                  whatsappIssue: p.whatsappIssue,
                }))
            : null;
      } else {
        members = await listSegmentMembers(
          getAccessToken(),
          segment.conditions,
        ).catch(() => null);
      }
      if (cancelled) return;
      if (members === null) {
        setLoaded({
          kind: "ready",
          segment,
          members: null,
          membersFailed: true,
        });
        return;
      }
      if (!cancelled) setLoaded({ kind: "ready", segment, members });
    })();
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

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
        <HeaderSkeleton buttons={2} />
        <div className="border-sand-200 overflow-hidden rounded-2xl border bg-white">
          <TableSkeleton cols={5} />
        </div>
      </div>
    );
  }
  if (loaded.kind === "failed") {
    return (
      <LoadFailed
        onRetry={() => {
          setLoaded({ kind: "loading" });
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (loaded.kind === "missing") {
    return (
      <div className="text-petroleum-400 px-6 py-20 text-center text-sm">
        {t("notFound")}
      </div>
    );
  }

  const { segment, members, membersFailed } = loaded;
  const conditions = describeAudience(
    { ...EMPTY_AUDIENCE, ...segment.conditions },
    tReview,
    tAudience,
  );
  const isList = segmentKindOf(segment.conditions) === "list";
  // The people of the list that still exist, once the page has them.
  const picked = isList
    ? members === null
      ? (segment.conditions.manualIds?.length ?? 0)
      : members.length
    : 0;
  // Until the people are read (or if that failed) the stored ids are not a count.
  const pickedKnown = isList && members !== null;

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-petroleum-700 truncate text-3xl">
            {segment.name}
          </h1>
          <p className="text-petroleum-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <SegmentKindBadge conditions={segment.conditions} />
            {isList && pickedKnown ? (
              <span>
                {t("listReach", { selected: picked, count: segment.count })}
              </span>
            ) : isList ? (
              <span>{t("count", { count: segment.count })}</span>
            ) : (
              <span>
                {t("count", { count: segment.count })}
                {conditions.length > 0 ? ` · ${conditions.join(" · ")}` : ""}
              </span>
            )}
          </p>
          {isList && pickedKnown && picked !== segment.count && (
            <p className="text-petroleum-400 mt-1 text-xs">
              {t("listReachWhy")}
            </p>
          )}
          {/* The count is an email's reach: subscribers only. */}
          <p className="text-petroleum-400 mt-1 text-xs">{t("countNote")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
                variant="danger"
                size="md"
                disabled={busy}
                onClick={() => void remove()}
              >
                {t("delete")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline-danger"
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
        {membersFailed ? (
          <LoadFailed
            className="px-6 py-12"
            onRetry={() => {
              setLoaded({ kind: "loading" });
              setAttempt((n) => n + 1);
            }}
          />
        ) : members === null ? (
          <TableSkeleton cols={5} />
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
                      {/* The row opens the contact for a mouse; the name is the
                          link a keyboard and a screen reader reach. */}
                      <Link
                        href={`/dashboard/contacts/${member.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="focus-visible:ring-petroleum-500 rounded focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {[member.first_name, member.last_name]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </Link>
                    </td>
                    <td className="text-petroleum-500 px-6 py-3">
                      {member.email}
                      {member.emailIssue && (
                        <div>
                          <Issue reason={member.emailIssue} />
                        </div>
                      )}
                    </td>
                    <td className="text-petroleum-500 px-6 py-3 whitespace-nowrap">
                      {member.phone ?? "—"}
                      {member.whatsappIssue && (
                        <div>
                          <Issue reason={member.whatsappIssue} />
                        </div>
                      )}
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
