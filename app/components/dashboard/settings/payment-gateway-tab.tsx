"use client";

import { useReducer } from "react";
import { INPUT_CLASS } from "@/constants/form-styles";

type Provider = "stripe" | "redsys" | "";

type FormState = {
  provider: Provider;
  stripePublishableKey: string;
  stripeSecretKeyHint: string;
  stripeWebhookHint: string;
  redsysMerchantCode: string;
  redsysTerminal: string;
  redsysEnvironment: "test" | "live";
  saved: boolean;
};

type FormAction =
  | { type: "SET_PROVIDER"; provider: Provider }
  | {
      type: "SET_FIELD";
      field: keyof Omit<FormState, "provider" | "saved">;
      value: string;
    }
  | { type: "SAVED" };

const initial: FormState = {
  provider: "",
  stripePublishableKey: "",
  stripeSecretKeyHint: "",
  stripeWebhookHint: "",
  redsysMerchantCode: "",
  redsysTerminal: "1",
  redsysEnvironment: "test",
  saved: false,
};

function reducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_PROVIDER":
      return { ...state, provider: action.provider, saved: false };
    case "SET_FIELD":
      return { ...state, [action.field]: action.value, saved: false };
    case "SAVED":
      return { ...state, saved: true };
    default:
      return state;
  }
}

function EnvVarChip({ name }: { name: string }) {
  return (
    <code className="bg-sand-100 text-petroleum-600 rounded px-1.5 py-0.5 font-mono text-xs">
      {name}
    </code>
  );
}

function ProviderCard({
  name,
  logo,
  description,
  selected,
  onClick,
}: {
  name: string;
  logo: React.ReactNode;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-4 rounded-2xl border p-5 text-left transition-all ${
        selected
          ? "border-petroleum-700 bg-petroleum-50 ring-petroleum-700 ring-1"
          : "border-sand-200 hover:border-sand-300 bg-white"
      }`}
    >
      <div className="mt-0.5 shrink-0">{logo}</div>
      <div>
        <p className="text-petroleum-700 text-sm font-semibold">{name}</p>
        <p className="text-petroleum-400 mt-0.5 text-xs">{description}</p>
      </div>
      <div className="mt-0.5 ml-auto shrink-0">
        <div
          className={`flex size-4 items-center justify-center rounded-full border-2 ${
            selected ? "border-petroleum-700" : "border-sand-300"
          }`}
        >
          {selected && <div className="bg-petroleum-700 size-2 rounded-full" />}
        </div>
      </div>
    </button>
  );
}

export function PaymentGatewayTab() {
  const [form, dispatch] = useReducer(reducer, initial);

  function setField(
    field: keyof Omit<FormState, "provider" | "saved">,
    value: string,
  ) {
    dispatch({ type: "SET_FIELD", field, value });
  }

  return (
    <div className="space-y-6">
      {/* Provider selection */}
      <div className="border-sand-200 rounded-2xl border bg-white p-6">
        <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
          Payment provider
        </h2>
        <p className="text-petroleum-400 mb-5 text-xs">
          Select the payment gateway you want to use. Each provider requires
          environment variables set on your server.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProviderCard
            name="Stripe"
            logo={
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="32" height="32" rx="8" fill="#635BFF" />
                <path
                  d="M15.0 11.4c0-.8.7-1.1 1.8-1.1 1.6 0 3.6.5 5.2 1.4V7.5a13.8 13.8 0 0 0-5.2-1c-4.2 0-7 2.2-7 5.9 0 5.7 7.9 4.8 7.9 7.3 0 1-.8 1.3-2 1.3-1.7 0-3.9-.7-5.6-1.7v4.3c1.9.8 3.8 1.1 5.6 1.1 4.3 0 7.3-2.1 7.3-5.9-.1-6.2-8-5.1-8-7.4z"
                  fill="white"
                />
              </svg>
            }
            description="Cards, Apple Pay, Google Pay, SEPA. Global coverage."
            selected={form.provider === "stripe"}
            onClick={() =>
              dispatch({ type: "SET_PROVIDER", provider: "stripe" })
            }
          />
          <ProviderCard
            name="Redsys"
            logo={
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <rect width="32" height="32" rx="8" fill="#E30613" />
                <text
                  x="50%"
                  y="55%"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  fill="white"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="system-ui"
                >
                  RS
                </text>
              </svg>
            }
            description="Spanish banking gateway. Required for many Spanish banks."
            selected={form.provider === "redsys"}
            onClick={() =>
              dispatch({ type: "SET_PROVIDER", provider: "redsys" })
            }
          />
        </div>
      </div>

      {/* Stripe config */}
      {form.provider === "stripe" && (
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
            Stripe configuration
          </h2>
          <p className="text-petroleum-400 mb-5 text-xs">
            Set these environment variables in your hosting provider (Vercel,
            etc.) or in your <code className="font-mono">.env.local</code> file.
            Secret keys are never stored in the database.
          </p>

          <div className="space-y-5">
            <div className="bg-sand-50 border-sand-200 rounded-xl border p-4">
              <p className="text-petroleum-600 mb-2 text-xs font-medium">
                Required environment variables
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <EnvVarChip name="PAYMENT_PROVIDER" />
                  <span className="text-petroleum-400">=</span>
                  <code className="text-petroleum-500 font-mono">stripe</code>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="STRIPE_SECRET_KEY" />
                  <span className="text-petroleum-400">
                    — From Stripe Dashboard → API Keys
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="STRIPE_WEBHOOK_SECRET" />
                  <span className="text-petroleum-400">
                    — From Stripe Dashboard → Webhooks
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />
                  <span className="text-petroleum-400">
                    — Safe to expose in the browser
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="stripe-pub-key"
                className="text-petroleum-500 text-xs font-medium"
              >
                Publishable key{" "}
                <span className="text-petroleum-400 font-normal">
                  (optional — shown publicly)
                </span>
              </label>
              <input
                id="stripe-pub-key"
                type="text"
                value={form.stripePublishableKey}
                onChange={(e) =>
                  setField("stripePublishableKey", e.target.value)
                }
                placeholder="pk_live_…"
                className={INPUT_CLASS}
              />
              <p className="text-petroleum-400 text-xs">
                Used to initialise Stripe.js on the client side. Store as{" "}
                <EnvVarChip name="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" />.
              </p>
            </div>

            <div className="bg-sand-50 border-sand-200 rounded-xl border p-4">
              <p className="text-petroleum-600 mb-1.5 text-xs font-medium">
                Webhook endpoint to register in Stripe
              </p>
              <code className="text-petroleum-500 font-mono text-xs break-all">
                {typeof window !== "undefined"
                  ? window.location.origin
                  : "https://yourdomain.com"}
                /api/webhooks/stripe
              </code>
              <p className="text-petroleum-400 mt-1.5 text-xs">
                Events to listen:{" "}
                <code className="font-mono">checkout.session.completed</code>,{" "}
                <code className="font-mono">payment_intent.payment_failed</code>
                , <code className="font-mono">charge.refunded</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Redsys config */}
      {form.provider === "redsys" && (
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
            Redsys configuration
          </h2>
          <p className="text-petroleum-400 mb-5 text-xs">
            Credentials provided by your bank or Redsys directly. The secret key
            (SHA-256) must be set as an environment variable.
          </p>

          <div className="space-y-5">
            <div className="bg-sand-50 border-sand-200 rounded-xl border p-4">
              <p className="text-petroleum-600 mb-2 text-xs font-medium">
                Required environment variables
              </p>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <EnvVarChip name="PAYMENT_PROVIDER" />
                  <span className="text-petroleum-400">=</span>
                  <code className="text-petroleum-500 font-mono">redsys</code>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="REDSYS_MERCHANT_CODE" />
                  <span className="text-petroleum-400">
                    — Provided by your bank (9 digits)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="REDSYS_TERMINAL" />
                  <span className="text-petroleum-400">
                    — Terminal number (usually 1)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="REDSYS_SECRET_KEY" />
                  <span className="text-petroleum-400">
                    — SHA-256 key from Redsys admin
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <EnvVarChip name="REDSYS_ENVIRONMENT" />
                  <span className="text-petroleum-400">
                    = <code className="font-mono">test</code> or{" "}
                    <code className="font-mono">live</code>
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="redsys-merchant"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Merchant code
                </label>
                <input
                  id="redsys-merchant"
                  type="text"
                  value={form.redsysMerchantCode}
                  onChange={(e) =>
                    setField("redsysMerchantCode", e.target.value)
                  }
                  placeholder="999008881"
                  className={INPUT_CLASS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="redsys-terminal"
                  className="text-petroleum-500 text-xs font-medium"
                >
                  Terminal
                </label>
                <input
                  id="redsys-terminal"
                  type="text"
                  value={form.redsysTerminal}
                  onChange={(e) => setField("redsysTerminal", e.target.value)}
                  placeholder="1"
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-petroleum-500 text-xs font-medium">
                Environment
              </span>
              <div className="flex gap-3">
                {(["test", "live"] as const).map((env) => (
                  <label
                    key={env}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="radio"
                      name="redsys-env"
                      value={env}
                      checked={form.redsysEnvironment === env}
                      onChange={() => setField("redsysEnvironment", env)}
                      className="accent-petroleum-700"
                    />
                    <span className="text-petroleum-600 text-sm capitalize">
                      {env}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-sand-50 border-sand-200 rounded-xl border p-4">
              <p className="text-petroleum-600 mb-1.5 text-xs font-medium">
                Notification URL (DS_MERCHANT_MERCHANTURL)
              </p>
              <code className="text-petroleum-500 font-mono text-xs break-all">
                {typeof window !== "undefined"
                  ? window.location.origin
                  : "https://yourdomain.com"}
                /api/webhooks/redsys
              </code>
            </div>
          </div>
        </div>
      )}

      {/* How-to info */}
      {!form.provider && (
        <div className="border-sand-200 rounded-2xl border bg-white p-6">
          <h2 className="text-petroleum-700 mb-1 text-sm font-semibold">
            How it works
          </h2>
          <ol className="text-petroleum-500 mt-3 space-y-2 text-sm">
            <li className="flex gap-3">
              <span className="bg-petroleum-700 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                1
              </span>
              Select a payment provider above.
            </li>
            <li className="flex gap-3">
              <span className="bg-petroleum-700 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                2
              </span>
              Set the required environment variables in your hosting platform.
            </li>
            <li className="flex gap-3">
              <span className="bg-petroleum-700 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                3
              </span>
              Register the webhook endpoint in your provider dashboard.
            </li>
            <li className="flex gap-3">
              <span className="bg-petroleum-700 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white">
                4
              </span>
              Use{" "}
              <code className="text-petroleum-600 font-mono text-xs">
                createProviderFromEnv()
              </code>{" "}
              from{" "}
              <code className="text-petroleum-600 font-mono text-xs">
                @/lib/payments
              </code>{" "}
              in your server actions.
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
