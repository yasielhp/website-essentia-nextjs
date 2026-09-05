"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { sendLocaleOf } from "@/lib/schemas";
import { templatesFor } from "@/lib/campaigns/templates";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { Button } from "@/components/ui/button";
import { IconEdit, IconPlus } from "@/components/ui/icons";
import { listCampaignContents } from "@/actions/campaigns";
import type { CampaignContentSummary } from "@/types/campaign";
import type { FormAction, FormState } from "./form-state";

/**
 * Where the words start from: a blank page, one of the house templates, or
 * the body of a campaign already written. Whatever is picked lands in the
 * content step, fully editable; a template is a head start, not a cage.
 */
export function TemplateStep({
  state,
  dispatch,
  onDone,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.campaigns.template");
  const locale = sendLocaleOf(state.audience);
  const current = state.content[locale];
  const hasContent = current.blocks.length > 0 || current.subject !== "";
  const templates = templatesFor(state.kind);

  const [previous, setPrevious] = useState<CampaignContentSummary[] | null>(
    null,
  );
  const [previousId, setPreviousId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listCampaignContents(getAccessToken())
      .catch(() => [])
      .then((rows) => {
        if (!cancelled) {
          setPrevious(rows.filter((row) => row.id !== state.id));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.id]);

  const previousOptions: SelectOption<string>[] = [
    { value: "", label: t("previousPlaceholder") },
    ...(previous ?? []).map((row) => ({
      value: row.id,
      label: row.name,
      desc: row.content[locale]?.subject || row.content.es.subject || "",
    })),
  ];

  function applyTemplate(id: string) {
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    dispatch({
      type: "SET_CONTENT_ALL",
      locale,
      content: structuredClone(template.content[locale]),
    });
    onDone();
  }

  function usePrevious() {
    const row = previous?.find((item) => item.id === previousId);
    if (!row) return;
    const block = row.content[locale] ?? row.content.es;
    dispatch({
      type: "SET_CONTENT_ALL",
      locale,
      content: structuredClone(block),
    });
    onDone();
  }

  const card =
    "flex flex-col gap-1.5 rounded-2xl border p-5 text-left transition-colors border-sand-200 bg-white hover:border-petroleum-400 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="text-petroleum-400 mb-5 text-xs">{t("hint")}</p>

      <div className="flex flex-col gap-6">
        <button
          type="button"
          disabled={state.submitting}
          onClick={onDone}
          className={`${card} flex-row items-center gap-4`}
        >
          <span className="bg-sand-100 text-petroleum-500 flex size-10 shrink-0 items-center justify-center rounded-xl">
            {hasContent ? <IconEdit /> : <IconPlus />}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-petroleum-700 text-sm font-semibold">
              {hasContent ? t("keepCurrent") : t("blank")}
            </span>
            <span className="text-petroleum-400 text-xs">
              {hasContent ? t("keepCurrentHint") : t("blankHint")}
            </span>
          </span>
        </button>

        <div>
          <h3 className="text-petroleum-500 mb-3 text-xs font-semibold tracking-wide uppercase">
            {t("templates")}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                disabled={state.submitting}
                onClick={() => applyTemplate(template.id)}
                className={card}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-petroleum-700 text-sm font-semibold">
                    {t(`names.${template.id}`)}
                  </span>
                  {template.kinds.includes(state.kind) && (
                    <span className="bg-petroleum-50 text-petroleum-500 rounded-full px-2 py-0.5 text-[11px] font-medium">
                      {t("recommended")}
                    </span>
                  )}
                </span>
                <span className="text-petroleum-400 text-xs leading-relaxed">
                  {t(`descriptions.${template.id}`)}
                </span>
                <span className="text-petroleum-400 mt-1 truncate text-xs italic">
                  {template.content[locale].subject}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-petroleum-500 mb-3 text-xs font-semibold tracking-wide uppercase">
            {t("previous")}
          </h3>
          {previous !== null && previous.length === 0 ? (
            <p className="text-petroleum-400 text-xs">{t("previousEmpty")}</p>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="sm:flex-1">
                <OptionSelect
                  id="campaign-previous"
                  value={previousId}
                  options={previousOptions}
                  disabled={state.submitting || previous === null}
                  placeholder={t("previousPlaceholder")}
                  onChange={setPreviousId}
                />
              </div>
              <Button
                variant="soft"
                size="md"
                disabled={state.submitting || previousId === ""}
                onClick={usePrevious}
              >
                {t("usePrevious")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
