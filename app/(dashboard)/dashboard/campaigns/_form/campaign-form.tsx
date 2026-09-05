"use client";

import { useReducer, type Dispatch } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { getAccessToken } from "@/lib/client-session";
import { notifySuccess } from "@/lib/feedback";
import { validateCampaign } from "@/lib/schemas";
import { INPUT_CLASS } from "@/constants/form-styles";
import { Button } from "@/components/ui/button";
import { TabButton } from "@/components/dashboard/settings/tab-button";
import { useFieldError } from "@/hooks/use-field-error";
import {
  saveCampaign,
  scheduleCampaign,
  sendCampaignNow,
  sendTestCampaign,
} from "@/actions/campaigns";
import type { CampaignRow } from "@/types/campaign";
import { AudienceStep } from "./audience-step";
import { ContentStep } from "./content-step";
import { ReviewStep } from "./review-step";
import {
  firstErroredLocale,
  formReducer,
  initialFormState,
  type FormAction,
  type FormState,
  type PickedContact,
  type Step,
} from "./form-state";

const STEPS: { step: Step; key: "audience" | "content" | "review" }[] = [
  { step: 0, key: "audience" },
  { step: 1, key: "content" },
  { step: 2, key: "review" },
];

/**
 * One form, three steps, for a new campaign and for an existing draft alike.
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
  const fieldError = useFieldError();
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

  /** Validates locally and, when clean, persists. Returns the id or null. */
  async function persist(): Promise<string | null> {
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
        dispatch({ type: "GO", step: 1 });
      } else if (
        Object.keys(check.errors).some((k) => k.startsWith("audience"))
      ) {
        dispatch({ type: "GO", step: 0 });
      }
      toast.error(errorText("invalid"));
      return null;
    }

    dispatch({ type: "SUBMIT_START" });
    const result = await saveCampaign(getAccessToken(), {
      id: state.id,
      name: state.name,
      audience: state.audience,
      content: state.content,
    });
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
  }

  async function handleSaveDraft() {
    const id = await persist();
    if (!id) return;
    notifySuccess(tToasts("campaignSaved"));
    push("/dashboard/campaigns");
  }

  async function handleSchedule(iso: string) {
    const id = await persist();
    if (!id) return;
    const result = await scheduleCampaign(getAccessToken(), id, iso);
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
    const result = await sendCampaignNow(getAccessToken(), id);
    if (!result.ok) {
      dispatch({ type: "SUBMIT_ERROR", message: errorText(result.error) });
      return;
    }
    notifySuccess(tToasts("campaignSent"));
    push(`/dashboard/campaigns/${id}`);
  }

  function next() {
    if (state.step === 0) {
      if (!state.reach || state.reach.count === 0) return;
      dispatch({ type: "GO", step: 1 });
      return;
    }
    if (state.step === 1) {
      const check = validateCampaign({
        name: state.name,
        audience: state.audience,
        content: state.content,
      });
      if (!check.ok) {
        dispatch({ type: "SET_ERRORS", errors: check.errors });
        const locale = firstErroredLocale(check.errors);
        if (locale) dispatch({ type: "SET_LOCALE", locale });
        // A name problem is shown at the top of every step; only content
        // errors keep the admin here.
        if (locale) return;
      }
      dispatch({ type: "GO", step: 2 });
    }
  }

  const canAdvance =
    state.step === 0
      ? Boolean(state.reach && state.reach.count > 0)
      : state.step === 1;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {state.id ? t("form.editTitle") : t("form.newTitle")}
        </h1>
        <NameField
          value={state.name}
          error={fieldError(state.fieldErrors.name)}
          disabled={state.submitting}
          dispatch={dispatch}
        />
        <nav className="border-sand-200 flex gap-1 overflow-x-auto rounded-2xl border bg-white p-2">
          {STEPS.map(({ step, key }) => (
            <TabButton
              key={key}
              active={state.step === step}
              onClick={() => {
                if (step < state.step) dispatch({ type: "GO", step });
              }}
            >
              <span className="text-petroleum-300 mr-1.5 tabular-nums">
                {step + 1}
              </span>
              {t(`steps.${key}`)}
            </TabButton>
          ))}
        </nav>
      </header>

      {state.step === 0 && <AudienceStep state={state} dispatch={dispatch} />}
      {state.step === 1 && <ContentStep state={state} dispatch={dispatch} />}
      {state.step === 2 && (
        <ReviewStep
          state={state}
          onTest={handleTest}
          onSaveDraft={handleSaveDraft}
          onSchedule={handleSchedule}
          onSendNow={handleSendNow}
        />
      )}

      {state.step < 2 && (
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

function NameField({
  value,
  error,
  disabled,
  dispatch,
}: {
  value: string;
  error: string;
  disabled: boolean;
  dispatch: Dispatch<FormAction>;
}) {
  const t = useTranslations("dashboard.campaigns.form");
  return (
    <div className="flex max-w-md flex-col gap-1.5">
      <label
        htmlFor="campaign-name"
        className="text-petroleum-500 text-xs font-medium"
      >
        {t("name")}
      </label>
      <input
        id="campaign-name"
        type="text"
        value={value}
        disabled={disabled}
        placeholder={t("namePlaceholder")}
        onChange={(e) => dispatch({ type: "SET_NAME", value: e.target.value })}
        className={INPUT_CLASS}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
