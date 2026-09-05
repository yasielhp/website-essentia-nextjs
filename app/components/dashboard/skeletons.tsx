"use client";

/**
 * The loading shapes the dashboard already uses, named so a new page cannot
 * invent a fourth. Same greys, same radii, same pulse as the booking pages.
 */

const PULSE = "bg-sand-100 animate-pulse";

/** A page title with its action buttons, before the record has arrived. */
export function HeaderSkeleton({ buttons = 2 }: { buttons?: number }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div className={`${PULSE} h-9 w-48 rounded-xl`} />
      <div className="flex gap-3">
        {Array.from({ length: buttons }).map((_, i) => (
          <div key={i} className={`${PULSE} h-10 w-24 rounded-xl`} />
        ))}
      </div>
    </div>
  );
}

/** A white card with a heading line and a few text lines. */
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="border-sand-200 rounded-2xl border bg-white p-6">
      <div className={`${PULSE} mb-4 h-4 w-24 rounded`} />
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${PULSE} h-4 rounded ${i === lines - 1 ? "w-2/3" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Rows of a table inside its white card: a stacked list on a phone, cells on
 * a desk. `cols` should match the real table so nothing jumps when it loads.
 */
export function TableSkeleton({
  cols,
  rows = 5,
}: {
  cols: number;
  rows?: number;
}) {
  return (
    <>
      <div className="divide-sand-100 divide-y md:hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-5 py-4">
            <div>
              <div className={`${PULSE} h-4 w-32 rounded`} />
              <div className={`${PULSE} mt-1.5 h-3 w-44 rounded`} />
            </div>
            <div className={`${PULSE} ml-4 h-5 w-16 rounded-full`} />
          </div>
        ))}
      </div>
      <div className="hidden md:block">
        <table className="w-full text-sm">
          <tbody>
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="border-sand-100 border-b last:border-0">
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div
                      className={`${PULSE} h-4 rounded ${j === 0 ? "w-32" : "w-20"}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
