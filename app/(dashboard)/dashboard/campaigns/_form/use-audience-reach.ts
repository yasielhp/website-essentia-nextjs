"use client";

import { useEffect, useState, type Dispatch } from "react";
import { getAccessToken } from "@/lib/client-session";
import { previewAudience } from "@/actions/campaigns";
import { reachOutcome } from "@/lib/campaigns/audience-reach";
import type { FormAction, FormState } from "./form-state";

/**
 * The count of who the audience reaches, from the same resolver the send uses.
 * Every change re-counts after a short pause, so a quick succession of picks
 * costs one request rather than one each. The kind goes along because an
 * appointment notice is counted with its own consent.
 *
 * A query that fails is not a count of zero: the reach is cleared (so the
 * audience cannot be confirmed on it) and `failed` says so, with `retry` to ask
 * again.
 */
export function useAudienceReach(
  state: Pick<FormState, "audience" | "channel" | "kind">,
  dispatch: Dispatch<FormAction>,
): { counting: boolean; failed: boolean; retry: () => void } {
  const { audience, channel, kind } = state;
  const [counting, setCounting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
        .catch(() => null)
        .then((result) => {
          if (cancelled) return;
          setCounting(false);
          const outcome = reachOutcome(result);
          setFailed(!outcome.ok);
          dispatch({
            type: "SET_REACH",
            reach: outcome.ok ? outcome.reach : null,
          });
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceKey, channel, kind, attempt, dispatch]);

  return { counting, failed, retry: () => setAttempt((n) => n + 1) };
}
