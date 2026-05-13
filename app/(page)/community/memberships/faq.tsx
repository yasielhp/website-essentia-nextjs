"use client";

import Link from "next/link";
import { Accordion } from "@components/ui/accordion";

const faqs = [
  {
    q: "How do I become a member?",
    a: "Start by getting in touch through our contact page or booking form. Our team will walk you through the tiers, answer your questions, and arrange a tour of the space before you commit.",
  },
  {
    q: "Can I try Essentia before joining?",
    a: "Yes. We offer introductory visits for prospective members. Contact us to schedule a guided tour and a complimentary session so you can experience the space first-hand.",
  },
  {
    q: "How does billing work?",
    a: "Memberships are billed monthly or annually. Annual members receive a preferred rate. You will choose your billing preference at sign-up.",
  },
  {
    q: "Can I cancel or pause my membership?",
    a: "Monthly memberships may be cancelled with 30 days written notice. Annual memberships run for the full term; exceptions may be considered in extraordinary circumstances. Pauses may be available — speak to our team.",
  },
  {
    q: "What is the difference between Essential and Premium in practice?",
    a: "Essential gives you full access to all shared facilities and group sessions. Premium adds the ability to book specific equipment slots ahead of time, a personalised wellness protocol reviewed monthly, and access to medical consultations with our clinical team.",
  },
  {
    q: "Who is the Founder membership for?",
    a: "Founder is designed for those who want a truly bespoke longevity experience. You get a dedicated health advisor who coordinates all your protocols, unlimited guest access, and seats at invitation-only events. It is limited to a small number of members.",
  },
];

export function MembershipsFaq() {
  return (
    <section className="bg-sand-50 px-5 py-24 md:py-32">
      <div className="mx-auto max-w-2xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            Common questions.
          </h2>
        </div>

        <Accordion.Group className="divide-y divide-petroleum-100">
          {faqs.map((faq) => (
            <Accordion key={faq.q} className="py-1">
              <Accordion.Header>
                <span className="text-petroleum-700 text-left text-base font-medium">
                  {faq.q}
                </span>
              </Accordion.Header>
              <Accordion.Content>
                <p className="text-petroleum-500 pb-5 text-sm leading-7">
                  {faq.a}
                </p>
              </Accordion.Content>
            </Accordion>
          ))}
        </Accordion.Group>

        <p className="text-petroleum-400 mt-10 text-center text-sm">
          Still have questions?{" "}
          <Link
            href="/contact"
            className="text-petroleum-700 underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Get in touch
          </Link>
        </p>
      </div>
    </section>
  );
}
