export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <section className="text-primary min-h-dvh" data-header-theme="dark">
      <div className="mx-auto max-w-3xl px-4 pt-32 pb-16">
        <article className="prose prose-neutral max-w-none">
          {children}
        </article>
      </div>
    </section>
  );
}
