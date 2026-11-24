"use client";

import { useEffect, useState } from "react";

/**
 * The time, in ms, redrawn every `everyMs` (a minute by default): for a line
 * that says how long ago something was ("3 min ago") and must keep saying it
 * true without the person doing anything. Read once when it mounts, then on
 * each tick; a source of time that is newer than the last tick is simply "a
 * moment ago" to whoever reads it.
 */
export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}
