export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-36 pb-28 md:pt-52">
        <article
          className={[
            "prose max-w-none",
            // headings: display font, normal weight, brand dark
            "prose-headings:font-display prose-headings:font-normal prose-headings:text-petroleum-700",
            // H1: large, tight, generous space below
            "prose-h1:text-4xl prose-h1:leading-tight prose-h1:tracking-tight prose-h1:mb-2 md:prose-h1:text-5xl",
            // H2: section markers, clear top margin
            "prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-5",
            // H3: small caps style
            "prose-h3:text-sm prose-h3:font-semibold prose-h3:uppercase prose-h3:tracking-widest prose-h3:text-petroleum-400 prose-h3:mt-8 prose-h3:mb-2",
            // body paragraphs
            "prose-p:text-base prose-p:leading-7",
            // links
            "prose-a:font-medium prose-a:underline-offset-2",
            // lists
            "prose-li:leading-7",
          ].join(" ")}
        >
          {children}
        </article>
      </div>
    </section>
  );
}
