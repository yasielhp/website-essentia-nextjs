"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { INPUT_CLASS } from "@/constants/form-styles";
import { IconX } from "@/components/ui/icons";
import { searchContactsForCampaign } from "@/actions/campaigns";
import type { ContactSearchHit } from "@/types/campaign";
import type { FormAction, PickedContact } from "./form-state";

/**
 * Contacts added by hand, on top of whatever the conditions select.
 *
 * The search runs on the server behind the admin role, debounced so a name
 * typed at speed costs one round trip rather than one per keystroke.
 */
export function ContactPicker({
  picked,
  dispatch,
  disabled,
}: {
  picked: PickedContact[];
  dispatch: Dispatch<FormAction>;
  disabled: boolean;
}) {
  const t = useTranslations("dashboard.campaigns.audience");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContactSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      const clear = setTimeout(() => setHits([]), 0);
      return () => clearTimeout(clear);
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      void searchContactsForCampaign(getAccessToken(), term)
        .catch(() => [])
        .then((found) => {
          if (cancelled) return;
          setHits(found);
          setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const pickedIds = new Set(picked.map((c) => c.id));
  const visible = hits.filter((hit) => !pickedIds.has(hit.id));

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("manualSearch")}
        disabled={disabled}
        aria-label={t("manual")}
        className={INPUT_CLASS}
      />

      {query.trim().length >= 2 && (
        <ul className="border-sand-200 divide-sand-100 max-h-56 divide-y overflow-y-auto rounded-xl border bg-white">
          {searching && visible.length === 0 ? (
            <li className="text-petroleum-400 px-4 py-3 text-sm">
              {t("counting")}
            </li>
          ) : visible.length === 0 ? (
            <li className="text-petroleum-400 px-4 py-3 text-sm">
              {t("manualNone")}
            </li>
          ) : (
            visible.map((hit) => (
              <li
                key={hit.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-petroleum-700 truncate text-sm">
                    {hit.name || hit.email}
                  </p>
                  <p className="text-petroleum-400 truncate text-xs">
                    {hit.email} · {hit.language.toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    dispatch({
                      type: "ADD_MANUAL",
                      contact: { id: hit.id, name: hit.name, email: hit.email },
                    });
                    setQuery("");
                  }}
                  className="text-petroleum-500 hover:text-petroleum-700 shrink-0 text-sm font-medium"
                >
                  {t("manualAdd")}
                </button>
              </li>
            ))
          )}
        </ul>
      )}

      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {picked.map((contact) => (
            <li
              key={contact.id}
              className="bg-sand-100 text-petroleum-700 flex items-center gap-1.5 rounded-full py-1 pr-1.5 pl-3 text-xs"
            >
              <span className="max-w-48 truncate">
                {contact.name || contact.email}
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  dispatch({ type: "REMOVE_MANUAL", id: contact.id })
                }
                aria-label={t("manualRemove", {
                  name: contact.name || contact.email,
                })}
                className="text-petroleum-400 hover:text-petroleum-700 rounded-full p-0.5"
              >
                <IconX />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
