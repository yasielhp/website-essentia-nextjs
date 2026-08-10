"use client";

import { useState, useCallback } from "react";
import { IconQuote } from "@/components/ui/icons";
import type { TestimonialItem } from "@/components/sections/home/testimonials-carousel";
import { activatable } from "@/lib/a11y";

const ROW_SPEEDS = [60, 48, 70, 54];
const ROW_DIRS: ("left" | "right")[] = ["left", "right", "left", "right"];

// ─── Modal ─────────────────────────────────────────────────────

function ReviewModal({
  item,
  onClose,
}: {
  item: TestimonialItem;
  onClose: () => void;
}) {
  return (
    <div
      // Decorative: the click that closes is a convenience for a mouse. The
      // dialog itself is the element inside, and Escape closes it too.
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`${item.bgColor} relative flex w-full max-w-md flex-col gap-6 rounded-2xl p-7 shadow-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          className={`${item.mutedColor} absolute top-4 right-4 transition-opacity hover:opacity-70`}
          aria-label="Close"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M18 6 6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div aria-hidden="true" className={`${item.textColor}`}>
          <IconQuote className="h-8 w-8 opacity-15" />
        </div>

        <p className={`font-body ${item.textColor} text-lg leading-relaxed`}>
          {item.quote}
        </p>

        <div className="flex items-center gap-3">
          <div
            className={`${item.avatarBg} ${item.avatarText} flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium`}
          >
            {item.initials}
          </div>
          <div>
            <p className={`${item.textColor} font-medium`}>{item.name}</p>
            {item.age && (
              <p className={`${item.mutedColor} text-sm`}>{item.age}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Card ──────────────────────────────────────────────────────

function ReviewCard({
  t,
  onClick,
}: {
  t: TestimonialItem;
  onClick: () => void;
}) {
  return (
    <div
      {...activatable(onClick)}
      className="group bg-sand-50 hover:bg-petroleum-700 relative flex w-72 shrink-0 cursor-pointer flex-col justify-between gap-5 rounded-2xl p-5 transition-colors duration-300"
    >
      <div
        aria-hidden="true"
        className="text-petroleum-700 group-hover:text-sand-50 absolute top-4 left-5 transition-colors duration-300"
      >
        <IconQuote className="h-7 w-7 opacity-15" />
      </div>
      <p className="font-body text-petroleum-700 group-hover:text-sand-50 line-clamp-5 pt-5 text-base leading-snug transition-colors duration-300">
        {t.quote}
      </p>
      <div className="flex items-center gap-3">
        <div className="bg-petroleum-100 text-petroleum-700 group-hover:bg-petroleum-500 group-hover:text-sand-50 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors duration-300">
          {t.initials}
        </div>
        <div>
          <p className="text-petroleum-700 group-hover:text-sand-50 text-sm font-medium transition-colors duration-300">
            {t.name}
          </p>
          {t.age && (
            <p className="text-petroleum-400 group-hover:text-sand-50/60 text-xs transition-colors duration-300">
              {t.age}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Row ───────────────────────────────────────────────────────

function MarqueeRow({
  items,
  duration,
  direction,
  onSelect,
}: {
  items: TestimonialItem[];
  duration: number;
  direction: "left" | "right";
  onSelect: (item: TestimonialItem) => void;
}) {
  const [paused, setPaused] = useState(false);
  // Doubled so the marquee can loop seamlessly, which means every review
  // appears twice: the copy it comes from is part of what identifies it.
  const doubled = [
    ...items.map((t) => ({ t, key: `first-${t.name}` })),
    ...items.map((t) => ({ t, key: `second-${t.name}` })),
  ];
  const animName = direction === "left" ? "marquee-left" : "marquee-right";

  return (
    <div
      className="overflow-hidden"
      onMouseEnter={useCallback(() => setPaused(true), [])}
      onMouseLeave={useCallback(() => setPaused(false), [])}
    >
      <div
        className="flex gap-4"
        style={{
          width: "max-content",
          animation: `${animName} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {doubled.map(({ t: item, key }) => (
          <ReviewCard key={key} t={item} onClick={() => onSelect(item)} />
        ))}
      </div>
    </div>
  );
}

// ─── Marquee ───────────────────────────────────────────────────

export default function ReviewsMarquee({
  items,
}: {
  items: TestimonialItem[];
}) {
  const [selected, setSelected] = useState<TestimonialItem | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes marquee-left {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes marquee-right {
          from { transform: translateX(-50%); }
          to   { transform: translateX(0); }
        }
      `}</style>

      <div className="flex flex-col gap-4">
        {ROW_SPEEDS.map((speed, rowIdx) => (
          <MarqueeRow
            key={rowIdx}
            items={items}
            duration={speed}
            direction={ROW_DIRS[rowIdx]!}
            onSelect={setSelected}
          />
        ))}
      </div>

      {selected && (
        <ReviewModal item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}
