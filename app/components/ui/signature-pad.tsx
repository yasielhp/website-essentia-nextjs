"use client";

import { useCallback, useEffect, useRef } from "react";

const WIDTH = 600;
const HEIGHT = 200;

/**
 * A box to sign in with a finger, a stylus or a mouse.
 *
 * Reports the drawing as a PNG data URL, or `null` while it is empty — so a
 * form can refuse to submit a blank signature without looking inside the
 * canvas. The canvas is drawn at the screen's pixel density so a stroke stays
 * crisp on a phone, and `touch-action: none` keeps the page from scrolling
 * under the finger while somebody signs.
 */
export function SignaturePad({
  onChange,
  clearLabel,
  ariaLabel,
  disabled = false,
}: {
  onChange: (dataUrl: string | null) => void;
  clearLabel: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = WIDTH * ratio;
    canvas.height = HEIGHT * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#103838";
  }, []);

  /** Pointer position in the canvas' own 600x200 coordinates. */
  const point = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }, []);

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
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
    inked.current = true;
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
    if (inked.current) onChange(e.currentTarget.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    inked.current = false;
    onChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ touchAction: "none", aspectRatio: `${WIDTH} / ${HEIGHT}` }}
        className="border-sand-200 w-full cursor-crosshair rounded-xl border bg-white"
      />
      <button
        type="button"
        onClick={clear}
        disabled={disabled}
        className="text-petroleum-400 hover:text-petroleum-700 w-fit text-xs underline disabled:opacity-50"
      >
        {clearLabel}
      </button>
    </div>
  );
}
