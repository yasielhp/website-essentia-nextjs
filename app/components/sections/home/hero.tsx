"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";

import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

const R2_ORIGIN = "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev";

type VideoState = { visible: boolean };
type VideoAction = { type: "show" } | { type: "hide" };

function videoReducer(state: VideoState, action: VideoAction): VideoState {
  switch (action.type) {
    case "show":
      return { visible: true };
    case "hide":
      return { visible: false };
  }
}

export default function Hero() {
  const t = useTranslations("home.hero");
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const vimeoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isPausedByUserRef = useRef(false);
  // The player stays muted: it is scenery behind the page, and the browsers
  // that matter block sound on an autoplaying video anyway.
  const [{ visible: vimeoVisible }, dispatch] = useReducer(videoReducer, {
    visible: false,
  });
  const [showIcon, setShowIcon] = useState<"play" | "pause" | null>(null);
  const iconTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  /**
   * The Vimeo player only appears once the hero has been scrolled past, but
   * the iframe used to mount with the page — so every visit paid for the
   * player's script, its three cookies and its video segments, including the
   * visits that never scrolled at all.
   *
   * The first scroll is the signal: it happens long before the reveal, so the
   * player is ready by the time it fades in, and a visitor who reads the hero
   * and leaves never loads Vimeo.
   */
  const [vimeoMounted, setVimeoMounted] = useState(false);

  useEffect(() => {
    // A reload part-way down the page restores the scroll position before the
    // triggers below exist. The frame check catches that; it runs after the
    // commit, so it never cascades a render.
    const frame = requestAnimationFrame(() => {
      if (window.scrollY > 0) setVimeoMounted(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const vimeoCommand = useCallback((method: string, value?: number) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const msg = value !== undefined ? { method, value } : { method };
    iframe.contentWindow.postMessage(JSON.stringify(msg), "*");
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (iconTimeoutRef.current) clearTimeout(iconTimeoutRef.current);

    if (isPausedByUserRef.current) {
      isPausedByUserRef.current = false;
      vimeoCommand("play");
      setShowIcon("play");
    } else {
      isPausedByUserRef.current = true;
      vimeoCommand("pause");
      setShowIcon("pause");
    }

    iconTimeoutRef.current = setTimeout(() => setShowIcon(null), 800);
  }, [vimeoCommand]);

  useEffect(() => {
    const video = videoRef.current;
    const text = textRef.current;
    const wrapper = wrapperRef.current;
    const vimeoContainer = vimeoContainerRef.current;
    if (!video || !text || !wrapper || !vimeoContainer) return;

    const scrollDistance = () =>
      (wrapper.offsetHeight - window.innerHeight) * 0.4;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: wrapper,
          start: "top top",
          end: () => `+=${scrollDistance()}`,
          scrub: true,
          invalidateOnRefresh: true,
        },
      });

      tl.fromTo(
        video,
        { borderRadius: 48 },
        { borderRadius: 0, ease: "none", duration: 1 },
        0,
      );

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px)", () => {
        tl.fromTo(
          video,
          { padding: 24 },
          { padding: 0, ease: "none", duration: 1 },
          0,
        );
      });

      tl.to(text, { opacity: 0, ease: "none", duration: 0.4 }, 0);
      tl.to(text, { y: -40, ease: "none", duration: 1 }, 0);

      gsap.fromTo(
        text,
        { paddingLeft: 24, paddingRight: 24 },
        {
          paddingLeft: 20,
          paddingRight: 20,
          ease: "none",
          scrollTrigger: {
            trigger: wrapper,
            start: "top top",
            end: () => `+=${scrollDistance()}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );

      const showVimeo = () => {
        gsap.to(vimeoContainer, {
          opacity: 1,
          duration: 0.7,
          ease: "power2.out",
        });
        vimeoContainer.style.pointerEvents = "auto";

        if (!isPausedByUserRef.current) vimeoCommand("play");
        dispatch({ type: "show" });
      };

      const hideVimeo = () => {
        gsap.to(vimeoContainer, {
          opacity: 0,
          duration: 0.7,
          ease: "power2.in",
        });
        vimeoContainer.style.pointerEvents = "none";

        dispatch({ type: "hide" });
      };

      // A quarter of the way into the scroll the player still has some way to
      // go before it fades in, which is the head start the iframe needs to
      // have its first frame ready. Anyone who never gets this far never
      // loads Vimeo at all.
      ScrollTrigger.create({
        trigger: wrapper,
        start: () => `+=${scrollDistance() * 0.25}`,
        once: true,
        invalidateOnRefresh: true,
        onEnter: () => setVimeoMounted(true),
      });

      ScrollTrigger.create({
        trigger: wrapper,
        start: () => `+=${scrollDistance()}`,
        end: "bottom bottom",
        invalidateOnRefresh: true,
        onEnter: showVimeo,
        onLeave: hideVimeo,
        onEnterBack: showVimeo,
        onLeaveBack: hideVimeo,
      });
    }, wrapper);

    return () => ctx.revert();
  }, [vimeoCommand]);

  return (
    <section ref={wrapperRef} className="bg-sand-100 min-screen h-[300vh]">
      {/* Poster is the LCP element — open the connection to R2 as early as possible */}
      <link rel="preconnect" href={R2_ORIGIN} crossOrigin="anonymous" />
      <link
        rel="preload"
        as="image"
        href={`${R2_ORIGIN}/hero.webp`}
        fetchPriority="high"
      />
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute h-full w-full rounded-4xl object-cover md:p-6"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster={`${R2_ORIGIN}/hero.webp`}
        >
          <source src={`${R2_ORIGIN}/hero.mp4`} type="video/mp4" />
        </video>

        <div
          ref={vimeoContainerRef}
          className="absolute inset-0 z-20 overflow-hidden opacity-0"
          style={{ pointerEvents: "none" }}
        >
          {vimeoMounted && (
            <iframe
              ref={iframeRef}
              src="https://player.vimeo.com/video/1079094689?h=b7ca743ee7&autoplay=1&muted=1&loop=1&badge=0&autopause=0&title=0&byline=0&portrait=0&controls=0"
              className="absolute top-1/2 left-1/2"
              style={{
                width: "max(100%, 177.78vh)",
                height: "max(100%, 56.25vw)",
                transform: "translate(-50%, -50%)",
              }}
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
              title={t("videoTitle")}
            />
          )}
          {vimeoVisible && (
            <>
              <button
                onClick={handleTogglePlay}
                className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center"
                aria-label={t("togglePlay")}
              >
                <span
                  className={`rounded-full bg-black/40 p-5 backdrop-blur-sm transition-opacity duration-500 ${showIcon ? "opacity-100" : "opacity-0"}`}
                >
                  {showIcon === "pause" ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="white"
                      className="size-8"
                    >
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="white"
                      className="size-8"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </span>
              </button>
            </>
          )}
        </div>

        {/* Texto y botones */}
        <div
          ref={textRef}
          className="relative z-10 mx-auto w-full max-w-4xl text-center"
        >
          <p className="font-display xs:text-6xl text-4xl tracking-wide text-white lg:text-6xl">
            {t("headline")}
            <br />
            {t("headline2")}
            {t("headline3") && (
              <>
                <br />
                {t("headline3")}
              </>
            )}
          </p>
          <h1 className="mt-4 text-base text-pretty text-white/80 md:text-lg">
            {t("subheadline")}
          </h1>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 md:flex-row">
            <Button
              href="/booking"
              variant="white"
              size="lg"
              className="w-full md:w-auto"
            >
              {t("ctaBook")}
            </Button>
            <Button
              href="/about"
              variant="outline-white"
              size="lg"
              className="w-full md:w-auto"
            >
              {t("ctaAbout")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
