"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { signInWithPassword } from "@/actions/auth";
import { signInSchema, parseErrors } from "@/lib/schemas";
import type { SignInError } from "@/lib/auth-security";
import { useValidationMessage } from "@/hooks/use-validation-message";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";
import { useAuth } from "@/components/auth-provider";
import { EmailInput } from "@/components/ui/email-input";

export default function SignInForm() {
  const t = useTranslations("auth.signIn");
  const router = useRouter();
  const { push } = router;
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<SignInError | null>(null);
  const validationMessage = useValidationMessage();
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const errs = parseErrors(signInSchema, { email, password });
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    // The session cookies are written by the server, which also reports the
    // role: the browser has no session of its own until the next page load, so
    // asking it here sent every partner to the wrong place.
    let user, role, error;
    try {
      ({ user, role, error } = await signInWithPassword(email, password));
    } finally {
      setLoading(false);
    }

    if (error) {
      // The server sends a code, never a sentence: the wording lives in
      // `messages/` so it is translated, and Insforge's own phrasing never
      // reaches the screen.
      if (error.code === "invalid") {
        setFieldErrors(error.fields);
        return;
      }
      setError(error);
      return;
    }

    if (user) {
      await refreshUser();

      const toDashboard =
        role === "admin" || role === "staff" || role === "partner";
      push(toDashboard ? "/dashboard" : "/account");
    }
  };

  /**
   * The sentence for whatever the server refused with.
   *
   * `bad_credentials` is the only one that carries a number, and the last two
   * attempts are amber rather than red: a warning the client reads before
   * spending the fifth is worth more than a fifth error in the same colour as
   * the first.
   */
  const message = !error
    ? null
    : error.code === "bad_credentials"
      ? t("errorAttempts", { remaining: error.remaining })
      : error.code === "locked"
        ? t("errorLocked")
        : error.code === "ip_rate_limited"
          ? t("errorRateLimited")
          : error.code === "unverified"
            ? t("errorVerify")
            : t("errorGeneric");

  const warn = error?.code === "bad_credentials" && error.remaining <= 2;

  // Nothing to gain from a sixth attempt against a locked account, and the
  // disabled button says so more plainly than the paragraph above it.
  const locked = error?.code === "locked" || error?.code === "ip_rate_limited";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {t("heading")}
        </h1>
        <p className="text-petroleum-400">{t("subheading")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            onChange={(value) => {
              setEmail(value);
              setFieldErrors((p) => ({ ...p, email: undefined }));
              // Clears the banner, which also frees the button again: after a
              // rate limit the wait is over as soon as the client comes back
              // to try, and a form that stays dead until a reload reads as
              // broken rather than as protected.
              setError(null);
            }}
            hasError={!!fieldErrors.email}
            placeholder={t("emailPlaceholder")}
            className={`text-petroleum-700 placeholder:text-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 ${fieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-sand-200 focus:border-petroleum-400 focus:ring-petroleum-100"}`}
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-500">
              {validationMessage(fieldErrors.email)}
            </p>
          )}
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
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((p) => ({ ...p, password: undefined }));
              setError(null);
            }}
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-500">
              {validationMessage(fieldErrors.password)}
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-petroleum-400 hover:text-petroleum-700 text-xs transition-colors"
          >
            {t("forgotPassword")}
          </Link>
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
          disabled={loading || locked}
          className="w-full"
        >
          {loading ? t("submitting") : t("submit")}
        </Button>
      </form>
    </div>
  );
}
