"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { previewSrcDoc } from "@/lib/messages/preview-frame";

/**
 * The email, drawn by the server, with nothing around it: no box, no padding,
 * no scroll bar of its own. The frame is as wide as its column and as TALL AS
 * THE EMAIL, so what is seen is the whole email, top to bottom, and the page
 * is what scrolls.
 *
 * It is an iframe so the email's styles stay out of the dashboard (and the
 * dashboard's out of it). Its sandbox allows one thing, `allow-same-origin`,
 * and only so this component can read how tall the email is: no script runs in
 * it, no form is sent and no window is opened (see `previewSrcDoc` for links).
 *
 * The subject is the form's own field, not repeated here, and the note on what
 * the example shows is the frame's description for a screen reader.
 */
export function EmailPreviewFrame({
  html,
  failed,
  failure,
  action,
}: {
  /** Null while the first one is being prepared. */
  html: string | null;
  /** The last draft could not be drawn: what is shown is the last one that could. */
  failed: boolean;
  /** Why it failed when the draft was not the cause, already in words. */
  failure: string | null;
  /** What goes at the right of the heading: Send me a test. */
  action?: ReactNode;
}) {
  const t = useTranslations("dashboard.messages.email.editor.preview");
  const frame = useRef<HTMLIFrameElement>(null);
  /** The email's own height in px; null until the first one has been measured. */
  const [height, setHeight] = useState<number | null>(null);

  /**
   * Reads the email's height. The frame is collapsed for the reading, or a
   * shorter email would be measured as tall as the frame already is; nothing
   * is painted in between.
   */
  const measure = useCallback(() => {
    const element = frame.current;
    const doc = element?.contentDocument;
    if (!element || !doc?.documentElement) return;
    const before = element.style.height;
    element.style.height = "0px";
    const tall = Math.max(
      doc.documentElement.scrollHeight,
      doc.body?.scrollHeight ?? 0,
    );
    element.style.height = before;
    if (tall > 0) setHeight(tall);
  }, []);

  /** Watches the email inside the frame; replaced each time the frame loads. */
  const inner = useRef<ResizeObserver | null>(null);

  /**
   * The frame has loaded an email: measure it, and keep measuring while it
   * settles (a font or the logo arriving a moment later makes it a little
   * taller than it was at first).
   */
  const onLoad = useCallback(() => {
    measure();
    inner.current?.disconnect();
    const body = frame.current?.contentDocument?.body;
    if (!body || typeof ResizeObserver === "undefined") return;
    inner.current = new ResizeObserver(() => measure());
    inner.current.observe(body);
  }, [measure]);

  // A narrower or wider column wraps the email differently: measure again.
  // (The frame only exists once there is an email to show.)
  const shown = html !== null;
  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      measure();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      inner.current?.disconnect();
    };
  }, [measure, shown]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-petroleum-500 pt-2.5 text-xs font-medium">
          {t("title")}
        </h3>
        {action}
      </div>
      <p id="message-preview-note" className="sr-only">
        {t("note")}
      </p>
      {failed && (
        <p role="status" className="text-xs text-yellow-800">
          {failure ?? t("failed")}
        </p>
      )}
      {html === null ? (
        <p className="text-petroleum-400 py-16 text-center text-sm">
          {t("loading")}
        </p>
      ) : (
        <iframe
          ref={frame}
          title={t("title")}
          aria-describedby="message-preview-note"
          srcDoc={previewSrcDoc(html)}
          sandbox="allow-same-origin"
          scrolling="no"
          onLoad={onLoad}
          style={height === null ? undefined : { height }}
          className={`block w-full overflow-hidden rounded-2xl border-0 ${
            height === null ? "h-160" : ""
          }`}
        />
      )}
    </div>
  );
}
