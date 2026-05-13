import Link from "next/link";

const legalLinks = [
  { href: "/legal", label: "Legal Notice" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/cookies", label: "Cookie Policy" },
];

export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <section className="bg-sand-50 min-h-dvh">
      <div className="mx-auto max-w-3xl px-5 pt-32 pb-24">
        {/* Nav between legal pages */}
        <nav
          aria-label="Legal pages"
          className="mb-12 flex flex-wrap gap-x-6 gap-y-2 border-b border-petroleum-100 pb-6"
        >
          {legalLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-petroleum-400 hover:text-petroleum-700 text-sm transition-colors duration-150"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <article className="prose max-w-none prose-headings:font-display prose-headings:text-petroleum-700 prose-headings:font-normal prose-p:text-petroleum-500 prose-p:leading-relaxed prose-a:text-petroleum-600 prose-a:no-underline hover:prose-a:underline prose-strong:text-petroleum-700 prose-li:text-petroleum-500 prose-h1:text-3xl prose-h1:md:text-4xl prose-h2:text-xl prose-h2:mt-10 prose-h3:text-base prose-h3:font-medium">
          {children}
        </article>
      </div>
    </section>
  );
}
