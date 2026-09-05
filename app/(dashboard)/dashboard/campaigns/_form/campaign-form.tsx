"use client";

import { useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { validateCampaign, validateCampaignDraft } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import {
  saveCampaign,
  scheduleCampaign,
  sendCampaignNow,
  sendTestCampaign,
} from "@/actions/campaigns";
import type { CampaignRow } from "@/types/campaign";
import { CompletedRow } from "../../bookings/new/completed-row";
import { TypeStep } from "./type-step";
import { AudienceStep } from "./audience-step";
import { ContentStep } from "./content-step";
import { ReviewStep } from "./review-step";
import {
  firstErroredLocale,
  formReducer,
  initialFormState,
  type FormState,
  type PickedContact,
  type Step,
} from "./form-state";

/** Where an error sends the admin: the step that owns the field. */
const STEP_OF = { name: 0, audience: 1, content: 2 } as const;

/**
 * One form, the way the booking form works: each step is a card, a finished
 * step folds into one line with "change", and the next card appears beneath
 * it. There is no step bar and no next/back pair — choosing is advancing.
 *
 * `state.step` is the furthest step reached; `editing` is a finished step
 * reopened by "change", which hides everything after it until it is done again.
 *
 * Every exit — test, draft, schedule, send — saves first, so the server
 * always acts on what the admin is looking at, and a test email cannot go out
 * for a draft that was never stored.
 */
export function CampaignForm({
  initial,
}: {
  /** The campaign being edited, with the names behind its manual picks. */
  initial?: { campaign: CampaignRow; picked: PickedContact[] };
}) {
  const t = useTranslations("dashboard.campaigns");
  const tToasts = useTranslations("dashboard.toasts");
  const tCommon = useTranslations("dashboard.common");
  const { push } = useRouter();
  const [state, dispatch] = useReducer(
    formReducer,
    initial,
    (init): FormState =>
      init
        ? formReducer(initialFormState, {
            type: "LOAD",
            campaign: init.campaign,
            picked: init.picked,
          })
        : initialFormState,
  );
  const [editing, setEditing] = useState<Step | null>(null);

  const errorText = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");

  /** Marks `step` done and opens the next one. */
  function complete(step: Step) {
    setEditing(null);
    if (state.step <= step) {
      dispatch({ type: "GO", step: (step + 1) as Step });
    }
  }

  /** Sends the admin back to the step that owns an error. */
  function reopen(step: Step) {
    setEditing(step);
  }

  /**
   * Validates locally and, when clean, persists. Returns the id or null.
   *
   * A draft is held to draft rules — a name and nothing malformed — so
   * "save draft" means what it says. Everything that leaves the building
   * (test, schedule, send) is held to the full rules.
   */
  async function persist(
    mode: "draft" | "full" = "full",
  ): Promise<string | null> {
    const validate =
      mode === "draft" ? validateCampaignDraft : validateCampaign;
    const check = validate({
      name: state.name,
      audience: state.audience,
      content: state.content,
    });
    if (!check.ok) {
      dispatch({ type: "SET_ERRORS", errors: check.errors });
      const locale = firstErroredLocale(check.errors);
      if (locale) {
        dispatch({ type: "SET_LOCALE", locale });
        reopen(STEP_OF.content);
      } else if (
        Object.keys(check.errors).some((k) => k.startsWith("audience"))
      ) {
        reopen(STEP_OF.audience);
      } else if (check.errors.name) {
        reopen(STEP_OF.name);
      }
      toast.error(errorText("invalid"));
      return null;
    }

    dispatch({ type: "SUBMIT_START" });
    let result: Awaited<ReturnType<typeof saveCampaign>>;
    try {
      result = await saveCampaign(
        getAccessToken(),
        {
          id: state.id,
          name: state.name,
          audience: state.audience,
          content: state.content,
        },
        { draft: mode === "draft" },
      );
    } catch {
      dispatch({ type: "SUBMIT_ERROR", message: errorText("generic") });
      return null;
    }
    if (!result.ok) {
      if (result.fieldErrors) {
        dispatch({ type: "SET_ERRORS", errors: result.fieldErrors });
      }
      dispatch({ type: "SUBMIT_ERROR", message: errorText(result.error) });
      return null;
    }
    dispatch({ type: "SUBMIT_END" });
    return result.id;
  }

  async function handleTest() {
    const id = await persist();
    if (!id) return;
    try {
      const result = await sendTestCampaign(
        getAccessToken(),
        state.content,
        state.audience.language,
      );
      if (result.ok) {
        notifySuccess(tToasts("campaignTestSent", { email: result.to }));
      } else {
        toast.error(errorText(result.error));
      }
    } catch {
      toast.error(errorText("generic"));
    }
  }

  async function handleSaveDraft() {
    const id = await persist("draft");
    if (!id) return;
    notifySuccess(tToasts("campaignSaved"));
    push("/dashboard/campaigns");
  }

  async function handleSchedule(iso: string) {
    const id = await persist();
    if (!id) return;
    const result = await scheduleCampaign(getAccessToken(), id, iso).catch(
      () => ({ ok: false as const, error: "generic" }),
    );
    if (!result.ok) {
      dispatch({ type: "SUBMIT_ERROR", message: errorText(result.error) });
      return;
    }
    notifySuccess(tToasts("campaignScheduled"));
    push("/dashboard/campaigns");
  }

  async function handleSendNow() {
    const id = await persist();
    if (!id) return;
    const result = await sendCampaignNow(getAccessToken(), id).catch(() => ({
      ok: false as const,
      error: "generic",
    }));
    if (!result.ok) {
      dispatch({ type: "SUBMIT_ERROR", message: errorText(result.error) });
      return;
    }
    notifySuccess(tToasts("campaignSent"));
    push(`/dashboard/campaigns/${id}`);
  }

  /** The type step is done when there is a name and a kind has been chosen. */
  function confirmType() {
    if (state.name.trim() === "") {
      dispatch({ type: "SET_ERRORS", errors: { name: "nameRequired" } });
      return;
    }
    complete(0);
  }

  function confirmAudience() {
    if (!state.reach || state.reach.count === 0) return;
    complete(1);
  }

  function confirmContent() {
    const check = validateCampaign({
      name: state.name,
      audience: state.audience,
      content: state.content,
    });
    if (!check.ok) {
      dispatch({ type: "SET_ERRORS", errors: check.errors });
      const locale = firstErroredLocale(check.errors);
      if (locale) {
        dispatch({ type: "SET_LOCALE", locale });
        return;
      }
    }
    complete(2);
  }

  // A step shows when it has been reached and nothing before it is reopened.
  const visible = (step: Step) =>
    state.step >= step && (editing === null || editing >= step);
  const folded = (step: Step) => state.step > step && editing !== step;

  const audienceSummary = state.reach
    ? state.reach.count === 1
      ? t("audience.reachOne")
      : t("audience.reach", { count: state.reach.count })
    : "";
  const contentSummary = (["es", "en"] as const)
    .map((locale) => state.content[locale].subject)
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="px-6 py-8 lg:px-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-baseline gap-3">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {state.id ? t("form.editTitle") : t("form.newTitle")}
          </h1>
          {state.name.trim() && state.step > 0 && (
            <span className="text-petroleum-400 truncate text-sm">
              {state.name}
            </span>
          )}
        </div>
        <div className="hidden items-center gap-3 sm:flex">
          <Button variant="outline" size="md" href="/dashboard/campaigns">
            {tCommon("cancel")}
          </Button>
          <Button
            variant="solid"
            size="md"
            disabled={state.submitting}
            onClick={() => void handleSaveDraft()}
          >
            {t("review.saveDraft")}
          </Button>
        </div>
      </div>

      {state.error && (
        <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {/* ── Step 1: name and kind ── */}
        {folded(0) ? (
          <CompletedRow
            label={t("steps.type")}
            value={`${state.name} · ${t(`type.${state.kind}`)}`}
            onEdit={() => reopen(0)}
          />
        ) : (
          <TypeStep state={state} dispatch={dispatch} onDone={confirmType} />
        )}

        {/* ── Step 2: audience ── */}
        {visible(1) &&
          (folded(1) ? (
            <CompletedRow
              label={t("steps.audience")}
              value={audienceSummary}
              onEdit={() => reopen(1)}
            />
          ) : (
            <AudienceStep
              state={state}
              dispatch={dispatch}
              onDone={confirmAudience}
            />
          ))}

        {/* ── Step 3: content ── */}
        {visible(2) &&
          (folded(2) ? (
            <CompletedRow
              label={t("steps.content")}
              value={contentSummary}
              onEdit={() => reopen(2)}
            />
          ) : (
            <ContentStep
              state={state}
              dispatch={dispatch}
              onDone={confirmContent}
            />
          ))}

        {/* ── Step 4: review and send ── */}
        {visible(3) && (
          <ReviewStep
            state={state}
            onTest={handleTest}
            onSchedule={handleSchedule}
            onSendNow={handleSendNow}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:hidden">
        <Button
          variant="outline"
          size="md"
          href="/dashboard/campaigns"
          className="w-full justify-center"
        >
          {tCommon("cancel")}
        </Button>
        <Button
          variant="solid"
          size="md"
          disabled={state.submitting}
          onClick={() => void handleSaveDraft()}
          className="w-full justify-center"
        >
          {t("review.saveDraft")}
        </Button>
      </div>
    </div>
  );
}
