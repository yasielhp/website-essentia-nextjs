"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { insforge } from "@/lib/insforge";
import { Button } from "@components/ui/button";
import { PasswordInput } from "@components/ui/input";
import { OAuthButton } from "./oauth-button";
import { useAuth } from "@/components/auth-provider";

export default function SignInForm() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      if (error.statusCode === 403) {
        setError("Please verify your email before signing in.");
      } else {
        setError(error.message ?? "Sign in failed. Please try again.");
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
        router.push("/dashboard");
      } else {
        router.push("/account");
      }
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          Welcome back.
        </h1>
        <p className="text-petroleum-400">Sign in to manage your sessions.</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
            className="border-sand-200 text-petroleum-700 placeholder:text-petroleum-100 focus:border-petroleum-400 focus:ring-petroleum-100 rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:ring-2"
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
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-petroleum-400 hover:text-petroleum-700 text-xs transition-colors"
          >
            Forgot password?
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
          {loading ? "Signing in…" : "Sign in"}
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
    </div>
  );
}
