"use client";

import { useEffect, useState, type Dispatch } from "react";
import { useTranslations } from "next-intl";
import { getAccessToken } from "@/lib/client-session";
import { sendLocaleOf } from "@/lib/schemas";
import { templatesFor } from "@/lib/campaigns/templates";
import { blocksToDoc, docIsEmpty } from "@/lib/campaigns/doc";
import { OptionSelect, type SelectOption } from "@/components/ui/option-select";
import { Button } from "@/components/ui/button";
import { IconEdit, IconPlus } from "@/components/ui/icons";
import { startChoices, BLANK_START } from "@/lib/campaigns/start-choices";
import { listCampaignContents } from "@/actions/campaigns";
import type { CampaignContentSummary } from "@/types/campaign";
import type { FormAction, FormState } from "./form-state";

/**
 * Where the words start from: a blank page, one of the house templates, or
 * the body of a campaign already written. Whatever is picked lands in the
 * content step, fully editable; a template is a head start, not a cage.
 *
 * The blank page and the house templates are ONE select (picture, name and
 * description of each); picking one does what pressing its card did: the arrow
 * keys only walk the list. The campaigns already written keep their own select
 * and button below.
 */
export function TemplateStep({
  state,
  dispatch,
  onDone,
  onPick,
}: {
  state: FormState;
  dispatch: Dispatch<FormAction>;
  onDone: () => void;
  /** Says what was picked (its name), for the folded summary of the step. */
  onPick?: (name: string) => void;
}) {
  const t = useTranslations("dashboard.campaigns.template");
  const locale = sendLocaleOf(state.audience);
  const current = state.content[locale];
  const hasContent = !docIsEmpty(current.doc) || current.subject !== "";
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
    const { blocks, ...rest } = template.content[locale];
    dispatch({
      type: "SET_CONTENT_ALL",
      locale,
      content: { ...rest, doc: blocksToDoc(blocks) },
    });
    onPick?.(t(`names.${template.id}`));
    onDone();
  }

  /** The blank page (or the text already there): nothing changes, the step is done. */
  function keepAsIs() {
    onPick?.(hasContent ? t("keepCurrent") : t("blank"));
    onDone();
  }

  const start = startChoices(templates, state.kind);
  const startOptions: SelectOption<string>[] = start.map((choice) =>
    choice.type === "blank"
      ? {
          value: BLANK_START,
          label: hasContent ? t("keepCurrent") : t("blank"),
          desc: hasContent ? t("keepCurrentHint") : t("blankHint"),
          icon: hasContent ? <IconEdit /> : <IconPlus />,
        }
      : {
          value: choice.id,
          label: t(`names.${choice.id}`),
          desc: t(`descriptions.${choice.id}`),
          badge: choice.recommended ? t("recommended") : undefined,
        },
  );

  function usePrevious() {
    const row = previous?.find((item) => item.id === previousId);
    if (!row) return;
    const block = row.content[locale] ?? row.content.es;
    dispatch({
      type: "SET_CONTENT_ALL",
      locale,
      content: structuredClone(block),
    });
    onPick?.(row.name);
    onDone();
  }

  return (
    <section className="border-sand-200 animate-fade-in-up rounded-2xl border bg-white p-6">
      <h2 className="text-petroleum-500 mb-1 text-sm font-semibold">
        {t("title")}
      </h2>
      <p className="text-petroleum-400 mb-5 text-xs">{t("hint")}</p>

      <div className="flex flex-col gap-6">
        <OptionSelect
          id="campaign-start"
          ariaLabel={t("title")}
          // Nothing is chosen until something is picked: the placeholder says so.
          value=""
          options={startOptions}
          disabled={state.submitting}
          placeholder={t("startPlaceholder")}
          // Only an activated option chooses: the arrows walk the list.
          commitOnArrows={false}
          onChange={(value) =>
            value === BLANK_START ? keepAsIs() : applyTemplate(value)
          }
        />

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
