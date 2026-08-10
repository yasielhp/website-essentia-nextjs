"use client";

import type { SupportedLocale } from "@/utils/format";
import { SessionCards } from "./session-cards";
import { SessionTable } from "./session-table";
import type { Session } from "./types";

/**
 * Every session, twice: cards on a phone and a table on a desk.
 *
 * Two readings of the same list rather than one with a breakpoint through the
 * middle — the card leads with the picture and folds the day, the duration and
 * the count into two lines; the row gives each of them a column.
 */
export function SessionList({
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
  return (
    <>
      <SessionCards
        sessions={sessions}
        loading={loading}
        locale={locale}
        onOpen={onOpen}
      />
      <SessionTable
        sessions={sessions}
        loading={loading}
        locale={locale}
        onOpen={onOpen}
      />
    </>
  );
}
