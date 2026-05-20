"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@components/ui/button";
import { unsubscribeFromNewsletter } from "@/actions/newsletter";

type State = "idle" | "loading" | "success" | "error";

function UnsubscribeContent() {
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [state, setState] = useState<State>("idle");

  const handleUnsubscribe = async () => {
    if (!email) return;
    setState("loading");
    const result = await unsubscribeFromNewsletter(email);
    setState(result.ok ? "success" : "error");
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

          {!email && (
            <p className="text-xs text-red-500">
              No email address provided. Please use the link from your email.
            </p>
          )}

          <div className="flex flex-col gap-3">
            <Button
              variant="solid"
              size="md"
              onClick={handleUnsubscribe}
              disabled={state === "loading" || !email}
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

export default function UnsubscribePage() {
  return (
    <section className="bg-sand-50 flex min-h-dvh items-center justify-center px-5">
      <Suspense>
        <UnsubscribeContent />
      </Suspense>
    </section>
  );
}
