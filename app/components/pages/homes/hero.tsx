"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export default function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const vimeoContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isUnmutedRef = useRef(false);
  const isPausedByUserRef = useRef(false);
  const [vimeoVisible, setVimeoVisible] = useState(false);
  const [showIcon, setShowIcon] = useState<"play" | "pause" | null>(null);
  const iconTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

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

    const handleScroll = () => {
      const rect = wrapper.getBoundingClientRect();
      const scrollable = wrapper.offsetHeight - window.innerHeight;
      const rawProgress = Math.min(Math.max(-rect.top / scrollable, 0), 1);

      // Phase 1: padding/radius/text animation (first 40% of scroll)
      const phase1 = Math.min(rawProgress / 0.4, 1);
      const padding = 24 * (1 - phase1);
      const radius = 32 * (1 - phase1);
      video.style.padding = `${padding}px`;
      video.style.borderRadius = `${radius}px`;
      text.style.opacity = `${1 - phase1 * 2.5}`;
      text.style.transform = `translateY(${phase1 * -40}px)`;

      // Phase 2: show Vimeo and unmute
      const shouldShow = phase1 >= 1 && rawProgress < 1;
      vimeoContainer.style.opacity = shouldShow ? "1" : "0";
      vimeoContainer.style.pointerEvents = shouldShow ? "auto" : "none";
      setVimeoVisible(shouldShow);

      if (shouldShow && !isUnmutedRef.current) {
        isUnmutedRef.current = true;
        vimeoCommand("setVolume", 1);
        if (!isPausedByUserRef.current) {
          vimeoCommand("play");
        }
      } else if (!shouldShow && isUnmutedRef.current) {
        isUnmutedRef.current = false;
        vimeoCommand("setVolume", 0);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [vimeoCommand]);

  return (
    <div ref={wrapperRef} className="h-[300dvh]">
      <section className="sticky top-0 flex h-dvh items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute h-full w-full rounded-4xl object-cover p-6"
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/hero.webp"
        >
          <source
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/hero.mp4"
            type="video/mp4"
          />
        </video>
        <div
          ref={vimeoContainerRef}
          className="absolute inset-0 z-20 overflow-hidden opacity-0 transition-opacity duration-700"
          style={{ pointerEvents: "none" }}
        >
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
            title="Essentia - branded film"
          />
          {vimeoVisible && (
            <button
              onClick={handleTogglePlay}
              className="absolute inset-0 z-30 flex cursor-pointer items-center justify-center"
              aria-label="Toggle video playback"
            >
              <span
                className={`rounded-full bg-black/40 p-5 backdrop-blur-sm transition-opacity duration-500 ${showIcon ? "opacity-100" : "opacity-0"}`}
              >
                {showIcon === "pause" ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="h-8 w-8"
                  >
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="h-8 w-8"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </span>
            </button>
          )}
        </div>
        <div ref={textRef} className="relative z-10 px-6 text-center">
          <h1 className="font-display text-3xl tracking-wide text-white md:text-6xl lg:text-7xl">
            A transformative experience
            <br />
            for body, mind and spirit.
          </h1>
        </div>
      </section>
    </div>
  );
}
