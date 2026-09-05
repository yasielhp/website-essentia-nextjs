"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { useFieldError } from "@/hooks/use-field-error";
import { useDynamicBreadcrumb } from "@/context/breadcrumb-context";
import {
  deleteSegment,
  previewAudience,
  saveSegment,
} from "@/actions/campaigns";
import {
  EMPTY_AUDIENCE,
  type CampaignAudience,
  type CampaignSegment,
} from "@/types/campaign";
import { AudienceConditions, conditionsOf } from "../../_form/audience-step";
import type { FormAction } from "../../_form/form-state";

const LIST = "/dashboard/campaigns/segments";
const detailOf = (id: string) => `${LIST}/${id}`;

/**
 * One segment, new or existing: its name and its conditions, with cancel and
 * save up top the way the booking form does it, and a live count of who it
 * reaches today. Deleting lives on the segment's own page.
 */
export function SegmentForm({
  segment,
}: {
  segment?: CampaignSegment & { count?: number };
}) {
  const t = useTranslations("dashboard.campaigns.segments");
  const tSeg = useTranslations("dashboard.campaigns.segment");
  const tCommon = useTranslations("dashboard.common");
  const tToasts = useTranslations("dashboard.toasts");
  const fieldError = useFieldError();
  const { push } = useRouter();

  const [name, setName] = useState(segment?.name ?? "");
  const [audience, setAudience] = useState<CampaignAudience>({
    ...EMPTY_AUDIENCE,
    ...segment?.conditions,
  });
  const [reach, setReach] = useState<number | null>(segment?.count ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDynamicBreadcrumb(segment?.name ?? null);

  // The count follows the conditions, after a short pause.
  const audienceKey = JSON.stringify(audience);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewAudience(getAccessToken(), JSON.parse(audienceKey))
        .catch(() => ({ ok: false as const, error: "generic" }))
        .then((result) => {
          if (!cancelled) setReach("count" in result ? result.count : 0);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceKey]);

  // The condition controls speak the campaign form's action shape; only
  // SET_AUDIENCE ever arrives here.
  const dispatch: Dispatch<FormAction> = (action) => {
    if (action.type !== "SET_AUDIENCE") return;
    setAudience((current) => {
      const next = { ...current, ...action.patch };
      if (next.neverBooked) {
        next.services = [];
        next.lastBooking = null;
        next.hasBooked = false;
      }
      return next;
    });
  };

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(fieldError("nameRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await saveSegment(getAccessToken(), {
      id: segment?.id ?? null,
      name: trimmed,
      conditions: conditionsOf(audience),
    }).catch(() => ({ ok: false as const, error: "generic" }));
    setSaving(false);
    if (!result.ok) {
      setError(
        result.error === "nameTaken"
          ? fieldError("nameTaken")
          : tSeg("saveFailed"),
      );
      return;
    }
    notifySuccess(tToasts("segmentSaved"));
    push(result.segment ? detailOf(result.segment.id) : LIST);
  }

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="font-display text-petroleum-700 truncate text-3xl">
          {segment ? segment.name : t("new")}
        </h1>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="md"
            href={segment ? detailOf(segment.id) : LIST}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            size="md"
            disabled={saving || name.trim() === ""}
            onClick={() => void save()}
          >
            {saving ? tSeg("saving") : tCommon("save")}
          </Button>
        </div>
      </div>

      <section className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="segment-name"
              className="text-petroleum-500 text-xs font-medium"
            >
              {tSeg("name")}
            </label>
            <input
              id="segment-name"
              type="text"
              autoFocus={!segment}
              value={name}
              disabled={saving}
              placeholder={tSeg("namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <AudienceConditions
            audience={audience}
            fieldErrors={{}}
            disabled={saving}
            dispatch={dispatch}
          />

          <div className="border-sand-100 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-petroleum-500 text-sm">
              {reach === null ? t("counting") : t("reach", { count: reach })}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
