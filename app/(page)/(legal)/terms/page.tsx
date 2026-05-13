import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Essentia",
  description:
    "Read Essentia's terms and conditions for membership, bookings, and use of our longevity and wellness services in Costa Adeje, Tenerife.",
};

export default function TermsPage() {
  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: May 2026
      </p>

      <p>
        These Terms and Conditions ("Terms") govern your access to and use of
        the facilities, services, and website of Essentia Social Wellness Club
        ("Essentia", "we", "us"). By becoming a member, making a booking, or
        using our services, you agree to be bound by these Terms.
      </p>

      <h2>1. Services</h2>
      <p>
        Essentia offers a curated range of longevity and wellness services
        including but not limited to contrast therapy, red light therapy,
        hyperbaric chambers, intravenous therapy, manual therapies, breathing
        sessions, and medical consultations. Service availability may vary
        depending on your membership tier and booking schedule.
      </p>

      <h2>2. Membership</h2>
      <h3>2.1 Tiers</h3>
      <p>
        Essentia offers three membership tiers: Essential, Premium, and Founder.
        Each tier grants different levels of access to facilities, priority
        booking rights, and additional benefits as described on our memberships
        page.
      </p>
      <h3>2.2 Eligibility</h3>
      <p>
        Membership is open to individuals aged 18 and over. Essentia reserves
        the right to decline or terminate membership at its discretion.
      </p>
      <h3>2.3 Membership Fees</h3>
      <p>
        Membership fees are billed monthly or annually as selected at sign-up.
        Fees are non-refundable except where required by applicable law. We
        reserve the right to adjust pricing with 30 days prior written notice.
      </p>
      <h3>2.4 Cancellation</h3>
      <p>
        Monthly memberships may be cancelled with 30 days written notice. Annual
        memberships may not be cancelled mid-term except in exceptional
        circumstances at Essentia's sole discretion. Cancellation requests must
        be sent to{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>
        .
      </p>

      <h2>3. Bookings</h2>
      <h3>3.1 Reservations</h3>
      <p>
        Certain services and facilities require advance booking. Bookings can be
        made through our website or by contacting us directly.
      </p>
      <h3>3.2 Cancellation and No-Show Policy</h3>
      <p>
        Bookings may be cancelled or rescheduled up to 24 hours before the
        scheduled time at no charge. Cancellations within 24 hours or no-shows
        may be charged at the full session rate or deducted from an available
        session allowance.
      </p>

      <h2>4. Health and Safety</h2>
      <p>
        You acknowledge that certain services at Essentia may carry health
        risks. You agree to disclose any medical conditions, injuries, or
        contraindications relevant to your intended use of our services.
        Essentia reserves the right to decline service to any member whose
        participation may pose a health or safety risk.
      </p>
      <p>
        You use all facilities at your own risk. Essentia is not liable for any
        injury, illness, or loss suffered during your use of our services,
        except to the extent caused by our own negligence or wilful misconduct.
      </p>

      <h2>5. Code of Conduct</h2>
      <p>Members and guests agree to:</p>
      <ul>
        <li>Treat staff and other members with respect at all times.</li>
        <li>Follow all facility rules and staff instructions.</li>
        <li>
          Maintain appropriate hygiene standards when using shared facilities.
        </li>
        <li>
          Not engage in behaviour that is disruptive, offensive, or harmful to
          others.
        </li>
      </ul>
      <p>
        Breach of the code of conduct may result in immediate suspension or
        termination of membership without refund.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        All intellectual property rights in our website, branding, programmes,
        and materials belong to Essentia Social Wellness Club. You may not
        reproduce or use them without prior written consent.
      </p>

      <h2>7. Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, Essentia's total liability to
        you for any claim arising out of or in connection with these Terms shall
        not exceed the total membership fees paid by you in the three months
        preceding the event giving rise to the claim.
      </p>

      <h2>8. Changes to Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        communicated with at least 30 days notice by email or via our website.
        Continued use of our services after the effective date constitutes
        acceptance of the revised Terms.
      </p>

      <h2>9. Governing Law</h2>
      <p>
        These Terms are governed by Spanish law. Any disputes shall be subject
        to the exclusive jurisdiction of the Courts of Santa Cruz de Tenerife,
        Spain, unless mandatory consumer protection provisions provide
        otherwise.
      </p>

      <h2>10. Contact</h2>
      <p>
        For questions about these Terms, please contact us at{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>{" "}
        or by phone at <a href="tel:+34922123456">+34 922 123 456</a>.
      </p>
    </>
  );
}
