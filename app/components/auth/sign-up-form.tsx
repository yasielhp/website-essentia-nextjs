"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";

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
  error: string | null;
  loading: boolean;
};

type Action =
  | { type: "SET_STAGE"; payload: Stage }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_PASSWORD"; payload: string }
  | { type: "SET_NAME"; payload: string }
  | { type: "SET_OTP"; payload: string }
  | { type: "SET_ERROR"; payload: string | null }
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

    const { data, error: signUpError } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: `${window.location.origin}/sign-in`,
    });

    dispatch({ type: "SET_LOADING", payload: false });

    if (signUpError) {
      dispatch({
        type: "SET_ERROR",
        payload: signUpError.message ?? t("errorGeneric"),
      });
      return;
    }

    if (data?.requireEmailVerification) {
      dispatch({ type: "SET_STAGE", payload: "verify" });
    } else if (data?.accessToken && data.user) {
      await createProfile(data.user.id, name, email);
      push("/booking");
      refresh();
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_ERROR", payload: null });
    dispatch({ type: "SET_LOADING", payload: true });

    const { data, error: verifyError } = await insforge.auth.verifyEmail({
      email,
      otp,
    });

    dispatch({ type: "SET_LOADING", payload: false });

    if (verifyError) {
      if (verifyError.statusCode === 400) {
        dispatch({
          type: "SET_ERROR",
          payload: t("verify.errorInvalidCode"),
        });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: verifyError.message ?? t("verify.errorGeneric"),
        });
      }
      return;
    }

    if (data?.user) {
      await createProfile(data.user.id, name, email);
      push("/booking");
      refresh();
    }
  };

  const handleResend = async () => {
    dispatch({ type: "SET_ERROR", payload: null });
    await insforge.auth.resendVerificationEmail({
      email,
      redirectTo: `${window.location.origin}/sign-in`,
    });
  };

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
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={loading || otp.length !== 6}
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
