"use client";

import { useEffect, useState } from "react";
import { getStripeStatus } from "@/actions/payment-status";

export function PaymentGatewayTab() {
  const [status, setStatus] = useState<boolean | null>(null);

  useEffect(() => {
    void getStripeStatus().then((s) => setStatus(s.connected));
  }, []);

  return (
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
        ) : status ? (
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
  );
}
