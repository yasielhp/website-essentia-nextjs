"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { CardSkeleton, HeaderSkeleton } from "@/components/dashboard/skeletons";
import { listSegments } from "@/actions/campaigns";
import type { CampaignSegment } from "@/types/campaign";
import { SegmentForm } from "../../_form/segment-form";
import { LoadFailed } from "@/components/dashboard/load-failed";

type Loaded =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "missing" }
  | { kind: "ready"; segment: CampaignSegment & { count: number } };

export default function EditSegmentPage() {
  const t = useTranslations("dashboard.campaigns.segments");
  const { id } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void listSegments(getAccessToken())
      .catch(() => ({ failed: true as const, everyone: 0, segments: [] }))
      .then((list) => {
        if (cancelled) return;
        // A failed read is not "not found".
        if (list.failed) {
          setLoaded({ kind: "failed" });
          return;
        }
        const segment = list.segments.find((s) => s.id === id);
        setLoaded(segment ? { kind: "ready", segment } : { kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (loaded.kind === "loading") {
    return (
      <div className="px-6 py-8 lg:px-10">
        <HeaderSkeleton buttons={2} />
        <CardSkeleton lines={4} />
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
  return <SegmentForm key={loaded.segment.id} segment={loaded.segment} />;
}
