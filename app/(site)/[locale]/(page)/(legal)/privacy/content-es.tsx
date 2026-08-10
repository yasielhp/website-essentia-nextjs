import Link from "next/link";

/**
 * The privacy page in Spanish.
 *
 * Prose, and a lot of it. It shared a file with the other language, which put
 * two full legal documents in one component and made finding a clause a matter
 * of scrolling past the version you were not looking for.
 */
export function PrivacyES() {
  return (
    <>
      <h1>Política de Privacidad</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Última actualización: mayo 2026
      </p>

      <p>
        Essentia Social Wellness Club (&quot;Essentia&quot;,
        &quot;nosotros&quot;, &quot;nos&quot; o &quot;nuestro&quot;) se
        compromete a proteger sus datos personales. Esta Política de Privacidad
        explica cómo recopilamos, usamos, almacenamos y protegemos su
        información cuando visita nuestro sitio web o utiliza nuestros
        servicios, de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la
        Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de los
        derechos digitales (LOPDGDD).
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
          servicios de bienestar (tratados como datos de categoría especial con
          consentimiento explícito).
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
          <strong>Ejecución de un contrato:</strong> tratamiento necesario para
          gestionar su membresía y reservas.
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
          Para comunicar actualizaciones del servicio y confirmaciones de citas.
        </li>
        <li>
          Para enviar boletines y ofertas promocionales (con su consentimiento).
        </li>
        <li>Para mejorar la experiencia en nuestro sitio web y servicios.</li>
        <li>Para cumplir con las obligaciones legales y reglamentarias.</li>
      </ul>

      <h2>5. Conservación de datos</h2>
      <p>
        Conservamos los datos personales únicamente durante el tiempo necesario
        para los fines descritos anteriormente. Los registros de membresía y
        reservas se conservan durante un mínimo de cinco años para cumplir las
        obligaciones fiscales. Los datos de comunicaciones se conservan durante
        dos años. Los datos de marketing se conservan hasta que usted retire su
        consentimiento.
      </p>

      <h2>6. Comunicación de datos</h2>
      <p>No vendemos sus datos personales. Podemos compartir sus datos con:</p>
      <ul>
        <li>
          <strong>Proveedores de servicios:</strong> procesadores de pagos,
          plataformas de reservas y proveedores de servicios de correo
          electrónico que actúan como encargados del tratamiento en virtud de
          acuerdos vinculantes.
        </li>
        <li>
          <strong>Autoridades legales:</strong> cuando así lo exija la ley o una
          resolución judicial.
        </li>
      </ul>
      <p>
        Cuando los datos se transfieran fuera del Espacio Económico Europeo,
        garantizamos la existencia de salvaguardias adecuadas (p. ej., cláusulas
        contractuales tipo).
      </p>

      <h2>7. Sus derechos</h2>
      <p>En virtud del RGPD, usted tiene derecho a:</p>
      <ul>
        <li>
          <strong>Acceder</strong> a los datos personales que conservamos sobre
          usted.
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
          <strong>Oponerse</strong> al tratamiento basado en intereses legítimos
          o para marketing directo.
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
        <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
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
