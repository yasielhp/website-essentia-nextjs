import Link from "next/link";

/**
 * The privacy page in English.
 *
 * Prose, and a lot of it. It shared a file with the other language, which put
 * two full legal documents in one component and made finding a clause a matter
 * of scrolling past the version you were not looking for.
 */
export function PrivacyEN() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: November 2026
      </p>

      <p>
        Essentia Social Wellness Club (&quot;Essentia&quot;, &quot;we&quot;,
        &quot;us&quot;, or &quot;our&quot;) is committed to protecting your
        personal data. This Privacy Policy explains how we collect, use, store,
        and protect your information when you visit our website or use our
        services, in accordance with Regulation (EU) 2016/679 (GDPR) and Spanish
        Organic Law 3/2018 (LOPDGDD).
      </p>

      <h2>1. Data Controller</h2>
      <p>
        <strong>Yusleidy Caridad Jiménez Pérez</strong>
        <br />
        NIE: Y8199130N
        <br />
        Trading name: Essentia Social Wellness Club
        <br />
        Calle Arure 29, San Isidro, 38611 Santa Cruz de Tenerife, Islas
        Canarias, España
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
          <strong>Health data:</strong> the health information you give in our
          informed consent before using certain wellness services, together with
          your signature, which is collected electronically (treated as special
          category data with your explicit consent).
        </li>
        <li>
          <strong>Image data:</strong> photographs of the treated area to
          document its progress, only with your express and separate permission
          and never for public use.
        </li>
        <li>
          <strong>Booking and transaction data:</strong> session bookings,
          advance payments and deposits, session vouchers bought and used,
          membership details and payment records. Card payments are handled by
          the Redsys gateway; we do not store your card number.
        </li>
        <li>
          <strong>Communications data:</strong> messages sent via our contact
          form or email.
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
        <li>To process memberships, bookings, vouchers and payments.</li>
        <li>To communicate service updates and appointment confirmations.</li>
        <li>
          To assess the suitability and safety of a treatment from your informed
          consent.
        </li>
        <li>
          To send you, after your first session, aftercare instructions and an
          invitation to review our service (legitimate interest; you may object
          at any time).
        </li>
        <li>To send newsletters and promotional offers (with your consent).</li>
        <li>To improve our website experience and services.</li>
        <li>To comply with legal and regulatory obligations.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We retain personal data only for as long as necessary for the purposes
        described above. Membership and booking records are kept for a minimum
        of five years to meet tax obligations. Signed informed consents are kept
        for five years from your last session, including earlier versions when
        they are updated, as a record of the consent given. Communications data
        is retained for two years. Marketing data is retained until you withdraw
        consent.
      </p>

      <h2>6. Data Sharing</h2>
      <p>We do not sell your personal data. We may share your data with:</p>
      <ul>
        <li>
          <strong>Service providers</strong> acting as data processors under
          binding agreements: Redsys and Banco Santander (card payments), Resend
          (email delivery), Google (our staff&apos;s calendar), Meta (WhatsApp
          notifications to our staff), Insforge and Vercel (hosting and
          database) and Sentry (technical error monitoring).
        </li>
        <li>
          <strong>AI assistants</strong> (OpenAI / ChatGPT and Anthropic /
          Claude), only when our staff connect them to our management system to
          look up bookings or contact details or to prepare content. These
          assistants never receive your health answers, your signature or your
          payment details.
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
          <strong>Erase</strong> your data (&quot;right to be forgotten&quot;)
          where no legal basis remains for retention.
        </li>
        <li>
          <strong>Restrict</strong> processing while a complaint is
          investigated.
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
        <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
          aepd.es
        </a>
        ).
      </p>

      <h2>8. Cookies</h2>
      <p>
        We use cookies and similar technologies on our website. For full
        details, please read our <Link href="/cookies">Cookie Policy</Link>.
      </p>

      <h2>9. Updates to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will notify you
        of significant changes by email or by posting a notice on our website.
        Continued use of our services after such changes constitutes acceptance
        of the updated policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        For any privacy-related questions, please write to us at{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>{" "}
        or by post to Calle Arure 29, San Isidro, 38611 Santa Cruz de Tenerife,
        Islas Canarias, España.
      </p>
    </>
  );
}
