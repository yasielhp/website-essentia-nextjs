"use client";

import { useEffect, useState } from "react";
import { previewMessage } from "@/actions/message-templates";
import { getAccessToken } from "@/lib/client-session";
import type { MessageKey } from "@/lib/messages/catalog";

export type Problems = {
  fieldErrors: Record<string, string>;
  names: string | null;
};

export type PreviewState = {
  /** The last email that could be drawn; null until the first one. */
  html: string | null;
  /** The newest draft could not be drawn; `html` is the one before it. */
  failed: boolean;
  /** Why, when it was not the draft's fault (a lapsed session, the limit). */
  failure: string | null;
  /** What is wrong with the draft, when that is why. */
  problems: Problems | null;
};

const FIRST: PreviewState = {
  html: null,
  failed: false,
  failure: null,
  problems: null,
};

/**
 * The live preview of an email draft: asks the server to draw it half a second
 * after the draft stops changing and keeps the answer.
 *
 * `draft` is the changes against the default text, serialised (a string, so
 * that an unchanged draft does not ask again). When the server refuses the
 * draft the previous email stays on screen with what is wrong; when it refuses
 * for another reason (the session lapsed, too many previews) `failure` carries
 * that action error key for the caller to say in words.
 */
export function useMessagePreview(
  key: MessageKey,
  locale: "es" | "en",
  draft: string,
): PreviewState {
  const [state, setState] = useState<PreviewState>(FIRST);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void previewMessage(getAccessToken(), key, locale, JSON.parse(draft))
        .catch(() => null)
        .then((result) => {
          if (cancelled) return;
          if (!result) {
            setState((before) => ({
              ...before,
              failed: true,
              failure: "generic",
            }));
          } else if (result.ok) {
            setState({
              html: result.html,
              failed: false,
              failure: null,
              problems: null,
            });
          } else if (result.error === "invalid") {
            setState((before) => ({
              ...before,
              failed: true,
              failure: null,
              problems: {
                fieldErrors: result.fieldErrors ?? {},
                names: result.detail ?? null,
              },
            }));
          } else {
            setState((before) => ({
              ...before,
              failed: true,
              failure: result.error,
              problems: null,
            }));
          }
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft, key, locale]);

  return state;
}
