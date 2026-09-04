"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { resetPassword, sendResetPasswordEmail } from "@/actions/auth";
import type { CodeError } from "@/lib/auth-security";
import { useValidationMessage } from "@/hooks/use-validation-message";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";
import { EmailInput } from "@/components/ui/email-input";

type Stage = "email" | "reset";

type State = {
  stage: Stage;
  email: string;
  otp: string;
  newPassword: string;
  error: CodeError | null;
  loading: boolean;
};

type Action =
  | { type: "SET_STAGE"; payload: Stage }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_OTP"; payload: string }
  | { type: "SET_NEW_PASSWORD"; payload: string }
  | { type: "SET_ERROR"; payload: CodeError | null }
  | { type: "SET_LOADING"; payload: boolean };

const initialState: State = {
  stage: "email",
  email: "",
  otp: "",
  newPassword: "",
  error: null,
  loading: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STAGE":
      return { ...state, stage: action.payload };
    case "SET_EMAIL":
      return { ...state, email: action.payload };
    case "SET_OTP":
      return { ...state, otp: action.payload };
    case "SET_NEW_PASSWORD":
      return { ...state, newPassword: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

const inputClass =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2";

export default function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const router = useRouter();
  const { push } = router;

  const [state, dispatch] = useReducer(reducer, initialState);
  const { stage, email, otp, newPassword, error, loading } = state;

  /**
   * Asks for a code. The server answers the same whether or not the address
   * has an account behind it, so this only ever fails for a malformed address
   * or a caller asking too often.
   */
  const sendCode = async () => {
    const { ok, code } = await sendResetPasswordEmail(email);
    if (!ok) {
      dispatch({
        type: "SET_ERROR",
        payload:
          code === "throttled"
            ? { code: "throttled", reason: "requests" }
            : { code: "invalid", fields: { email: "emailInvalid" } },
      });
    }
    return ok;
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Always on to the code step when the request went through — pausing
      // here for an address with no account would answer the one question this
      // form must not answer.
      if (await sendCode()) {
        dispatch({ type: "SET_STAGE", payload: "reset" });
      }
    } catch {
      dispatch({ type: "SET_ERROR", payload: { code: "generic" } });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Both halves run on the server: the code is exchanged for a short-lived
      // token that sets the new password, and that token never reaches the
      // page it was minted for.
      const { ok, error } = await resetPassword(email, otp, newPassword);

      if (!ok) {
        dispatch({ type: "SET_ERROR", payload: error });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      push("/sign-in?reset=1");
    } catch {
      dispatch({ type: "SET_ERROR", payload: { code: "generic" } });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const handleResend = async () => {
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      await sendCode();
    } catch {
      dispatch({ type: "SET_ERROR", payload: { code: "generic" } });
    }
  };

  const validationMessage = useValidationMessage();

  /**
   * The sentence for whatever the server refused with, shared by both stages.
   *
   * `bad_code` counts down like the sign-in does, and reveals nothing: the
   * count is the same whether or not the address has an account, because the
   * code is wrong either way.
   */
  const message = !error
    ? null
    : error.code === "bad_code"
      ? t("reset.errorAttempts", { remaining: error.remaining })
      : error.code === "throttled"
        ? t(
            error.reason === "attempts"
              ? "reset.errorTooManyCodes"
              : "errorThrottled",
          )
        : error.code === "invalid"
          ? validationMessage(
              error.fields.otp ??
                error.fields.newPassword ??
                error.fields.email ??
                "emailInvalid",
            )
          : t("errorGeneric");

  const warn = error?.code === "bad_code" && error.remaining <= 2;

  // Out of code attempts, or out of requests: another submit would only earn
  // the same refusal.
  const halted = error?.code === "throttled";

  if (stage === "reset") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            {t("reset.heading")}
          </h1>
          <p className="text-petroleum-400">
            {t.rich("reset.subheading", {
              email,
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
        </div>

        <form onSubmit={handleReset} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="otp"
              className="text-petroleum-700 text-sm font-medium"
            >
              {t("reset.code")}
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                dispatch({
                  type: "SET_OTP",
                  payload: e.target.value.replace(/\D/g, ""),
                })
              }
              required
              autoComplete="one-time-code"
              placeholder={t("reset.codePlaceholder")}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-password"
              className="text-petroleum-700 text-sm font-medium"
            >
              {t("reset.newPassword")}
            </label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) =>
                dispatch({ type: "SET_NEW_PASSWORD", payload: e.target.value })
              }
              required
              autoComplete="new-password"
              placeholder={t("reset.newPasswordPlaceholder")}
            />
            <p className="text-petroleum-400 text-xs">
              {t("reset.passwordHint")}
            </p>
          </div>

          {error && (
            <p
              className={`text-sm ${warn ? "text-amber-700" : "text-red-600"}`}
              role="alert"
            >
              {message}
            </p>
          )}

          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={
              loading || halted || otp.length !== 6 || newPassword.length < 8
            }
            className="w-full"
          >
            {loading ? t("reset.submitting") : t("reset.submit")}
          </Button>
        </form>

        <p className="text-petroleum-400 text-center text-sm">
          {t("reset.didNotReceive")}{" "}
          <button
            type="button"
            onClick={handleResend}
            className="text-petroleum-700 font-medium underline underline-offset-2"
          >
            {t("reset.resend")}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {t("heading")}
        </h1>
        <p className="text-petroleum-400">{t("subheading")}</p>
      </div>

      <form onSubmit={handleSendCode} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-700 text-sm font-medium"
          >
            {t("email")}
          </label>
          <EmailInput
            id="email"
            value={email}
            onChange={(value) =>
              dispatch({ type: "SET_EMAIL", payload: value })
            }
            required
            placeholder={t("emailPlaceholder")}
            className={inputClass}
          />
        </div>

        {error && (
          <p
            className={`text-sm ${warn ? "text-amber-700" : "text-red-600"}`}
            role="alert"
          >
            {message}
          </p>
        )}

        <Button
          type="submit"
          variant="solid"
          size="md"
          disabled={loading || halted}
          className="w-full"
        >
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="text-petroleum-400 text-center text-sm">
        <Link
          href="/sign-in"
          className="text-petroleum-700 font-medium underline underline-offset-2"
        >
          {t("backToSignIn")}
        </Link>
      </p>
    </div>
  );
}
