"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import {
  fetchCampaign,
  fetchContactsByIds,
  listSegments,
} from "@/actions/campaigns";
import type { CampaignRow } from "@/types/campaign";
import { CampaignForm } from "../../_form/campaign-form";
import type { PickedContact } from "../../_form/form-state";

type Loaded =
  | { kind: "loading" }
  | { kind: "missing" }
  | {
      kind: "ready";
      campaign: CampaignRow;
      picked: PickedContact[];
      segmentName: string | null;
    };

/**
 * A draft, a scheduled campaign or a cancelled one reopened in the editor.
 * Anything already sent has nothing to edit and is shown as a report instead.
 */
export default function EditCampaignPage() {
  const t = useTranslations("dashboard.campaigns.form");
  const { id } = useParams<{ id: string }>();
  const { replace } = useRouter();
  const [loaded, setLoaded] = useState<Loaded>({ kind: "loading" });

  useDynamicBreadcrumb(loaded.kind === "ready" ? loaded.campaign.name : null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { campaign } = await fetchCampaign(getAccessToken(), id).catch(
        () => ({ campaign: null }),
      );
      if (cancelled) return;
      if (!campaign) {
        setLoaded({ kind: "missing" });
        return;
      }
      if (
        !["draft", "scheduled", "cancelled", "failed"].includes(campaign.status)
      ) {
        replace(`/dashboard/campaigns/${id}`);
        return;
      }
      const [picked, segments] = await Promise.all([
        fetchContactsByIds(
          getAccessToken(),
          campaign.audience.manualIds ?? [],
        ).catch(() => []),
        campaign.segment_id
          ? listSegments(getAccessToken()).catch(() => ({
              everyone: 0,
              segments: [],
            }))
          : Promise.resolve({ everyone: 0, segments: [] }),
      ]);
      const segmentName =
        segments.segments.find((s) => s.id === campaign.segment_id)?.name ??
        null;
      if (!cancelled) {
        setLoaded({ kind: "ready", campaign, picked, segmentName });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, replace]);

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
  return (
    <CampaignForm
      key={loaded.campaign.id}
      initial={{
        campaign: loaded.campaign,
        picked: loaded.picked,
        segmentName: loaded.segmentName,
      }}
    />
  );
}
