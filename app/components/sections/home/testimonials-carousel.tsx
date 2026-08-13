"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { IconQuote } from "@/components/ui/icons";

gsap.registerPlugin(ScrollTrigger);

export type TestimonialItem = {
  /** Google returns one per review; unique enough for a key. */
  id: string;
  quote: string;
  name: string;
  /** Google's own wording for the age of the review. */
  when: string;
  /** Null when the reviewer has no picture on their Google account. */
  photoUrl: string | null;
  /** Their Google profile. Attribution the Places policy requires. */
  profileUrl: string | null;
  /** Only drawn when there is no photo. */
  initials: string;
  /** Interpolated link label for the reviewer's Google profile. */
  profileLabel: string;
  bgColor: string;
  textColor: string;
  avatarBg: string;
  avatarText: string;
  mutedColor: string;
};

// ─── Stars ─────────────────────────────────────────────────────

/**
 * The average as five glyphs.
 *
 * Purely decorative: the same number sits next to it as text, so a screen
 * reader that announced both would say it twice.
 */
function Stars({ rating }: { rating: number }) {
  return (
    <span aria-hidden="true" className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-4 w-4" fill="none">
          <path
            d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L1.6 7.7l5.8-.8L10 1.6z"
            className={
              i < Math.round(rating)
                ? "fill-petroleum-500"
                : "fill-petroleum-500/20"
            }
          />
        </svg>
      ))}
    </span>
  );
}

// ─── Avatar ────────────────────────────────────────────────────

/**
 * The reviewer's Google picture, with their initials behind it.
 *
 * `unoptimized` because these are already small, already square thumbnails on
 * Google's own CDN: putting them through the image optimiser would cost a
 * round trip and a cache entry to arrive at the same pixels.
 *
 * The initials are the fallback, not the design: a reviewer with no picture on
 * their Google account comes back with no `photoUri`, and a request that fails
 * would otherwise leave a broken-image glyph beside somebody's name for the
 * life of the page, since a failed `img` never retries.
 */
function Avatar({ t, compact }: { t: TestimonialItem; compact: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = compact ? 32 : 40;
  const box = compact ? "h-8 w-8" : "h-10 w-10";

  if (t.photoUrl && !failed) {
    return (
      <Image
        src={t.photoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        onError={() => setFailed(true)}
        className={`${box} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${t.avatarBg} ${t.avatarText} ${box} flex shrink-0 items-center justify-center rounded-full text-xs font-medium`}
    >
      {t.initials}
    </div>
  );
}

// ─── TestimonialCard ───────────────────────────────────────────

function TestimonialCard({
  t,
  compact = false,
}: {
  t: TestimonialItem;
  compact?: boolean;
}) {
  return (
    <div
      className={`${t.bgColor} relative flex h-full flex-col justify-between rounded-2xl ${
        compact ? "gap-4 p-5" : "gap-6 p-7"
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute top-4 left-5 ${t.textColor}`}
      >
        <IconQuote className="h-8 w-8 opacity-15" />
      </div>
      {/* Real reviews run to six hundred characters where the seeded ones ran
      to a hundred, so the text is clamped rather than left to overflow a fixed
      height and be cut through the middle of a word. Whoever wants the rest has
      the link to the listing underneath. */}
      <p
        className={`font-body ${t.textColor} leading-snug ${
          compact
            ? "line-clamp-7 pt-5 text-base"
            : "line-clamp-[12] pt-6 text-lg"
        }`}
      >
        {t.quote}
      </p>
      <div className="flex items-center gap-3">
        <Avatar t={t} compact={compact} />
        <div>
          <p
            className={`${t.textColor} font-medium ${compact ? "text-xs" : "text-sm"}`}
          >
            {/* Showing the picture obliges us to link the profile it belongs
            to; the name carries the link so the target is a word, not an
            image. */}
            {t.profileUrl ? (
              <a
                href={t.profileUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={t.profileLabel}
                className="hover:underline"
              >
                {t.name}
              </a>
            ) : (
              t.name
            )}
          </p>
          <p className={`${t.mutedColor} text-xs`}>{t.when}</p>
        </div>
      </div>
    </div>
  );
}

// ─── DesktopSlider ─────────────────────────────────────────────

function DesktopSlider({
  sliderRef,
  groupRefs,
  groups,
}: {
  sliderRef: { current: HTMLDivElement | null };
  groupRefs: { current: (HTMLDivElement | null)[] };
  groups: TestimonialItem[][];
}) {
  return (
    <div
      ref={sliderRef}
      className="relative hidden h-80 overflow-hidden md:block"
    >
      {groups.map((group, gi) => (
        <div
          key={gi}
          ref={(el) => {
            groupRefs.current[gi] = el;
          }}
          className="absolute inset-0 flex flex-row justify-center gap-4 px-5"
        >
          {group.map((t) => (
            // A fixed third rather than `flex-1`: with five reviews the last
            // slide holds two, and `flex-1` would have widened them into a
            // different-looking card.
            <div
              key={t.id}
              className="w-[calc((100%-2rem)/3)] shrink-0 md:max-w-sm"
            >
              <TestimonialCard t={t} compact />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── MobileSlider ──────────────────────────────────────────────

function MobileSlider({
  mobileTrackRef,
  items,
}: {
  mobileTrackRef: { current: HTMLDivElement | null };
  items: TestimonialItem[];
}) {
  return (
    <div className="px-5 md:hidden">
      <div
        ref={mobileTrackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((t) => (
          <div
            key={t.id}
            className="shrink-0 snap-center"
            style={{ width: "calc(100vw - 60px)" }}
          >
            <TestimonialCard t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SliderDots ────────────────────────────────────────────────

function SliderDots({
  dotsRef,
  mobileActiveCard,
  activeGroup,
  mobileTrackRef,
  transitionTo,
  resetAutoplay,
  items,
  groups,
}: {
  dotsRef: { current: HTMLDivElement | null };
  mobileActiveCard: number;
  activeGroup: number;
  mobileTrackRef: { current: HTMLDivElement | null };
  transitionTo: (idx: number) => void;
  resetAutoplay: () => void;
  items: TestimonialItem[];
  groups: TestimonialItem[][];
}) {
  return (
    <div ref={dotsRef}>
      {/* Mobile: 1 dot per testimonial */}
      <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
        {items.map((t, i) => (
          <button
            type="button"
            key={t.id}
            aria-label={`Go to testimonial ${i + 1}`}
            className="cursor-pointer p-1"
            onClick={() => {
              const track = mobileTrackRef.current;
              if (!track) return;
              const cardWidth = track.scrollWidth / items.length;
              track.scrollTo({ left: i * cardWidth, behavior: "smooth" });
            }}
          >
            <span
              className={`block h-2 w-2 rounded-full transition-colors duration-300 ${
                mobileActiveCard === i
                  ? "bg-petroleum-500"
                  : "bg-petroleum-500/10"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Desktop: 1 dot per group */}
      <div className="mt-8 hidden items-center justify-center gap-3 md:flex">
        {groups.map((_, gi) => (
          <button
            type="button"
            key={gi}
            aria-label={`Go to slide ${gi + 1}`}
            className="cursor-pointer p-2"
            onClick={() => {
              transitionTo(gi);
              resetAutoplay();
            }}
          >
            <span
              className={`block h-3 w-3 rounded-full transition-colors duration-300 ${
                activeGroup === gi ? "bg-petroleum-500" : "bg-petroleum-500/10"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── TestimonialsCarousel ──────────────────────────────────────

export default function TestimonialsCarousel({
  items,
  headline,
  headline2,
  rating,
  ratingCountLabel,
  sourceLabel,
  viewAllLabel,
  googleMapsUri,
}: {
  items: TestimonialItem[];
  headline: string;
  headline2: string;
  /** Averaged over every rating on the listing, not only the five shown. */
  rating: number | null;
  ratingCountLabel: string | null;
  sourceLabel: string;
  viewAllLabel: string;
  googleMapsUri: string | null;
}) {
  // Three, not four: the listing returns at most five reviews, and four to a
  // slide leaves the second one holding a single card.
  const groupSize = 3;
  const groups = useMemo<TestimonialItem[][]>(() => {
    const result: TestimonialItem[][] = [];
    for (let i = 0; i < items.length; i += groupSize) {
      result.push(items.slice(i, i + groupSize));
    }
    return result.length > 0 ? result : [[]];
  }, [items]);

  const groupCount = groups.length;

  const sliderRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const mobileTrackRef = useRef<HTMLDivElement>(null);
  // Starts empty and fills itself: the ref callbacks below assign by index as
  // each group mounts. `useRef(Array.from(...))` rebuilt that array on every
  // render and threw it away, since a ref keeps only the first value.
  const groupRefs = useRef<(HTMLDivElement | null)[]>([]);
  const animatingRef = useRef(false);
  const activeGroupRef = useRef(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const [activeGroup, setActiveGroup] = useState(0);
  const [mobileActiveCard, setMobileActiveCard] = useState(0);

  // ─── Initial state: groups 1+ hidden, group 0 visible ──────

  useEffect(() => {
    const group0 = groupRefs.current[0];
    if (group0) gsap.set(group0, { opacity: 1, pointerEvents: "auto" });
    for (let i = 1; i < groupCount; i++) {
      const el = groupRefs.current[i];
      if (el) gsap.set(el, { opacity: 0, pointerEvents: "none" });
    }
  }, [groupCount]);

  // ─── Header entrance animation ──────────────────────────────

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const ctx = gsap.context(() => {
      gsap.from(header, {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: header, start: "top 85%", once: true },
      });
    });
    return () => ctx.revert();
  }, []);

  // ─── Carousel transition ────────────────────────────────────

  const transitionTo = useCallback((nextIdx: number) => {
    if (animatingRef.current) return;
    const prevIdx = activeGroupRef.current;
    if (prevIdx === nextIdx) return;

    const prevEl = groupRefs.current[prevIdx];
    const nextEl = groupRefs.current[nextIdx];
    if (!prevEl || !nextEl) return;

    animatingRef.current = true;
    activeGroupRef.current = nextIdx;
    setActiveGroup(nextIdx);

    const prevCards = Array.from(prevEl.children);
    const nextCards = Array.from(nextEl.children);

    gsap.to(prevCards, {
      x: -50,
      opacity: 0,
      stagger: 0.05,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(prevEl, { opacity: 0, pointerEvents: "none" });
        gsap.set(prevCards, { x: 0 });
        gsap.set(nextEl, { opacity: 1, pointerEvents: "auto" });
        gsap.set(nextCards, { opacity: 0, x: 50 });
        gsap.to(nextCards, {
          opacity: 1,
          x: 0,
          stagger: 0.08,
          duration: 0.4,
          ease: "power3.out",
          onComplete: () => {
            animatingRef.current = false;
          },
        });
      },
    });
  }, []);

  // ─── Autoplay ───────────────────────────────────────────────

  const resetAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => {
      transitionTo((activeGroupRef.current + 1) % groupCount);
    }, 5000);
  }, [transitionTo, groupCount]);

  useEffect(() => {
    resetAutoplay();
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [resetAutoplay]);

  // ─── Mobile scroll → sync dot ───────────────────────────────

  useEffect(() => {
    const track = mobileTrackRef.current;
    if (!track) return;
    const itemCount = items.length;
    const onScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = track;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll <= 0) return;
      const cardIdx = Math.min(
        itemCount - 1,
        Math.round((scrollLeft / maxScroll) * (itemCount - 1)),
      );
      setMobileActiveCard(cardIdx);
      const group = Math.min(groupCount - 1, Math.floor(cardIdx / groupSize));
      setActiveGroup(group);
      activeGroupRef.current = group;
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [items.length, groupCount]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <section className="bg-sand-100">
      <div className="overflow-hidden">
        <div className="flex flex-col pt-24 pb-16 md:gap-10 md:pt-36 md:pb-16">
          <div
            ref={headerRef}
            className="px-5 text-center md:mx-auto md:w-full md:max-w-4xl"
          >
            <h2 className="font-display text-petroleum-700 mt-3 mb-4 text-3xl md:text-5xl">
              {headline}
              <br />
              {headline2}
            </h2>

            {/* Five quotes persuade less than five quotes standing on a score
            anybody can go and check, so the score comes first and carries the
            link out. It doubles as the attribution the Places policy asks
            for. */}
            {rating !== null && (
              <div className="text-petroleum-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm">
                <Stars rating={rating} />
                <span className="text-petroleum-700 font-medium tabular-nums">
                  {rating.toFixed(1)}
                </span>
                {ratingCountLabel && (
                  <span className="text-petroleum-400">{ratingCountLabel}</span>
                )}
                <span className="text-petroleum-400" aria-hidden="true">
                  ·
                </span>
                {googleMapsUri ? (
                  <a
                    href={googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="underline underline-offset-4 hover:no-underline"
                  >
                    {sourceLabel}
                  </a>
                ) : (
                  <span>{sourceLabel}</span>
                )}
              </div>
            )}
          </div>

          <DesktopSlider
            sliderRef={sliderRef}
            groupRefs={groupRefs}
            groups={groups}
          />

          <MobileSlider mobileTrackRef={mobileTrackRef} items={items} />

          <SliderDots
            dotsRef={dotsRef}
            mobileActiveCard={mobileActiveCard}
            activeGroup={activeGroup}
            mobileTrackRef={mobileTrackRef}
            transitionTo={transitionTo}
            resetAutoplay={resetAutoplay}
            items={items}
            groups={groups}
          />

          {googleMapsUri && (
            <div className="mt-10 px-5 text-center">
              <a
                href={googleMapsUri}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-petroleum-500 text-sm underline underline-offset-4 hover:no-underline"
              >
                {viewAllLabel}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
