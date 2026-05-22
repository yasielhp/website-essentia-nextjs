"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export type FaqItem = { question: string; answer: string };

export function ServiceFaq({ faqs }: { faqs: FaqItem[] }) {
  const t = useTranslations("serviceFaqs");
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="bg-sand-50 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-petroleum-700 mb-10 text-3xl md:text-4xl">
          {t("sectionHeading")}
        </h2>

        <div className="divide-sand-200 divide-y">
          {faqs.map((faq, i) => (
            <div key={i} className="py-5">
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                className="flex w-full items-start justify-between gap-4 text-left"
                aria-expanded={open === i}
              >
                <h3 className="text-petroleum-700 text-base leading-snug font-medium">
                  {faq.question}
                </h3>
                <span
                  className="text-petroleum-400 mt-0.5 shrink-0 text-lg leading-none transition-transform duration-200"
                  style={{
                    transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                  }}
                  aria-hidden
                >
                  +
                </span>
              </button>

              {open === i && (
                <p className="text-petroleum-500 mt-4 leading-relaxed">
                  {faq.answer}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
