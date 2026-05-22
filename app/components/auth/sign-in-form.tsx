"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { insforge } from "@/lib/insforge";
import { signInSchema, parseErrors } from "@/lib/schemas";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";
import { useAuth } from "@/components/auth-provider";

export default function SignInForm() {
  const t = useTranslations("auth.signIn");
  const router = useRouter();
  const { push } = router;
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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

    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.statusCode === 403) {
        setError(t("errorVerify"));
      } else {
        setError(error.message ?? t("errorGeneric"));
      }
      return;
    }

    if (data?.user) {
      const { data: profileData } = await insforge.database
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();

      const role = (profileData as { role: string } | null)?.role;
      await refreshUser();

      if (role === "admin" || role === "staff") {
        push("/dashboard");
      } else if (role === "partner") {
        push("/dashboard");
      } else {
        push("/account");
      }
    }
  };

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
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setFieldErrors((p) => ({ ...p, email: undefined }));
            }}
            autoComplete="email"
            placeholder={t("emailPlaceholder")}
            className={`text-petroleum-700 placeholder:text-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2 ${fieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-sand-200 focus:border-petroleum-400 focus:ring-petroleum-100"}`}
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-500">{fieldErrors.email}</p>
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
            }}
            autoComplete="current-password"
            placeholder={t("passwordPlaceholder")}
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-500">{fieldErrors.password}</p>
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
    </div>
  );
}
