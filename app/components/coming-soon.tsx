/**
 * The single "Coming Soon" screen for every service that is not live yet.
 *
 * Each unlaunched page used to carry its own copy of this markup, and they had
 * drifted: some showed an eyebrow and a title, others only a heading. A page
 * that is not live shows this and nothing else — no sections, no prices, no
 * booking links, so nothing is promised that the visitor cannot get.
 *
 * Keep the list of unlaunched routes in `app/constants/unlaunched.ts` in sync:
 * that is what keeps these pages out of the index and out of the sitemap.
 */
export function ComingSoon({
  isEs,
  title,
  body,
}: {
  isEs: boolean;
  /** Service name, shown as the page's h1. */
  title: string;
  /** One line on what it will be. Optional. */
  body?: string;
}) {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <p className="text-petroleum-400 mb-4 text-xs font-semibold tracking-widest uppercase">
          {isEs ? "Próximamente" : "Coming soon"}
        </p>
        <h1 className="font-display text-petroleum-700 text-4xl md:text-5xl">
          {title}
        </h1>
        {body && (
          <p className="text-petroleum-400 mt-5 text-base leading-relaxed">
            {body}
          </p>
        )}
      </div>
    </section>
  );
}
