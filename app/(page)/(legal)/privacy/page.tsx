import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Essentia",
  description:
    "Essentia's privacy policy: how we collect, use, and protect your personal data in compliance with GDPR and Spanish data protection law.",
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="mt-1 mb-8 text-xs tracking-widest text-petroleum-400 uppercase">
        Last updated: May 2026
      </p>

      <p>
        Essentia Social Wellness Club ("Essentia", "we", "us", or "our") is
        committed to protecting your personal data. This Privacy Policy explains
        how we collect, use, store, and protect your information when you visit
        our website or use our services, in accordance with Regulation (EU)
        2016/679 (GDPR) and Spanish Organic Law 3/2018 (LOPDGDD).
      </p>

      <h2>1. Data Controller</h2>
      <p>
        <strong>Essentia Social Wellness Club</strong>
        <br />
        Baobab Suites, Costa Adeje, Tenerife, Islas Canarias, España
        <br />
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>
      </p>

      <h2>2. Data We Collect</h2>
      <p>We may collect the following categories of personal data:</p>
      <ul>
        <li>
          <strong>Identity data:</strong> name, surname, date of birth.
        </li>
        <li>
          <strong>Contact data:</strong> email address, phone number, postal
          address.
        </li>
        <li>
          <strong>Health data:</strong> relevant health information you voluntarily
          provide prior to using certain wellness services (treated as special
          category data with explicit consent).
        </li>
        <li>
          <strong>Booking and transaction data:</strong> session bookings,
          membership details, payment records.
        </li>
        <li>
          <strong>Communications data:</strong> messages sent via our contact form
          or email.
        </li>
        <li>
          <strong>Technical data:</strong> IP address, browser type, device
          information, and cookie identifiers when you use our website.
        </li>
      </ul>

      <h2>3. Legal Basis for Processing</h2>
      <ul>
        <li>
          <strong>Contract performance:</strong> processing necessary to manage
          your membership and bookings.
        </li>
        <li>
          <strong>Consent:</strong> marketing communications and processing of
          health data; you may withdraw consent at any time.
        </li>
        <li>
          <strong>Legitimate interest:</strong> improving our services, website
          security, and fraud prevention.
        </li>
        <li>
          <strong>Legal obligation:</strong> compliance with applicable tax,
          accounting, and regulatory requirements.
        </li>
      </ul>

      <h2>4. How We Use Your Data</h2>
      <ul>
        <li>To process memberships, bookings, and payments.</li>
        <li>To communicate service updates and appointment confirmations.</li>
        <li>To send newsletters and promotional offers (with your consent).</li>
        <li>To improve our website experience and services.</li>
        <li>To comply with legal and regulatory obligations.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We retain personal data only for as long as necessary for the purposes
        described above. Membership and booking records are kept for a minimum of
        five years to meet tax obligations. Communications data is retained for
        two years. Marketing data is retained until you withdraw consent.
      </p>

      <h2>6. Data Sharing</h2>
      <p>
        We do not sell your personal data. We may share your data with:
      </p>
      <ul>
        <li>
          <strong>Service providers:</strong> payment processors, booking
          platforms, and email service providers acting as data processors under
          binding agreements.
        </li>
        <li>
          <strong>Legal authorities:</strong> where required by law or court
          order.
        </li>
      </ul>
      <p>
        Where data is transferred outside the EEA, we ensure adequate safeguards
        are in place (e.g., Standard Contractual Clauses).
      </p>

      <h2>7. Your Rights</h2>
      <p>Under GDPR, you have the right to:</p>
      <ul>
        <li>
          <strong>Access</strong> the personal data we hold about you.
        </li>
        <li>
          <strong>Rectify</strong> inaccurate or incomplete data.
        </li>
        <li>
          <strong>Erase</strong> your data ("right to be forgotten") where no
          legal basis remains for retention.
        </li>
        <li>
          <strong>Restrict</strong> processing while a complaint is investigated.
        </li>
        <li>
          <strong>Data portability:</strong> receive your data in a structured,
          machine-readable format.
        </li>
        <li>
          <strong>Object</strong> to processing based on legitimate interests or
          for direct marketing.
        </li>
        <li>
          <strong>Withdraw consent</strong> at any time without affecting the
          lawfulness of prior processing.
        </li>
      </ul>
      <p>
        To exercise any of these rights, contact us at{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>
        . We will respond within 30 days. You also have the right to lodge a
        complaint with the Spanish Data Protection Agency (
        <a
          href="https://www.aepd.es"
          target="_blank"
          rel="noopener noreferrer"
        >
          aepd.es
        </a>
        ).
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use cookies and similar technologies on our website. For full details,
        please read our <a href="/cookies">Cookie Policy</a>.
      </p>

      <h2>9. Updates to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of significant changes by email or by posting a notice on our website.
        Continued use of our services after such changes constitutes acceptance of
        the updated policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        For any privacy-related questions, please write to us at{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>{" "}
        or by post to Baobab Suites, Costa Adeje, Tenerife, Islas Canarias,
        España.
      </p>
    </>
  );
}
