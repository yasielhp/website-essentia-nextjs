"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@components/ui/button";
import {
  fetchUnsubscribeEmail,
  unsubscribeByToken,
} from "@/actions/newsletter";

type State = "idle" | "loading" | "success" | "error";

function UnsubscribeContent() {
  const params = useSearchParams();
  // The token is the credential. The address is looked up from it, never read
  // from the URL: with `?email=` anyone could unsubscribe anyone.
  const token = params.get("token") ?? "";
  const [email, setEmail] = useState<string | null>(null);
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    let cancelled = false;
    if (!token) return;
    void fetchUnsubscribeEmail(token).then((found) => {
      if (!cancelled) setEmail(found);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setState("loading");
    try {
      const result = await unsubscribeByToken(token);
      setState(result.ok ? "success" : "error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="mx-auto w-full max-w-md text-center">
      {state === "success" ? (
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-petroleum-700 text-3xl">
            Unsubscribed.
          </h1>
          <p className="text-petroleum-400 text-sm leading-relaxed">
            You&apos;ve been removed from our newsletter. You won&apos;t receive
            further emails from Essentia.
          </p>
          <Link
            href="/"
            className="text-petroleum-500 hover:text-petroleum-700 mt-2 text-sm underline underline-offset-4 transition-colors"
          >
            Back to Essentia
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-petroleum-700 text-3xl">
              Unsubscribe
            </h1>
            <p className="text-petroleum-400 text-sm leading-relaxed">
              You are about to unsubscribe{" "}
              {email ? (
                <strong className="text-petroleum-600">{email}</strong>
              ) : (
                "your email address"
              )}{" "}
              from the Essentia newsletter.
            </p>
          </div>

          {!token && (
            <p className="text-xs text-red-500">
              This link is incomplete. Please use the one from your email.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              variant="solid"
              size="md"
              onClick={handleUnsubscribe}
              disabled={state === "loading" || !token}
              className="w-full"
            >
              {state === "loading" ? "Processing…" : "Confirm unsubscribe"}
            </Button>

            <Link
              href="/"
              className="text-petroleum-400 hover:text-petroleum-600 text-sm transition-colors"
            >
              Cancel — keep me subscribed
            </Link>
          </div>

          {state === "error" && (
            <p role="alert" className="text-xs text-red-500">
              Something went wrong. Please try again or contact us at{" "}
              <a
                href="mailto:info@essentiawellnessclub.com"
                className="underline underline-offset-2"
              >
                info@essentiawellnessclub.com
              </a>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function UnsubscribeClientPage() {
  return (
    <section className="bg-sand-50 flex min-h-dvh items-center justify-center px-5">
      <Suspense>
        <UnsubscribeContent />
      </Suspense>
    </section>
  );
}
