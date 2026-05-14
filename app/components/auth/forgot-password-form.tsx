"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { insforge } from "@/lib/insforge";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";

type Stage = "email" | "reset";

const inputClass =
  "border-sand-200 bg-white text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2";

export default function ForgotPasswordForm() {
  const router = useRouter();

  const [stage, setStage] = useState<Stage>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const sendCode = async () => {
    await insforge.auth.sendResetPasswordEmail({
      email,
      redirectTo: window.location.origin + "/sign-in",
    });
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await sendCode();
      setStage("reset");
    } catch {
      setError("Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: exchangeError } =
        await insforge.auth.exchangeResetPasswordToken({ email, code: otp });

      if (exchangeError || !data) {
        if (exchangeError?.statusCode === 400) {
          setError("Invalid or expired code.");
        } else {
          setError(exchangeError?.message ?? "Reset failed. Please try again.");
        }
        setLoading(false);
        return;
      }

      const { error: resetError } = await insforge.auth.resetPassword({
        newPassword,
        otp: data.token,
      });

      if (resetError) {
        setError(resetError.message ?? "Reset failed. Please try again.");
        setLoading(false);
        return;
      }

      router.push("/sign-in?reset=1");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    try {
      await sendCode();
    } catch {
      setError("Failed to resend code. Please try again.");
    }
  };

  if (stage === "reset") {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
            Enter your new password.
          </h1>
          <p className="text-petroleum-400">
            We sent a 6-digit code to{" "}
            <span className="font-medium">{email}</span>.
          </p>
        </div>

        <form onSubmit={handleReset} className="flex flex-col gap-4">
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
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              required
              autoComplete="one-time-code"
              placeholder="123456"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="new-password"
              className="text-petroleum-700 text-sm font-medium"
            >
              New password
            </label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
            disabled={loading || otp.length !== 6 || newPassword.length === 0}
            className="w-full"
          >
            {loading ? "Resetting…" : "Reset password"}
          </Button>
        </form>

        <p className="text-petroleum-400 text-center text-sm">
          Did not receive the code?{" "}
          <button
            type="button"
            onClick={handleResend}
            className="text-petroleum-700 font-medium underline underline-offset-2"
          >
            Resend code
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          Reset your password.
        </h1>
        <p className="text-petroleum-400">
          Enter your email and we&apos;ll send you a code.
        </p>
      </div>

      <form onSubmit={handleSendCode} className="flex flex-col gap-4">
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
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
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
          {loading ? "Sending…" : "Send reset code"}
        </Button>
      </form>

      <p className="text-petroleum-400 text-center text-sm">
        <Link
          href="/sign-in"
          className="text-petroleum-700 font-medium underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
