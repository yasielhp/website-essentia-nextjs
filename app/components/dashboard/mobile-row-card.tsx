import type { MouseEventHandler, ReactNode } from "react";

/**
 * One row of a list on a phone: the table's header is not there, so every datum
 * carries its own label, and the action is a button across the card, tall enough
 * for a thumb (`MOBILE_ACTION`). Order: the title with what it is about, then the
 * labelled facts, then whatever else needs room, then the action.
 *
 * It renders a `<li>`: the caller wraps the cards in a `<ul>` that only shows
 * below the table's breakpoint (the table, a `hidden md:block` sibling, is the
 * one assistive technology reads on a wide screen).
 */

/** An action on a card: across it, at least 44 px tall. */
export const MOBILE_ACTION = "h-11 w-full";

export type CardFact = { label: string; value: ReactNode };

export function MobileRowCard({
  title,
  description,
  facts,
  children,
  action,
  onClick,
}: {
  title: ReactNode;
  description?: ReactNode;
  facts?: CardFact[];
  children?: ReactNode;
  action?: ReactNode;
  /** For a card that opens something when tapped anywhere (its title is the link). */
  onClick?: MouseEventHandler<HTMLLIElement>;
}) {
  return (
    <li
      onClick={onClick}
      className={`flex flex-col gap-3 px-5 py-4 ${onClick ? "active:bg-sand-50 cursor-pointer" : ""}`}
    >
      <div className="min-w-0">
        <p className="text-petroleum-700 font-medium break-words">{title}</p>
        {description && (
          <p className="text-petroleum-400 mt-0.5 text-xs break-words">
            {description}
          </p>
        )}
      </div>
      {facts && facts.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {facts.map((fact) => (
            <div
              key={fact.label}
              className="flex min-w-0 flex-wrap items-center gap-1.5"
            >
              <dt className="text-petroleum-400">{fact.label}:</dt>
              <dd className="text-petroleum-700 min-w-0 break-words">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {action}
    </li>
  );
}
