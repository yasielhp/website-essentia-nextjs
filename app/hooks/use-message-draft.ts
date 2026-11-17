"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDraft,
  readDraft,
  sessionDraftStorage,
  writeDraft,
  type DraftKind,
} from "@/lib/messages/draft";

/**
 * The local draft of a message page (see `lib/messages/draft.ts`): kept in the
 * tab's `sessionStorage` while there is something unsaved, offered, not applied,
 * when the page is opened again, and forgotten when the text is saved, reset,
 * discarded or back to what is saved.
 *
 * It writes half a second after the last change, and once more when the page is
 * left (the back button, a reload), so the last words are not lost to the pause.
 * Nothing here reaches the server.
 */
export function useMessageDraft<T>({
  kind,
  storageKey,
  validate,
  offerOf,
  current,
  dirty,
  snapshot,
}: {
  kind: DraftKind;
  storageKey: string;
  validate: (data: unknown) => T | null;
  /** The stored draft if it is worth offering (it differs from what is saved). */
  offerOf: (draft: T | null) => T | null;
  current: T;
  /** There is something unsaved. */
  dirty: boolean;
  /** The text as it is this instant, for the last write; defaults to `current`. */
  snapshot?: () => T;
}) {
  const [offered, setOffered] = useState<T | null>(() =>
    offerOf(readDraft(sessionDraftStorage(), storageKey, kind, validate)),
  );
  const forgotten = useRef(false);
  const latest = useRef({ current, dirty, offered, snapshot });
  useEffect(() => {
    latest.current = { current, dirty, offered, snapshot };
  });

  // Keep the draft while there is something unsaved; drop it when there is not.
  // While one is on offer it is left alone: the person has not answered yet.
  useEffect(() => {
    if (offered !== null || forgotten.current) return;
    const storage = sessionDraftStorage();
    if (!dirty) {
      clearDraft(storage, storageKey);
      return;
    }
    const timer = setTimeout(
      () => writeDraft(storage, storageKey, kind, current),
      1000,
    );
    return () => clearTimeout(timer);
  }, [current, dirty, offered, kind, storageKey]);

  // The last write, on the way out.
  useEffect(() => {
    function flush() {
      const state = latest.current;
      if (forgotten.current || state.offered !== null || !state.dirty) return;
      let text = state.current;
      try {
        text = state.snapshot ? state.snapshot() : state.current;
      } catch {
        // The editor may already be gone: what was last known is kept.
      }
      writeDraft(sessionDraftStorage(), storageKey, kind, text);
    }
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [kind, storageKey]);

  /** The offered draft, to be applied by the caller; the offer is over. */
  const take = useCallback((): T | null => {
    const draft = latest.current.offered;
    setOffered(null);
    return draft;
  }, []);

  /** The offer is declined: the draft is deleted. */
  const discard = useCallback(() => {
    clearDraft(sessionDraftStorage(), storageKey);
    setOffered(null);
  }, [storageKey]);

  /** The text was reset or removed on purpose: nothing is kept, even on the way out. */
  const forget = useCallback(() => {
    forgotten.current = true;
    clearDraft(sessionDraftStorage(), storageKey);
  }, [storageKey]);

  return { offered, take, discard, forget };
}
