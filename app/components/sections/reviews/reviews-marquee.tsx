"use client";

import { useCallback, useState } from "react";
import { IconQuote } from "@/components/ui/icons";
import { ReviewAvatar } from "@/components/ui/review-avatar";
import {
  TestimonialCard,
  type TestimonialItem,
} from "@/components/ui/testimonial-card";
import { activatable } from "@/lib/a11y";

/**
 * Three rows of reviews drifting past at different speeds.
 *
 * Three, not the four this had when the reviews were ours: Google hands over
 * nine and four rows of the same nine reads as padding.
 */
const ROW_SPEEDS = [64, 52, 74];
const ROW_DIRS: ("left" | "right")[] = ["left", "right", "left"];

// ─── Modal ─────────────────────────────────────────────────────

/**
 * The full review.
 *
 * The cards clamp — a row has to hold its height — so there has to be somewhere
 * the rest of a six-hundred-character review can be read without leaving for
 * Google.
 */
function ReviewModal({
  item,
  onClose,
  closeLabel,
}: {
  item: TestimonialItem;
  onClose: () => void;
  closeLabel: string;
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
        className={`${item.bgColor} relative flex max-h-[80vh] w-full max-w-md flex-col gap-6 overflow-y-auto rounded-2xl p-7 shadow-2xl`}
      >
        <button
          type="button"
          onClick={onClose}
          className={`${item.mutedColor} absolute top-4 right-4 transition-opacity hover:opacity-70`}
          aria-label={closeLabel}
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

        <div aria-hidden="true" className={item.textColor}>
          <IconQuote className="h-8 w-8 opacity-15" />
        </div>

        <p className={`font-body ${item.textColor} leading-relaxed`}>
          {item.quote}
        </p>

        <div className="flex items-center gap-3">
          <ReviewAvatar
            photoUrl={item.photoUrl}
            initials={item.initials}
            className="h-10 w-10"
            fallbackClassName={`${item.avatarBg} ${item.avatarText}`}
          />
          <div>
            <p className={`${item.textColor} text-sm font-medium`}>
              {item.name}
            </p>
            <p className={`${item.mutedColor} text-xs`}>{item.when}</p>
          </div>
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
  const onEnter = useCallback(() => setPaused(true), []);
  const onLeave = useCallback(() => setPaused(false), []);

  // Doubled so the loop closes seamlessly: the animation travels exactly half
  // the track, by which point the second copy sits where the first began.
  const doubled = [
    ...items.map((t) => ({ t, key: `first-${t.id}` })),
    ...items.map((t) => ({ t, key: `second-${t.id}` })),
  ];
  const animName = direction === "left" ? "marquee-left" : "marquee-right";

  return (
    <div
      className="overflow-hidden"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <div
        className="flex gap-4 motion-reduce:animate-none!"
        style={{
          width: "max-content",
          animation: `${animName} ${duration}s linear infinite`,
          animationPlayState: paused ? "paused" : "running",
        }}
      >
        {doubled.map(({ t: item, key }) => (
          <div
            key={key}
            {...activatable(() => onSelect(item))}
            className="w-72 shrink-0 cursor-pointer transition-opacity hover:opacity-90"
          >
            <TestimonialCard t={item} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Marquee ───────────────────────────────────────────────────

export default function ReviewsMarquee({
  items,
  closeLabel,
}: {
  items: TestimonialItem[];
  closeLabel: string;
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
        @media (prefers-reduced-motion: reduce) {
          [style*="marquee-"] { animation: none !important; }
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
        <ReviewModal
          item={selected}
          onClose={() => setSelected(null)}
          closeLabel={closeLabel}
        />
      )}
    </>
  );
}
