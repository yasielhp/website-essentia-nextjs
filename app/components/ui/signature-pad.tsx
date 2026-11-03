"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Eraser, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const WIDTH = 600;
const HEIGHT = 200;

type SurfaceHandle = {
  clear: () => void;
  canvas: () => HTMLCanvasElement | null;
};

/**
 * The drawing surface itself: a canvas that takes a finger, a stylus or a
 * mouse. Drawn at the screen's pixel density so a stroke stays crisp on a
 * phone, with `touch-action: none` so the page does not scroll under the
 * finger. It reports when a stroke ends and when it is wiped.
 */
function Surface({
  width,
  height,
  ariaLabel,
  disabled = false,
  onBeforeStroke,
  onStroke,
  onClear,
  className = "",
  ref,
}: {
  width: number;
  height: number;
  ariaLabel: string;
  disabled?: boolean;
  /** Called as a stroke begins, before anything is drawn. */
  onBeforeStroke?: () => void;
  onStroke: (canvas: HTMLCanvasElement) => void;
  onClear: () => void;
  className?: string;
  ref?: React.Ref<SurfaceHandle>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  // Resizing a canvas wipes it, so the size is only set when it really changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#103838";
  }, [width, height]);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      onClear();
    },
    canvas: () => canvasRef.current,
  }));

  /** Pointer position in the canvas' own coordinates. */
  const point = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      };
    },
    [width, height],
  );

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    onBeforeStroke?.();
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap leaves a dot rather than nothing.
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onStroke(e.currentTarget);
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={ariaLabel}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      style={{ touchAction: "none" }}
      className={`cursor-crosshair bg-white ${className}`}
    />
  );
}

type Drawable = HTMLCanvasElement | HTMLImageElement;

function sizeOf(d: Drawable) {
  return d instanceof HTMLImageElement
    ? { w: d.naturalWidth, h: d.naturalHeight }
    : { w: d.width, h: d.height };
}

/** Draws `from` into `into`, as large as fits and centred, keeping its shape. */
function drawContained(from: Drawable, into: HTMLCanvasElement) {
  const ctx = into.getContext("2d");
  const { w: fw, h: fh } = sizeOf(from);
  if (!ctx || fw === 0 || fh === 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const scale = Math.min(into.width / fw, into.height / fh);
  const w = fw * scale;
  const h = fh * scale;
  ctx.drawImage(from, (into.width - w) / 2, (into.height - h) / 2, w, h);
  ctx.restore();
}

const ICON_BUTTON =
  "text-petroleum-400 hover:bg-sand-100 hover:text-petroleum-700 flex size-8 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-40";

/**
 * A box to sign in with a finger, a stylus or a mouse.
 *
 * Reports the drawing as a PNG data URL, or `null` while it is empty — so a
 * form can refuse to submit a blank signature without looking inside the
 * canvas. An eraser sits in the top-right corner to start over, and, when the
 * labels for it are given, an expand icon in the top-left opens the same box
 * across the whole screen: a signature is easier with the room of a tablet or
 * a phone held sideways. What is drawn there is fitted back into this box.
 */
export function SignaturePad({
  onChange,
  clearLabel,
  ariaLabel,
  expandLabel,
  doneLabel,
  closeLabel,
  initialImage,
  onInitialCleared,
  disabled = false,
}: {
  onChange: (dataUrl: string | null) => void;
  /** Accessible name of the eraser, which has no visible text. */
  clearLabel: string;
  ariaLabel: string;
  /** Names of the full-screen controls; without them there is no expand icon. */
  expandLabel?: string;
  doneLabel?: string;
  closeLabel?: string;
  /**
   * A signature already on file, shown inside the box as if it had just been
   * drawn. It is not reported through `onChange`: the form keeps it as it is
   * until the box is erased or drawn on, and `onInitialCleared` says when.
   */
  initialImage?: string | null;
  onInitialCleared?: () => void;
  disabled?: boolean;
}) {
  const inline = useRef<SurfaceHandle>(null);
  const [hasInk, setHasInk] = useState(false);
  const [showingInitial, setShowingInitial] = useState(Boolean(initialImage));
  const [full, setFull] = useState(false);

  // Paint the signature on file once, when the box mounts.
  useEffect(() => {
    if (!initialImage) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      const canvas = inline.current?.canvas();
      if (!cancelled && canvas) drawContained(img, canvas);
    };
    img.src = initialImage;
    return () => {
      cancelled = true;
    };
    // Only the first image: a later one would wipe what is being drawn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reportInline(canvas: HTMLCanvasElement) {
    setHasInk(true);
    onChange(canvas.toDataURL("image/png"));
  }

  function clearInline() {
    setHasInk(false);
    onChange(null);
    if (showingInitial) {
      setShowingInitial(false);
      onInitialCleared?.();
    }
  }

  return (
    <div className="relative">
      <Surface
        ref={inline}
        width={WIDTH}
        height={HEIGHT}
        ariaLabel={ariaLabel}
        disabled={disabled}
        // Drawing on top of the signature on file would merge the two, so the
        // first stroke starts from a clean box.
        onBeforeStroke={() => {
          if (showingInitial) inline.current?.clear();
        }}
        onStroke={reportInline}
        onClear={clearInline}
        className="border-sand-200 w-full rounded-xl border"
      />
      {expandLabel && (
        <button
          type="button"
          onClick={() => setFull(true)}
          disabled={disabled}
          aria-label={expandLabel}
          title={expandLabel}
          className={`${ICON_BUTTON} absolute top-2 left-2`}
        >
          <Maximize2 size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={() => inline.current?.clear()}
        disabled={disabled || (!hasInk && !showingInitial)}
        aria-label={clearLabel}
        title={clearLabel}
        className={`${ICON_BUTTON} absolute top-2 right-2`}
      >
        <Eraser size={16} />
      </button>

      {full && (
        <FullScreenPad
          getSource={() => (hasInk ? (inline.current?.canvas() ?? null) : null)}
          ariaLabel={ariaLabel}
          clearLabel={clearLabel}
          doneLabel={doneLabel ?? ""}
          closeLabel={closeLabel ?? ""}
          onClose={() => setFull(false)}
          onDone={(drawn) => {
            const target = inline.current?.canvas();
            if (target && drawn) {
              inline.current?.clear();
              drawContained(drawn, target);
              reportInline(target);
            }
            setFull(false);
          }}
        />
      )}
    </div>
  );
}

/**
 * The signature box over the whole screen. It starts from what was already
 * drawn, so opening it never throws a signature away, and hands back its
 * canvas only if something is on it.
 */
function FullScreenPad({
  getSource,
  ariaLabel,
  clearLabel,
  doneLabel,
  closeLabel,
  onClose,
  onDone,
}: {
  /** Read when the box has opened, not while rendering; null when nothing is drawn yet. */
  getSource: () => HTMLCanvasElement | null;
  ariaLabel: string;
  clearLabel: string;
  doneLabel: string;
  closeLabel: string;
  onClose: () => void;
  onDone: (drawn: HTMLCanvasElement | null) => void;
}) {
  const area = useRef<HTMLDivElement>(null);
  const surface = useRef<SurfaceHandle>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [hasInk, setHasInk] = useState(false);

  // The box is as big as the room the screen gives it, so it is measured.
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    const measure = () =>
      setSize({
        w: Math.floor(el.clientWidth),
        h: Math.floor(el.clientHeight),
      });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Carry over what was drawn in the small box, once the big one has its size.
  const carried = useRef(false);
  useEffect(() => {
    if (!size || carried.current) return;
    const source = getSource();
    if (!source || !surface.current?.canvas()) return;
    carried.current = true;
    // The surface sizes itself in an effect; wait a frame so it is ready.
    requestAnimationFrame(() => {
      const target = surface.current?.canvas();
      if (!target) return;
      drawContained(source, target);
      setHasInk(true);
    });
  }, [size, getSource]);

  // Keep the page from scrolling behind the box, and let Escape close it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      <div className="border-sand-200 flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          className={ICON_BUTTON}
        >
          <X size={18} />
        </button>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => surface.current?.clear()}
            disabled={!hasInk}
            aria-label={clearLabel}
            title={clearLabel}
            className={ICON_BUTTON}
          >
            <Eraser size={16} />
          </button>
          <Button
            variant="solid"
            size="md"
            onClick={() =>
              onDone(hasInk ? (surface.current?.canvas() ?? null) : null)
            }
          >
            {doneLabel}
          </Button>
        </div>
      </div>

      <div ref={area} className="min-h-0 flex-1 p-4">
        {size && (
          <Surface
            ref={surface}
            width={size.w - 32}
            height={size.h - 32}
            ariaLabel={ariaLabel}
            onStroke={() => setHasInk(true)}
            onClear={() => setHasInk(false)}
            className="border-sand-200 size-full rounded-xl border"
          />
        )}
      </div>
    </div>
  );
}
