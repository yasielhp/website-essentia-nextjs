"use client";

import { useEffect, useState } from "react";
import { getRedsysStatus } from "@/actions/payment-status";

export function PaymentGatewayTab() {
  const [status, setStatus] = useState<{
    connected: boolean;
    environment: "test" | "live";
  } | null>(null);

  useEffect(() => {
    void getRedsysStatus().then((s) =>
      setStatus({ connected: s.connected, environment: s.environment }),
    );
  }, []);

  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Redsys logo mark */}
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#003d8a]">
            <svg width="22" height="22" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="6" fill="#003d8a" />
              <text
                x="5"
                y="28"
                fontSize="18"
                fontWeight="bold"
                fill="white"
                fontFamily="Arial, sans-serif"
              >
                R
              </text>
            </svg>
          </div>
          <div>
            <p className="text-petroleum-700 text-sm font-semibold">Redsys</p>
            <p className="text-petroleum-400 text-xs">
              TPV Virtual · Tarjetas, Bizum
              {status && (
                <span className="ml-1.5 font-medium">
                  ·{" "}
                  {status.environment === "test"
                    ? "Entorno de pruebas"
                    : "Producción"}
                </span>
              )}
            </p>
          </div>
        </div>

        {status === null ? (
          <div className="bg-sand-100 h-6 w-24 animate-pulse rounded-full" />
        ) : status.connected ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <span className="size-1.5 rounded-full bg-green-500" />
            Conectado
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600">
            <span className="size-1.5 rounded-full bg-red-400" />
            No configurado
          </span>
        )}
      </div>
    </div>
  );
}
