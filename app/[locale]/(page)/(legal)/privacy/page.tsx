import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEs = locale === "es";

  return {
    title: isEs
      ? "Política de Privacidad | Essentia"
      : "Privacy Policy | Essentia",
    description: isEs
      ? "Política de privacidad de Essentia: cómo recopilamos, usamos y protegemos tus datos personales conforme al RGPD y la legislación española."
      : "Essentia's privacy policy: how we collect, use, and protect your personal data in compliance with GDPR and Spanish data protection law.",
    alternates: {
      canonical: isEs ? "/es/privacy" : "/privacy",
      languages: {
        en: "/privacy",
        es: "/es/privacy",
        "x-default": "/privacy",
      },
    },
  };
}

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();

  if (locale === "es") {
    return (
      <>
        <h1>Política de Privacidad</h1>
        <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
          Última actualización: mayo 2026
        </p>

        <p>
          Essentia Social Wellness Club (&quot;Essentia&quot;,
          &quot;nosotros&quot;, &quot;nos&quot; o &quot;nuestro&quot;) se
          compromete a proteger sus datos personales. Esta Política de
          Privacidad explica cómo recopilamos, usamos, almacenamos y protegemos
          su información cuando visita nuestro sitio web o utiliza nuestros
          servicios, de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la
          Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de
          los derechos digitales (LOPDGDD).
        </p>

        <h2>1. Responsable del tratamiento</h2>
        <p>
          <strong>Yusleidy Caridad Jiménez Pérez</strong>
          <br />
          NIE: Y8199130N
          <br />
          Nombre comercial: Essentia Social Wellness Club
          <br />
          Calle Arure 29, San Isidro, 38611 Santa Cruz de Tenerife, Islas
          Canarias, España
          <br />
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>
        </p>

        <h2>2. Datos que recopilamos</h2>
        <p>Podemos recopilar las siguientes categorías de datos personales:</p>
        <ul>
          <li>
            <strong>Datos de identidad:</strong> nombre, apellidos, fecha de
            nacimiento.
          </li>
          <li>
            <strong>Datos de contacto:</strong> dirección de correo electrónico,
            número de teléfono, dirección postal.
          </li>
          <li>
            <strong>Datos de salud:</strong> información sanitaria relevante que
            usted facilite voluntariamente antes de utilizar determinados
            servicios de bienestar (tratados como datos de categoría especial
            con consentimiento explícito).
          </li>
          <li>
            <strong>Datos de reservas y transacciones:</strong> reservas de
            sesiones, detalles de membresía y registros de pagos.
          </li>
          <li>
            <strong>Datos de comunicaciones:</strong> mensajes enviados a través
            de nuestro formulario de contacto o por correo electrónico.
          </li>
          <li>
            <strong>Datos técnicos:</strong> dirección IP, tipo de navegador,
            información del dispositivo e identificadores de cookies cuando
            utiliza nuestro sitio web.
          </li>
        </ul>

        <h2>3. Base jurídica del tratamiento</h2>
        <ul>
          <li>
            <strong>Ejecución de un contrato:</strong> tratamiento necesario
            para gestionar su membresía y reservas.
          </li>
          <li>
            <strong>Consentimiento:</strong> comunicaciones de marketing y
            tratamiento de datos de salud; puede retirar su consentimiento en
            cualquier momento.
          </li>
          <li>
            <strong>Interés legítimo:</strong> mejora de nuestros servicios,
            seguridad del sitio web y prevención del fraude.
          </li>
          <li>
            <strong>Obligación legal:</strong> cumplimiento de los requisitos
            fiscales, contables y reglamentarios aplicables.
          </li>
        </ul>

        <h2>4. Cómo utilizamos sus datos</h2>
        <ul>
          <li>Para tramitar membresías, reservas y pagos.</li>
          <li>
            Para comunicar actualizaciones del servicio y confirmaciones de
            citas.
          </li>
          <li>
            Para enviar boletines y ofertas promocionales (con su
            consentimiento).
          </li>
          <li>Para mejorar la experiencia en nuestro sitio web y servicios.</li>
          <li>Para cumplir con las obligaciones legales y reglamentarias.</li>
        </ul>

        <h2>5. Conservación de datos</h2>
        <p>
          Conservamos los datos personales únicamente durante el tiempo
          necesario para los fines descritos anteriormente. Los registros de
          membresía y reservas se conservan durante un mínimo de cinco años para
          cumplir las obligaciones fiscales. Los datos de comunicaciones se
          conservan durante dos años. Los datos de marketing se conservan hasta
          que usted retire su consentimiento.
        </p>

        <h2>6. Comunicación de datos</h2>
        <p>
          No vendemos sus datos personales. Podemos compartir sus datos con:
        </p>
        <ul>
          <li>
            <strong>Proveedores de servicios:</strong> procesadores de pagos,
            plataformas de reservas y proveedores de servicios de correo
            electrónico que actúan como encargados del tratamiento en virtud de
            acuerdos vinculantes.
          </li>
          <li>
            <strong>Autoridades legales:</strong> cuando así lo exija la ley o
            una resolución judicial.
          </li>
        </ul>
        <p>
          Cuando los datos se transfieran fuera del Espacio Económico Europeo,
          garantizamos la existencia de salvaguardias adecuadas (p. ej.,
          cláusulas contractuales tipo).
        </p>

        <h2>7. Sus derechos</h2>
        <p>En virtud del RGPD, usted tiene derecho a:</p>
        <ul>
          <li>
            <strong>Acceder</strong> a los datos personales que conservamos
            sobre usted.
          </li>
          <li>
            <strong>Rectificar</strong> datos inexactos o incompletos.
          </li>
          <li>
            <strong>Suprimir</strong> sus datos (&quot;derecho al olvido&quot;)
            cuando no exista base jurídica para su conservación.
          </li>
          <li>
            <strong>Limitar</strong> el tratamiento mientras se investiga una
            reclamación.
          </li>
          <li>
            <strong>Portabilidad de datos:</strong> recibir sus datos en un
            formato estructurado y legible por máquina.
          </li>
          <li>
            <strong>Oponerse</strong> al tratamiento basado en intereses
            legítimos o para marketing directo.
          </li>
          <li>
            <strong>Retirar el consentimiento</strong> en cualquier momento sin
            que ello afecte a la licitud del tratamiento anterior.
          </li>
        </ul>
        <p>
          Para ejercer cualquiera de estos derechos, contáctenos en{" "}
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>
          . Responderemos en un plazo de 30 días. También tiene derecho a
          presentar una reclamación ante la Agencia Española de Protección de
          Datos (
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
          Utilizamos cookies y tecnologías similares en nuestro sitio web. Para
          más información, consulte nuestra{" "}
          <Link href="/cookies">Política de Cookies</Link>.
        </p>

        <h2>9. Actualizaciones de esta política</h2>
        <p>
          Podemos actualizar esta Política de Privacidad periódicamente. Le
          notificaremos los cambios significativos por correo electrónico o
          mediante un aviso en nuestro sitio web. El uso continuado de nuestros
          servicios tras dichos cambios implica la aceptación de la política
          actualizada.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta relacionada con la privacidad, escríbanos a{" "}
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>{" "}
          o por correo postal a Calle Arure 29, San Isidro, 38611 Santa Cruz de
          Tenerife, Islas Canarias, España.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: May 2026
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
          <strong>Health data:</strong> relevant health information you
          voluntarily provide prior to using certain wellness services (treated
          as special category data with explicit consent).
        </li>
        <li>
          <strong>Booking and transaction data:</strong> session bookings,
          membership details, payment records.
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
        <li>To process memberships, bookings, and payments.</li>
        <li>To communicate service updates and appointment confirmations.</li>
        <li>To send newsletters and promotional offers (with your consent).</li>
        <li>To improve our website experience and services.</li>
        <li>To comply with legal and regulatory obligations.</li>
      </ul>

      <h2>5. Data Retention</h2>
      <p>
        We retain personal data only for as long as necessary for the purposes
        described above. Membership and booking records are kept for a minimum
        of five years to meet tax obligations. Communications data is retained
        for two years. Marketing data is retained until you withdraw consent.
      </p>

      <h2>6. Data Sharing</h2>
      <p>We do not sell your personal data. We may share your data with:</p>
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
