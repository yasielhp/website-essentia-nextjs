/**
 * The page of a message while it loads, in its own shape, so nothing jumps when
 * it arrives: the header with its buttons, then the form on the left and the
 * preview on the right (an email's two columns, or a WhatsApp notice's form and
 * phone bubble). No hooks and no words of its own: the route's `loading.tsx`
 * (a server component) and the page's own wait (a client one) both draw it.
 *
 * Its pieces are exported for the two places that load later inside the page:
 * the body of the editor (`BodySkeleton`) and the preview (`EmailCardSkeleton`).
 */

const PULSE = "bg-sand-100 animate-pulse";

function Bar({ className }: { className: string }) {
  return <div className={`${PULSE} rounded ${className}`} />;
}

/** A label with its input under it, as the form's text fields are. */
function FieldSkeleton({ hint = false }: { hint?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Bar className="h-3 w-20" />
      <Bar className="h-12 w-full rounded-xl" />
      {hint && <Bar className="h-3 w-56" />}
    </div>
  );
}

/** The inside of the body editor: the kicker, the title, the text and the blocks. */
export function BodySkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 py-2">
      <Bar className="h-3 w-28" />
      <Bar className="h-7 w-3/4" />
      <div className="border-sand-100 border-b" />
      <Bar className="h-4 w-full" />
      <Bar className="h-4 w-5/6" />
      {[0, 1].map((i) => (
        <div
          key={i}
          className="border-sand-200 bg-sand-50 flex items-center gap-3 rounded-xl border border-dashed px-3 py-3"
        >
          <Bar className="size-5" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Bar className="h-3.5 w-40" />
            <Bar className="h-3 w-56" />
          </div>
        </div>
      ))}
      <Bar className="h-4 w-2/3" />
    </div>
  );
}

/** An email being prepared: the dark band of the logo, then its lines. */
export function EmailCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <div className="border-sand-200 w-full max-w-[600px] overflow-hidden rounded-2xl border bg-white">
        <div className="bg-petroleum-700/15 h-24 animate-pulse" />
        <div className="flex flex-col gap-3 p-6">
          <Bar className="h-3 w-28" />
          <Bar className="h-6 w-3/4" />
          <Bar className="h-4 w-full" />
          <Bar className="h-4 w-5/6" />
          <Bar className="mt-2 h-40 w-full rounded-xl" />
          <Bar className="h-4 w-2/3" />
          <Bar className="mx-auto mt-4 h-10 w-44 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function MessagePageSkeleton({
  channel,
  title,
  label,
}: {
  channel: "email" | "whatsapp";
  /** The page's title when it is already known, else a bar where it goes. */
  title?: string;
  /** What a screen reader hears while it loads. */
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {title ? (
          <h1 className="font-display text-petroleum-700 text-3xl">{title}</h1>
        ) : (
          <Bar className="h-9 w-72 rounded-xl" />
        )}
        <div className="flex gap-3">
          <Bar className="h-10 w-28 rounded-full" />
          <Bar className="h-10 w-24 rounded-full" />
        </div>
      </div>

      {channel === "email" ? (
        <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <Bar className="h-3 w-14" />
              <Bar className="h-9 w-40 rounded-full" />
            </div>
            <FieldSkeleton />
            <FieldSkeleton hint />
            <div className="flex flex-col gap-2">
              <Bar className="h-3 w-16" />
              <Bar className="h-3 w-full" />
              <div className="border-sand-200 rounded-2xl border bg-white">
                <div className="border-sand-100 flex gap-2 border-b px-3 py-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Bar key={i} className="size-8 rounded-full" />
                  ))}
                </div>
                <div className="px-4 py-2">
                  <BodySkeleton />
                </div>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <Bar className="mt-2.5 h-3 w-20" />
              <Bar className="h-10 w-36 rounded-full" />
            </div>
            <EmailCardSkeleton />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <Bar className="h-3 w-14" />
            <Bar className="h-9 w-40 rounded-full" />
          </div>
          <Bar className="h-20 w-full rounded-xl" />
          <FieldSkeleton />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            <div className="flex flex-col gap-4">
              <FieldSkeleton />
              <FieldSkeleton />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <Bar className="mt-2.5 h-3.5 w-20" />
                <Bar className="h-10 w-36 rounded-full" />
              </div>
              <div className="bg-sand-100/60 rounded-2xl p-4">
                <div className="ml-auto flex max-w-[320px] flex-col gap-2 rounded-xl bg-white/70 px-3 py-3">
                  <Bar className="h-3.5 w-full" />
                  <Bar className="h-3.5 w-5/6" />
                  <Bar className="h-3.5 w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
