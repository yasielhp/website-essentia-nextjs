"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { listSegments } from "@/actions/campaigns";
import type { CampaignSegment } from "@/types/campaign";
import { SegmentForm } from "../../_form/segment-form";

type Loaded =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; segment: CampaignSegment & { count: number } };

export default function EditSegmentPage() {
  const t = useTranslations("dashboard.campaigns.segments");
  const { id } = useParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void listSegments(getAccessToken())
      .catch(() => ({ everyone: 0, segments: [] }))
      .then((list) => {
        if (cancelled) return;
        const segment = list.segments.find((s) => s.id === id);
        setLoaded(segment ? { kind: "ready", segment } : { kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

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
  return <SegmentForm key={loaded.segment.id} segment={loaded.segment} />;
}
