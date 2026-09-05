"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { validateCampaign, validateCampaignDraft } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import {
  saveCampaign,
  scheduleCampaign,
  sendCampaignNow,
  sendTestCampaign,
} from "@/actions/campaigns";
import type { CampaignRow } from "@/types/campaign";
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

const STEPS: {
  step: Step;
  key: "type" | "audience" | "content" | "review";
}[] = [
  { step: 0, key: "type" },
  { step: 1, key: "audience" },
  { step: 2, key: "content" },
  { step: 3, key: "review" },
];

/** Where an error sends the admin: the step that owns the field. */
const STEP_OF = { name: 0, audience: 1, content: 2 } as const;

/**
 * One form, four steps, for a new campaign and for an existing draft alike.
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

  const errorText = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");

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
        dispatch({ type: "GO", step: STEP_OF.content });
      } else if (
        Object.keys(check.errors).some((k) => k.startsWith("audience"))
      ) {
        dispatch({ type: "GO", step: STEP_OF.audience });
      } else if (check.errors.name) {
        dispatch({ type: "GO", step: STEP_OF.name });
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

  function next() {
    if (state.step === 0) {
      if (state.name.trim() === "") {
        dispatch({ type: "SET_ERRORS", errors: { name: "nameRequired" } });
        return;
      }
      dispatch({ type: "GO", step: 1 });
      return;
    }
    if (state.step === 1) {
      if (!state.reach || state.reach.count === 0) return;
      dispatch({ type: "GO", step: 2 });
      return;
    }
    if (state.step === 2) {
      const check = validateCampaign({
        name: state.name,
        audience: state.audience,
        content: state.content,
      });
      if (!check.ok) {
        dispatch({ type: "SET_ERRORS", errors: check.errors });
        const locale = firstErroredLocale(check.errors);
        // Only content errors keep the admin here; anything else is shown
        // on its own step when they get back to it.
        if (locale) {
          dispatch({ type: "SET_LOCALE", locale });
          return;
        }
      }
      dispatch({ type: "GO", step: 3 });
    }
  }

  const canAdvance =
    state.step === 0
      ? state.name.trim() !== ""
      : state.step === 1
        ? Boolean(state.reach && state.reach.count > 0)
        : state.step === 2;

  return (
    <div className="mx-auto flex flex-col gap-6 px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-petroleum-700 text-3xl">
            {state.id ? t("form.editTitle") : t("form.newTitle")}
          </h1>
          {state.name.trim() && state.step > 0 && (
            <span className="text-petroleum-400 truncate text-sm">
              {state.name}
            </span>
          )}
        </div>
        <nav className="border-sand-200 flex gap-1 overflow-x-auto rounded-2xl border bg-white p-2">
          {STEPS.map(({ step, key }) => (
            <TabButton
              key={key}
              active={state.step === step}
              onClick={() => {
                if (step < state.step) dispatch({ type: "GO", step });
              }}
            >
              <span className="text-petroleum-400 mr-1.5 tabular-nums">
                {step + 1}
              </span>
              {t(`steps.${key}`)}
            </TabButton>
          ))}
        </nav>
      </header>

      {state.step === 0 && <TypeStep state={state} dispatch={dispatch} />}
      {state.step === 1 && <AudienceStep state={state} dispatch={dispatch} />}
      {state.step === 2 && <ContentStep state={state} dispatch={dispatch} />}
      {state.step === 3 && (
        <ReviewStep
          state={state}
          onTest={handleTest}
          onSaveDraft={handleSaveDraft}
          onSchedule={handleSchedule}
          onSendNow={handleSendNow}
        />
      )}

      {state.step < 3 && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="md"
            disabled={state.step === 0 || state.submitting}
            onClick={() =>
              dispatch({ type: "GO", step: (state.step - 1) as Step })
            }
          >
            {t("form.back")}
          </Button>
          <Button
            size="md"
            disabled={!canAdvance || state.submitting}
            onClick={next}
          >
            {t("form.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
