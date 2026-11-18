"use client";

import { useTooltip } from "@/components/ui/tooltip";

/**
 * The switch of a row of the list of Messages: a switch to the keyboard and to a
 * screen reader (`role="switch"`, named by what it does for THIS row), at least
 * 44 px to touch on a phone. The press is its own: it never reaches the row, so
 * it does not open the message. While it saves it says so and cannot be pressed
 * twice.
 *
 * `locked` is the reason it cannot be pressed (a WhatsApp message with no
 * template has nothing to switch on): it is drawn off, ignores a press, stays
 * reachable by keyboard so the reason can be read, and says it in its name and
 * in a tooltip on hover and on focus.
 */
export function MessageSwitch({
  id,
  label,
  checked,
  busy,
  locked,
  onToggle,
}: {
  id: string;
  /** What it does, for this message and channel: «Activar Reserva recibida, correo». */
  label: string;
  checked: boolean;
  busy: boolean;
  /** Why it cannot be pressed, when it cannot. */
  locked?: string;
  onToggle: () => void;
}) {
  const tip = useTooltip(locked ?? "");
  return (
    <>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={locked ? `${label}. ${locked}` : label}
        aria-busy={busy || undefined}
        aria-disabled={locked ? true : undefined}
        disabled={busy}
        ref={(el) => tip.attach(el)}
        {...(locked ? tip.props : {})}
        onClick={(event) => {
          // Its own press: the row around it would open the message.
          event.stopPropagation();
          if (locked) return;
          onToggle();
        }}
        className={`focus-visible:ring-petroleum-500 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none disabled:cursor-progress disabled:opacity-60 md:min-h-8 md:min-w-0 ${
          locked ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors duration-200 ${
            checked ? "bg-petroleum-500" : "bg-sand-200"
          }`}
        >
          <span
            className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
              checked ? "translate-x-5" : "translate-x-0"
            } ${busy ? "animate-pulse" : ""}`}
          />
        </span>
      </button>
      {locked && tip.bubble}
    </>
  );
}
