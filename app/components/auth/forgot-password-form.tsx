"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";

type Stage = "email" | "reset";

type State = {
  stage: Stage;
  email: string;
  otp: string;
  newPassword: string;
  error: string | null;
  loading: boolean;
};

type Action =
  | { type: "SET_STAGE"; payload: Stage }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_OTP"; payload: string }
  | { type: "SET_NEW_PASSWORD"; payload: string }
  | { type: "SET_ERROR"; payload: string | null }
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

  const sendCode = async () => {
    await insforge.auth.sendResetPasswordEmail({
      email,
      redirectTo: window.location.origin + "/sign-in",
    });
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      await sendCode();
      dispatch({ type: "SET_STAGE", payload: "reset" });
    } catch {
      dispatch({
        type: "SET_ERROR",
        payload: t("errorSendCode"),
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      const { data, error: exchangeError } =
        await insforge.auth.exchangeResetPasswordToken({ email, code: otp });

      if (exchangeError || !data) {
        if (exchangeError?.statusCode === 400) {
          dispatch({
            type: "SET_ERROR",
            payload: t("reset.errorInvalidCode"),
          });
        } else {
          dispatch({
            type: "SET_ERROR",
            payload: exchangeError?.message ?? t("reset.errorResetFailed"),
          });
        }
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      const { error: resetError } = await insforge.auth.resetPassword({
        newPassword,
        otp: data.token,
      });

      if (resetError) {
        dispatch({
          type: "SET_ERROR",
          payload: resetError.message ?? t("reset.errorResetFailed"),
        });
        dispatch({ type: "SET_LOADING", payload: false });
        return;
      }

      push("/sign-in?reset=1");
    } catch {
      dispatch({
        type: "SET_ERROR",
        payload: t("errorGeneric"),
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const handleResend = async () => {
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      await sendCode();
    } catch {
      dispatch({
        type: "SET_ERROR",
        payload: t("reset.errorResendFailed"),
      });
    }
  };

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
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={loading || otp.length !== 6 || newPassword.length === 0}
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
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) =>
              dispatch({ type: "SET_EMAIL", payload: e.target.value })
            }
            required
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          variant="solid"
          size="md"
          disabled={loading}
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
