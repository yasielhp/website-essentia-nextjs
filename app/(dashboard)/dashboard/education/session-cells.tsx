"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import type { AccessType, Session } from "./types";

/**
 * The two things a session shows the same way on a phone and on a desk: its
 * picture, and who is allowed to come.
 *
 * Both were written twice, and the placeholder drawing — eighteen lines of SVG
 * for a session with no picture — was written twice identically.
 */

const ACCESS_COLORS: Record<AccessType, string> = {
  members_only: "bg-petroleum-50 text-petroleum-500",
  open: "bg-green-50 text-green-700",
  paid: "bg-yellow-50 text-yellow-700",
  paid_members_free: "bg-blue-50 text-blue-700",
};

function PicturePlaceholder() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="text-petroleum-300"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="8.5"
        cy="8.5"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M21 15l-5-5L5 21"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The session's picture, or a drawing standing in for one.
 *
 * The card wants a full-height strip down the left and the row wants a small
 * square, which is the whole of the difference between them.
 */
export function SessionThumbnail({
  session,
  variant,
}: {
  session: Session;
  variant: "strip" | "square";
}) {
  const isStrip = variant === "strip";
  const frame = isStrip
    ? "bg-sand-100 relative w-20 shrink-0 overflow-hidden"
    : "bg-sand-100 relative size-10 overflow-hidden rounded-lg";
  const empty = isStrip
    ? "bg-sand-100 flex size-full items-center justify-center"
    : "bg-sand-100 flex size-10 items-center justify-center rounded-lg";

  const picture = session.image_url ? (
    <Image
      src={session.image_url}
      alt={session.title}
      fill
      sizes={isStrip ? "80px" : "40px"}
      className="object-cover"
    />
  ) : null;

  // The strip keeps its frame either way, because it is what gives the card its
  // left edge. The square has no frame to keep when there is nothing to frame.
  if (isStrip) {
    return (
      <div className={frame}>
        {picture ?? (
          <div className={empty}>
            <PicturePlaceholder />
          </div>
        )}
      </div>
    );
  }

  return picture ? (
    <div className={frame}>{picture}</div>
  ) : (
    <div className={empty}>
      <PicturePlaceholder />
    </div>
  );
}

export function AccessBadge({
  access,
  className = "",
}: {
  access: AccessType;
  className?: string;
}) {
  const t = useTranslations("dashboard");

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ACCESS_COLORS[access]} ${className}`}
    >
      {t(`education.access.${access}`)}
    </span>
  );
}
