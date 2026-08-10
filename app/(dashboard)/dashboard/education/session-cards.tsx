"use client";

import { useTranslations } from "next-intl";
import {
  formatMediumDate,
  formatTimeOfDay,
  type SupportedLocale,
} from "@/utils/format";
import { activatable } from "@/lib/a11y";
import { AccessBadge, SessionThumbnail } from "./session-cells";
import type { Session } from "./types";

/** Every session on a phone: a picture down the left, the rest beside it. */

function CardSkeleton() {
  return (
    <div className="flex items-stretch">
      <div className="bg-sand-100 w-20 shrink-0 animate-pulse" />
      <div className="min-w-0 flex-1 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="bg-sand-100 h-4 w-36 animate-pulse rounded" />
          <div className="bg-sand-100 h-5 w-16 animate-pulse rounded-full" />
        </div>
        <div className="bg-sand-100 mt-2 h-3 w-40 animate-pulse rounded" />
        <div className="bg-sand-100 mt-1 h-3 w-28 animate-pulse rounded" />
      </div>
    </div>
  );
}

function SessionCard({
  session,
  locale,
  onOpen,
}: {
  session: Session;
  locale: SupportedLocale;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("dashboard");

  return (
    <div
      {...activatable(() => onOpen(session.id))}
      className="hover:bg-sand-50 flex cursor-pointer items-stretch transition-colors"
    >
      <SessionThumbnail session={session} variant="strip" />
      <div className="min-w-0 flex-1 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-petroleum-700 truncate font-medium">
            {session.title}
          </p>
          <AccessBadge access={session.access} className="shrink-0" />
        </div>
        <p className="text-petroleum-400 mt-1 text-xs">
          {formatMediumDate(session.date, locale)} ·{" "}
          {formatTimeOfDay(session.date, locale)}
          {session.duration_minutes != null
            ? ` · ${t("education.minutes", { count: session.duration_minutes })}`
            : ""}
        </p>
        <p className="text-petroleum-400 mt-0.5 text-xs">
          {session.location ?? ""}
          {session.location ? " · " : ""}
          {session.max_participants != null
            ? t("education.enrolledOfMax", {
                count: session.registrations_count,
                max: session.max_participants,
              })
            : t("education.enrolled", { count: session.registrations_count })}
        </p>
      </div>
    </div>
  );
}

export function SessionCards({
  sessions,
  loading,
  locale,
  onOpen,
}: {
  sessions: Session[];
  loading: boolean;
  locale: SupportedLocale;
  onOpen: (id: string) => void;
}) {
  const t = useTranslations("dashboard");

  return (
    <div className="border-sand-200 divide-sand-200 mb-4 divide-y overflow-hidden rounded-2xl border bg-white sm:hidden">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
      ) : sessions.length === 0 ? (
        <p className="text-petroleum-400 px-6 py-12 text-center text-sm">
          {t("education.empty")}
        </p>
      ) : (
        sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            locale={locale}
            onOpen={onOpen}
          />
        ))
      )}
    </div>
  );
}
