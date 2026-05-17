"use client";

import { useEffect, useState } from "react";
import { getStripeStatus } from "@/actions/payment-status";
import { syncServiceTiersToStripe } from "@/actions/sync-service-tiers";

type Status = {
  connected: boolean;
  hasSecretKey: boolean;
  hasWebhookSecret: boolean;
  hasPublishableKey: boolean;
};

function EnvVarRow({
  name,
  present,
  note,
}: {
  name: string;
  present: boolean;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex size-4 shrink-0 items-center justify-center rounded-full ${
          present ? "bg-green-100" : "bg-sand-100"
        }`}
      >
        {present ? (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <span className="bg-petroleum-300 size-1.5 rounded-full" />
        )}
      </span>
      <code className="bg-sand-100 text-petroleum-600 rounded px-1.5 py-0.5 font-mono text-xs">
        {name}
      </code>
      {note && <span className="text-petroleum-400 text-xs">{note}</span>}
    </div>
  );
}

export function PaymentGatewayTab() {
  const [status, setStatus] = useState<Status | null>(null);
  const [syncState, setSyncState] = useState<
    "idle" | "syncing" | "done" | "error"
  >("idle");
  const [syncResult, setSyncResult] = useState<{
    synced: number;
    errors: string[];
  } | null>(null);

  useEffect(() => {
    void getStripeStatus().then(setStatus);
  }, []);

  async function handleSyncTiers() {
    setSyncState("syncing");
    setSyncResult(null);
    try {
      const result = await syncServiceTiersToStripe();
      setSyncResult(result);
      setSyncState(result.errors.length > 0 ? "error" : "done");
    } catch (err) {
      setSyncResult({
        synced: 0,
        errors: [err instanceof Error ? err.message : "Unknown error"],
      });
      setSyncState("error");
    }
  }

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/webhooks/stripe`
      : "https://yourdomain.com/api/webhooks/stripe";

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#635BFF]">
              <svg
                width="22"
                height="22"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.0 11.4c0-.8.7-1.1 1.8-1.1 1.6 0 3.6.5 5.2 1.4V7.5a13.8 13.8 0 0 0-5.2-1c-4.2 0-7 2.2-7 5.9 0 5.7 7.9 4.8 7.9 7.3 0 1-.8 1.3-2 1.3-1.7 0-3.9-.7-5.6-1.7v4.3c1.9.8 3.8 1.1 5.6 1.1 4.3 0 7.3-2.1 7.3-5.9-.1-6.2-8-5.1-8-7.4z"
                  fill="white"
                />
              </svg>
            </div>
            <div>
              <p className="text-petroleum-700 text-sm font-semibold">Stripe</p>
              <p className="text-petroleum-400 text-xs">
                Cards, Apple Pay, Google Pay, SEPA
              </p>
            </div>
          </div>

          {status === null ? (
            <div className="bg-sand-100 h-6 w-24 animate-pulse rounded-full" />
          ) : status.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
              <span className="size-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
              <span className="size-1.5 rounded-full bg-red-400" />
              Not connected
            </span>
          )}
        </div>
      </div>

      {/* Env vars status */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
          Environment variables
        </h2>
        <p className="text-petroleum-400 mb-5 text-xs">
          Set these in your hosting provider or in{" "}
          <code className="font-mono">.env.local</code>.
        </p>

        <div className="space-y-3">
          {status === null ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-sand-100 h-5 w-72 animate-pulse rounded"
              />
            ))
          ) : (
            <>
              <EnvVarRow
                name="PAYMENT_PROVIDER"
                present={status.connected}
                note='= "stripe"'
              />
              <EnvVarRow
                name="STRIPE_SECRET_KEY"
                present={status.hasSecretKey}
                note="— Dashboard → API Keys"
              />
              <EnvVarRow
                name="STRIPE_WEBHOOK_SECRET"
                present={status.hasWebhookSecret}
                note="— Dashboard → Webhooks"
              />
              <EnvVarRow
                name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
                present={status.hasPublishableKey}
                note="— Safe to expose"
              />
            </>
          )}
        </div>
      </div>

      {/* Service tiers sync */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
          Service tier products
        </h2>
        <p className="text-petroleum-400 mb-4 text-xs">
          Creates a Stripe product and price for each active service tier. Run
          this once, then again whenever you add or change tiers.
        </p>
        <button
          onClick={() => void handleSyncTiers()}
          disabled={syncState === "syncing" || !status?.connected}
          className="inline-flex items-center gap-2 rounded-lg bg-[#635BFF] px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {syncState === "syncing" ? (
            <>
              <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Syncing…
            </>
          ) : (
            "Sync tiers to Stripe"
          )}
        </button>
        {syncResult && (
          <p
            className={`mt-3 text-xs ${syncState === "error" ? "text-red-500" : "text-green-600"}`}
          >
            {syncState === "done"
              ? `${syncResult.synced} tier${syncResult.synced !== 1 ? "s" : ""} synced successfully.`
              : `${syncResult.synced} synced, ${syncResult.errors.length} error${syncResult.errors.length !== 1 ? "s" : ""}: ${syncResult.errors.join("; ")}`}
          </p>
        )}
        {!status?.connected && status !== null && (
          <p className="text-petroleum-400 mt-2 text-xs">
            Connect Stripe first to enable sync.
          </p>
        )}
      </div>

      {/* Webhook endpoint */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
          Webhook endpoint
        </h2>
        <p className="text-petroleum-400 mb-3 text-xs">
          Register this URL in Stripe Dashboard → Developers → Webhooks.
        </p>
        <code className="text-petroleum-500 block break-all font-mono text-xs">
          {webhookUrl}
        </code>
        <p className="text-petroleum-400 mt-3 text-xs">
          Events:{" "}
          <code className="font-mono">checkout.session.completed</code>,{" "}
          <code className="font-mono">payment_intent.payment_failed</code>,{" "}
          <code className="font-mono">charge.refunded</code>
        </p>
      </div>
    </div>
  );
}
