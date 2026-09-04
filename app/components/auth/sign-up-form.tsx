"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import {
  resendVerificationEmail,
  signUp as signUpAction,
  verifyEmail,
} from "@/actions/auth";
import type { CodeError, SignUpError } from "@/lib/auth-security";
import { useValidationMessage } from "@/hooks/use-validation-message";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";
import { EmailInput } from "@/components/ui/email-input";

async function createProfile(userId: string, fullName: string, email: string) {
  await insforge.database
    .from("profiles")
    .insert([
      { id: userId, role: "contact", full_name: fullName || null, email },
    ]);
}

type Stage = "register" | "verify";

type State = {
  stage: Stage;
  email: string;
  password: string;
  name: string;
  otp: string;
  error: SignUpError | CodeError | null;
  loading: boolean;
};

type Action =
  | { type: "SET_STAGE"; payload: Stage }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_OTP"; payload: string }
  | { type: "SET_ERROR"; payload: SignUpError | CodeError | null }
  | { type: "SET_LOADING"; payload: boolean };

const initialState: State = {
  stage: "register",
  email: "",
  password: "",
  name: "",
  otp: "",
  error: null,
  loading: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_STAGE":
      return { ...state, stage: action.payload };
    case "SET_EMAIL":
      return { ...state, email: action.payload };
    case "SET_PASSWORD":
      return { ...state, password: action.payload };
    case "SET_NAME":
      return { ...state, name: action.payload };
    case "SET_OTP":
      return { ...state, otp: action.payload };
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

export default function SignUpForm() {
  const t = useTranslations("auth.signUp");
  const router = useRouter();
  const { push, refresh } = router;

  const [state, dispatch] = useReducer(reducer, initialState);
  const { stage, email, password, name, otp, error, loading } = state;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    const {
      user,
      requireEmailVerification,
      error: signUpError,
    } = await signUpAction(email, password, name);

    dispatch({ type: "SET_LOADING", payload: false });

    if (signUpError) {
      dispatch({ type: "SET_ERROR", payload: signUpError });
      return;
    }

    if (requireEmailVerification) {
      dispatch({ type: "SET_STAGE", payload: "verify" });
    } else if (user) {
      // The tokens stay on the server now, so a live account is the absence of
      // a verification step rather than an access token in the response.
      await createProfile(user.id, name, email);
      push("/booking");
      refresh();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    const { user, error: verifyError } = await verifyEmail(email, otp);

    dispatch({ type: "SET_LOADING", payload: false });

    if (verifyError) {
      dispatch({ type: "SET_ERROR", payload: verifyError });
      return;
    }

    if (user) {
      await createProfile(user.id, name, email);
      push("/booking");
      refresh();
    }
  };

  const handleResend = async () => {
    dispatch({ type: "SET_ERROR", payload: null });
    const { ok, code } = await resendVerificationEmail(email);
    if (!ok) {
      dispatch({
        type: "SET_ERROR",
        payload:
          code === "throttled"
            ? { code: "throttled", reason: "requests" }
            : { code: "invalid", fields: { email: "emailInvalid" } },
      });
    }
  };

  const validationMessage = useValidationMessage();

  /**
   * The sentence for whatever the server refused with, shared by both stages.
   *
   * `throttled` reads differently either side of the code: before it, too many
   * accounts or too many emails; after it, too many wrong codes. Telling a
   * person to stop asking for codes when their problem is mistyping one is
   * worse than saying nothing.
   */
  const message = !error
    ? null
    : error.code === "bad_code"
      ? t("verify.errorAttempts", { remaining: error.remaining })
      : error.code === "throttled"
        ? t(
            "reason" in error && error.reason === "attempts"
              ? "verify.errorTooManyCodes"
              : "errorThrottled",
          )
        : error.code === "email_taken"
          ? t("errorEmailTaken")
          : error.code === "invalid"
            ? validationMessage(
                ("otp" in error.fields ? error.fields.otp : undefined) ??
                  ("password" in error.fields
                    ? error.fields.password
                    : undefined) ??
                  error.fields.email ??
                  "emailInvalid",
              )
            : t("errorGeneric");

  const warn = error?.code === "bad_code" && error.remaining <= 2;

  // Another submit would only earn the same refusal.
  const halted = error?.code === "throttled";

  if (stage === "verify") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            {t("verify.heading")}
          </h1>
          <p className="text-petroleum-400">
            {t.rich("verify.subheading", {
              email,
              strong: (chunks) => <span className="font-medium">{chunks}</span>,
            })}
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="otp"
              className="text-petroleum-700 text-sm font-medium"
            >
              {t("verify.code")}
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
              placeholder={t("verify.codePlaceholder")}
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
            disabled={loading || halted || otp.length !== 6}
            className="w-full"
          >
            {loading ? t("verify.submitting") : t("verify.submit")}
          </Button>
        </form>

        <p className="text-petroleum-400 text-center text-sm">
          {t("verify.didNotReceive")}{" "}
          <button
            type="button"
            onClick={handleResend}
            className="text-petroleum-700 font-medium underline underline-offset-2"
          >
            {t("verify.resend")}
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

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="text-petroleum-700 text-sm font-medium"
          >
            {t("fullName")}
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) =>
              dispatch({ type: "SET_NAME", payload: e.target.value })
            }
            autoComplete="name"
            placeholder={t("fullNamePlaceholder")}
            className={inputClass}
          />
        </div>

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

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-petroleum-700 text-sm font-medium"
          >
            {t("password")}
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) =>
              dispatch({ type: "SET_PASSWORD", payload: e.target.value })
            }
            required
            autoComplete="new-password"
            placeholder={t("passwordPlaceholder")}
          />
          <p className="text-petroleum-400 text-xs">{t("passwordHint")}</p>
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
          disabled={loading || halted || password.length < 8}
          className="w-full"
        >
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="text-petroleum-400 text-center text-sm">
        {t("hasAccount")}{" "}
        <Link
          href="/sign-in"
          className="text-petroleum-700 font-medium underline underline-offset-2"
        >
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
