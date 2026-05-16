"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { insforge } from "@/lib/insforge";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";
import { OAuthButton } from "./oauth-button";

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
        payload: signUpError.message ?? "Sign up failed. Please try again.",
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
          payload: "Invalid or expired code. Please try again.",
        });
      } else {
        dispatch({
          type: "SET_ERROR",
          payload: verifyError.message ?? "Verification failed.",
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
            Check your email.
          </h1>
          <p className="text-petroleum-400">
            We sent a 6-digit code to{" "}
            <span className="font-medium">{email}</span>.
          </p>
        </div>

        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="otp"
              className="text-petroleum-700 text-sm font-medium"
            >
              Verification code
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
              placeholder="123456"
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
            {loading ? "Verifying…" : "Verify email"}
          </Button>
        </form>

        <p className="text-petroleum-400 text-center text-sm">
          Did not receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            className="text-petroleum-700 font-medium underline underline-offset-2"
          >
            Resend
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          Create account.
        </h1>
        <p className="text-petroleum-400">
          Join Essentia to manage your sessions.
        </p>
      </div>

      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="name"
            className="text-petroleum-700 text-sm font-medium"
          >
            Full name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) =>
              dispatch({ type: "SET_NAME", payload: e.target.value })
            }
            autoComplete="name"
            placeholder="Jane Doe"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-petroleum-700 text-sm font-medium"
          >
            Email
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
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-petroleum-700 text-sm font-medium"
          >
            Password
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) =>
              dispatch({ type: "SET_PASSWORD", payload: e.target.value })
            }
            required
            autoComplete="new-password"
            placeholder="••••••••"
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
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="bg-sand-200 h-px flex-1" />
        <span className="text-petroleum-400 text-xs tracking-widest uppercase">
          or
        </span>
        <div className="bg-sand-200 h-px flex-1" />
      </div>

      <OAuthButton provider="google" redirectTo="/booking" />

      <p className="text-petroleum-400 text-center text-sm">
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="text-petroleum-700 font-medium underline underline-offset-2"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
