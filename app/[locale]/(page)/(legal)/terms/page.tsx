import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEs = locale === "es";

  return {
    title: isEs
      ? "Términos y Condiciones | Essentia"
      : "Terms & Conditions | Essentia",
    description: isEs
      ? "Lee los términos y condiciones de Essentia para membresías, reservas y uso de nuestros servicios de longevidad y bienestar en Costa Adeje, Tenerife."
      : "Read Essentia's terms and conditions for membership, bookings, and use of our longevity and wellness services in Costa Adeje, Tenerife.",
    alternates: {
      canonical: isEs ? "/es/terms" : "/terms",
      languages: {
        en: "/terms",
        es: "/es/terms",
        "x-default": "/terms",
      },
    },
  };
}

export default async function TermsPage() {
  const locale = await getLocale();

  if (locale === "es") {
    return (
      <>
        <h1>Términos y Condiciones</h1>
        <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
          Última actualización: mayo 2026
        </p>

        <p>
          Los presentes Términos y Condiciones (&quot;Términos&quot;) rigen el
          acceso y uso de las instalaciones, servicios y sitio web de Essentia
          Social Wellness Club (&quot;Essentia&quot;, &quot;nosotros&quot;,
          &quot;nos&quot;). Al hacerse socio, realizar una reserva o utilizar
          nuestros servicios, usted acepta quedar vinculado por estos Términos.
        </p>

        <h2>1. Servicios</h2>
        <p>
          Essentia ofrece una selección curada de servicios de longevidad y
          bienestar, que incluyen, entre otros, terapia de contraste, terapia de
          luz roja, cámaras hiperbáricas, terapia intravenosa, terapias
          manuales, sesiones de respiración y consultas médicas. La
          disponibilidad de los servicios puede variar en función de su nivel de
          membresía y el calendario de reservas.
        </p>

        <h2>2. Membresía</h2>
        <h3>2.1 Niveles</h3>
        <p>
          Essentia ofrece tres niveles de membresía: Essential, Premium y
          Founder. Cada nivel otorga distintos grados de acceso a las
          instalaciones, derechos de reserva prioritaria y beneficios
          adicionales descritos en nuestra página de membresías.
        </p>
        <h3>2.2 Requisitos de acceso</h3>
        <p>
          La membresía está abierta a personas mayores de 18 años. Essentia se
          reserva el derecho de rechazar o cancelar una membresía a su entera
          discreción.
        </p>
        <h3>2.3 Cuotas de membresía</h3>
        <p>
          Las cuotas de membresía se facturan mensual o anualmente según lo
          seleccionado en el momento del registro. Las cuotas no son
          reembolsables salvo cuando así lo exija la legislación aplicable. Nos
          reservamos el derecho de ajustar los precios con un preaviso escrito
          de 30 días.
        </p>
        <h3>2.4 Cancelación</h3>
        <p>
          Las membresías mensuales pueden cancelarse con un preaviso escrito de
          30 días. Las membresías anuales no podrán cancelarse a mitad de
          periodo, salvo en circunstancias excepcionales a la entera discreción
          de Essentia. Las solicitudes de cancelación deben enviarse a{" "}
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>
          .
        </p>

        <h2>3. Reservas</h2>
        <h3>3.1 Reservaciones</h3>
        <p>
          Determinados servicios e instalaciones requieren reserva previa. Las
          reservas pueden realizarse a través de nuestro sitio web o contactando
          directamente con nosotros.
        </p>
        <h3>3.2 Política de cancelación y no presentación</h3>
        <p>
          Las reservas pueden cancelarse o reprogramarse sin cargo hasta 24
          horas antes de la hora programada. Las cancelaciones en las 24 horas
          previas o la no presentación podrán facturarse al precio íntegro de la
          sesión o deducirse del saldo de sesiones disponible.
        </p>

        <h2>4. Salud y seguridad</h2>
        <p>
          Usted reconoce que determinados servicios de Essentia pueden conllevar
          riesgos para la salud. Acepta revelar cualquier condición médica,
          lesión o contraindicación relevante para el uso previsto de nuestros
          servicios. Essentia se reserva el derecho de denegar el servicio a
          cualquier socio cuya participación pueda suponer un riesgo para la
          salud o la seguridad.
        </p>
        <p>
          Usted utiliza todas las instalaciones bajo su propia responsabilidad.
          Essentia no será responsable de ninguna lesión, enfermedad o pérdida
          sufrida durante el uso de nuestros servicios, salvo en la medida en
          que sea causada por nuestra propia negligencia o conducta dolosa.
        </p>

        <h2>5. Código de conducta</h2>
        <p>Los socios y visitantes se comprometen a:</p>
        <ul>
          <li>
            Tratar al personal y a los demás socios con respeto en todo momento.
          </li>
          <li>
            Cumplir todas las normas de las instalaciones y las instrucciones
            del personal.
          </li>
          <li>
            Mantener los estándares de higiene adecuados al utilizar las
            instalaciones compartidas.
          </li>
          <li>
            No incurrir en comportamientos perturbadores, ofensivos o
            perjudiciales para terceros.
          </li>
        </ul>
        <p>
          El incumplimiento del código de conducta podrá dar lugar a la
          suspensión o cancelación inmediata de la membresía sin derecho a
          reembolso.
        </p>

        <h2>6. Propiedad intelectual</h2>
        <p>
          Todos los derechos de propiedad intelectual sobre nuestro sitio web,
          marca, programas y materiales pertenecen a Essentia Social Wellness
          Club. No podrá reproducirlos ni utilizarlos sin consentimiento previo
          y por escrito.
        </p>

        <h2>7. Limitación de responsabilidad</h2>
        <p>
          En la máxima medida permitida por la ley, la responsabilidad total de
          Essentia frente a usted por cualquier reclamación derivada de o en
          relación con estos Términos no excederá el importe total de las cuotas
          de membresía abonadas por usted en los tres meses anteriores al
          acontecimiento que dio lugar a la reclamación.
        </p>

        <h2>8. Modificaciones de los Términos</h2>
        <p>
          Podemos actualizar estos Términos periódicamente. Los cambios
          sustanciales se comunicarán con un preaviso mínimo de 30 días por
          correo electrónico o a través de nuestro sitio web. El uso continuado
          de nuestros servicios tras la fecha de entrada en vigor implica la
          aceptación de los Términos revisados.
        </p>

        <h2>9. Ley aplicable y jurisdicción</h2>
        <p>
          Estos Términos se rigen por la legislación española. Cualquier
          controversia estará sometida a la jurisdicción exclusiva de los
          Juzgados y Tribunales de Santa Cruz de Tenerife, España, salvo que las
          disposiciones imperativas de protección al consumidor establezcan otra
          cosa.
        </p>

        <h2>10. Contacto</h2>
        <p>
          Para cualquier consulta sobre estos Términos, contáctenos en{" "}
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>{" "}
          o por teléfono en <a href="tel:+34922123456">+34 922 123 456</a>.
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Terms &amp; Conditions</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: May 2026
      </p>

      <p>
        These Terms and Conditions (&quot;Terms&quot;) govern your access to and
        use of the facilities, services, and website of Essentia Social Wellness
        Club (&quot;Essentia&quot;, &quot;we&quot;, &quot;us&quot;). By becoming
        a member, making a booking, or using our services, you agree to be bound
        by these Terms.
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
        circumstances at Essentia&apos;s sole discretion. Cancellation requests
        must be sent to{" "}
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
        To the fullest extent permitted by law, Essentia&apos;s total liability
        to you for any claim arising out of or in connection with these Terms
        shall not exceed the total membership fees paid by you in the three
        months preceding the event giving rise to the claim.
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
