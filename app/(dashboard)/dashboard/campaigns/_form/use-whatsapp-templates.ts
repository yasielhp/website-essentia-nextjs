"use client";

import { useEffect, useReducer } from "react";
import { listWhatsAppTemplates } from "@/actions/whatsapp-templates";
import { getAccessToken } from "@/lib/client-session";
import type { WhatsAppTemplateRow } from "@/lib/whatsapp/types";

export type TemplatesState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; error: string }
  | {
      status: "ready";
      templates: WhatsAppTemplateRow[];
      /** False when the server has no WhatsApp account to send through. */
      configured: boolean;
    };

type Action =
  | { type: "loading" }
  | { type: "error"; error: string }
  | { type: "ready"; templates: WhatsAppTemplateRow[]; configured: boolean };

function reducer(_: TemplatesState, action: Action): TemplatesState {
  switch (action.type) {
    case "loading":
      return { status: "loading" };
    case "error":
      return { status: "error", error: action.error };
    case "ready":
      return {
        status: "ready",
        templates: action.templates,
        configured: action.configured,
      };
  }
}

/**
 * The account's WhatsApp templates, loaded once when `enabled` turns true (a
 * WhatsApp campaign), for the step that picks one and the review that shows
 * it. `error` is the action's key, for the caller to translate.
 */
export function useWhatsAppTemplates(enabled: boolean): TemplatesState {
  const [state, dispatch] = useReducer(reducer, { status: "idle" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    dispatch({ type: "loading" });
    void listWhatsAppTemplates(getAccessToken())
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          dispatch({
            type: "ready",
            templates: result.templates,
            configured: result.configured,
          });
        } else {
          dispatch({ type: "error", error: result.error });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "error", error: "generic" });
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return state;
}
