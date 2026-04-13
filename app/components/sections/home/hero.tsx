"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

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
  const [isMuted, setIsMuted] = useState(true);
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

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      vimeoCommand("setVolume", 1);
      setIsMuted(false);
    } else {
      vimeoCommand("setVolume", 0);
      setIsMuted(true);
    }
  }, [isMuted, vimeoCommand]);

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
        setVimeoVisible(true);

        if (!isUnmutedRef.current) {
          isUnmutedRef.current = true;
          vimeoCommand("setVolume", 1);
          setIsMuted(false);
          if (!isPausedByUserRef.current) vimeoCommand("play");
        }
      };

      const hideVimeo = () => {
        gsap.to(vimeoContainer, {
          opacity: 0,
          duration: 0.7,
          ease: "power2.in",
        });
        vimeoContainer.style.pointerEvents = "none";
        setVimeoVisible(false);

        if (isUnmutedRef.current) {
          isUnmutedRef.current = false;
          vimeoCommand("setVolume", 0);
          setIsMuted(true);
        }
      };

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
    <section ref={wrapperRef} data-header-theme="light" className="h-[300vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute h-full w-full rounded-4xl object-cover md:p-6"
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
          className="absolute inset-0 z-20 overflow-hidden opacity-0"
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
            <>
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
              <button
                onClick={handleToggleMute}
                className="absolute right-6 bottom-6 z-40 flex cursor-pointer items-center justify-center rounded-full bg-black/40 p-3 backdrop-blur-sm transition-opacity duration-300 hover:bg-black/60"
                aria-label={isMuted ? "Unmute video" : "Mute video"}
              >
                {isMuted ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="h-5 w-5"
                  >
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="white"
                    className="h-5 w-5"
                  >
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>

        {/* Texto y botones */}
        <div
          ref={textRef}
          className="relative z-10 mx-auto w-full max-w-4xl text-center"
        >
          <p className="font-display xs:text-6xl text-4xl tracking-wide text-white lg:text-7xl">
            For those who
            <br />
            take the long view.
          </p>
          <h1 className="mt-4 text-base text-pretty text-white/80 md:text-lg">
            Longevity Center & Social Wellness Club in Tenerife
          </h1>
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 md:flex-row">
            <Button
              href="/booking"
              variant="white"
              size="lg"
              className="w-full md:w-auto"
            >
              Reserve Your Visit
            </Button>
            <Button
              href="/community/memberships"
              variant="outline-white"
              size="lg"
              className="w-full md:w-auto"
            >
              Explore Membership
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
