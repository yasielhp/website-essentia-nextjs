"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { syncSoundPreference } from "@/lib/feedback";

/**
 * The dashboard's toast host, mounted once in its root layout.
 *
 * Styled from the design system rather than Sonner's defaults: the same
 * `rounded-2xl border-sand-200` card the dashboard uses everywhere, so a
 * confirmation looks like it belongs to the page it appeared over. Success and
 * error keep their own colours — that distinction is the point of the toast.
 *
 * Mounting is also where the stored sound preference reaches the audio engine;
 * it lives in `localStorage`, which the server cannot read.
 */
export function DashboardToaster() {
  useEffect(() => {
    syncSoundPreference();
  }, []);

  return (
    <Toaster
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "border-sand-200 rounded-2xl border bg-white shadow-lg text-petroleum-700",
          title: "text-sm font-medium",
          description: "text-petroleum-400 text-xs",
          closeButton: "border-sand-200 text-petroleum-400",
        },
      }}
    />
  );
}
