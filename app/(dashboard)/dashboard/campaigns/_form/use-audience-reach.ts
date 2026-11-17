"use client";

import { useEffect, useState, type Dispatch } from "react";
import { getAccessToken } from "@/lib/client-session";
import { previewAudience } from "@/actions/campaigns";
import type { FormAction, FormState } from "./form-state";

/**
 * The count of who the audience reaches, from the same resolver the send uses.
 * Every change re-counts after a short pause, so a quick succession of picks
 * costs one request rather than one each. The kind goes along because an
 * appointment notice is counted with its own consent.
 */
export function useAudienceReach(
  state: Pick<FormState, "audience" | "channel" | "kind">,
  dispatch: Dispatch<FormAction>,
): boolean {
  const { audience, channel, kind } = state;
  const [counting, setCounting] = useState(false);
  const audienceKey = JSON.stringify(audience);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setCounting(true);
      void previewAudience(
        getAccessToken(),
        JSON.parse(audienceKey),
        channel,
        kind,
      )
        .catch(() => ({ ok: false as const, error: "generic" }))
        .then((result) => {
          if (cancelled) return;
          setCounting(false);
          dispatch({
            type: "SET_REACH",
            reach:
              "count" in result
                ? {
                    count: result.count,
                    en: result.byLanguage.en,
                    es: result.byLanguage.es,
                  }
                : { count: 0, en: 0, es: 0 },
          });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceKey, channel, kind, dispatch]);

  return counting;
}
