import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEs = locale === "es";

  return {
    title: isEs ? "Política de Cookies | Essentia" : "Cookie Policy | Essentia",
    description: isEs
      ? "Descubre cómo Essentia utiliza cookies y tecnologías similares en nuestro sitio web, y cómo gestionar tus preferencias."
      : "Learn how Essentia uses cookies and similar technologies on our website, and how to manage your preferences.",
    alternates: {
      canonical: isEs ? "/es/cookies" : "/en/cookies",
      languages: {
        "es": "/es/cookies",
        "en": "/en/cookies",
      },
    },
  };
}

export default async function CookiePolicyPage() {
  const locale = await getLocale();

  if (locale === "es") {
    return (
      <>
        <h1>Política de Cookies</h1>
        <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
          Última actualización: mayo 2026
        </p>

        <p>
          La presente Política de Cookies explica cómo Essentia Social Wellness
          Club (&quot;Essentia&quot;, &quot;nosotros&quot;, &quot;nos&quot;)
          utiliza cookies y tecnologías de seguimiento similares en nuestro
          sitio web (essentiawellnessclub.com), y cómo puede gestionar sus
          preferencias.
        </p>

        <h2>1. ¿Qué son las cookies?</h2>
        <p>
          Las cookies son pequeños archivos de texto que se almacenan en su
          dispositivo cuando visita un sitio web. Permiten que el sitio recuerde
          sus acciones y preferencias durante un período de tiempo, de modo que
          no tenga que volver a introducirlas cada vez que lo visite. Las
          cookies pueden ser &quot;de sesión&quot; (se eliminan al cerrar el
          navegador) o &quot;persistentes&quot; (permanecen en su dispositivo
          durante un período determinado).
        </p>

        <h2>2. Tipos de cookies que utilizamos</h2>

        <h3>2.1 Cookies estrictamente necesarias</h3>
        <p>
          Estas cookies son imprescindibles para el correcto funcionamiento del
          sitio web. Habilitan funciones básicas como la navegación entre
          páginas, las áreas seguras y el envío de formularios. Sin ellas, el
          sitio no puede funcionar correctamente. No se requiere consentimiento
          para estas cookies.
        </p>

        <h3>2.2 Cookies analíticas</h3>
        <p>
          Utilizamos herramientas de análisis (como Google Analytics) para
          comprender cómo interactúan los visitantes con nuestro sitio web: qué
          páginas se visitan, cuánto tiempo permanecen los usuarios y qué
          acciones realizan. Estos datos se agregan y anonimizan en la medida de
          lo posible, y se utilizan únicamente para mejorar nuestro sitio web.
        </p>
        <p>
          Estas cookies solo se instalan con su consentimiento. Puede retirar su
          consentimiento en cualquier momento a través de sus preferencias de
          cookies.
        </p>

        <h3>2.3 Cookies funcionales</h3>
        <p>
          Las cookies funcionales recuerdan sus preferencias, como el idioma, la
          región y las opciones de interfaz de usuario, para ofrecer una
          experiencia más personalizada. No son estrictamente necesarias, pero
          mejoran la usabilidad.
        </p>

        <h3>2.4 Cookies de marketing y de terceros</h3>
        <p>
          Podemos utilizar cookies de marketing de terceros para mostrar
          anuncios relevantes y medir la eficacia de las campañas. Estas cookies
          rastrean su navegación en distintos sitios web. Solo se instalan con
          su consentimiento explícito.
        </p>

        <h2>3. Tabla de cookies</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Proveedor</th>
                <th>Finalidad</th>
                <th>Duración</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>_session</code>
                </td>
                <td>Essentia</td>
                <td>Gestión de sesión de usuario</td>
                <td>Sesión</td>
                <td>Estrictamente necesaria</td>
              </tr>
              <tr>
                <td>
                  <code>_ga</code>
                </td>
                <td>Google Analytics</td>
                <td>Distingue usuarios únicos</td>
                <td>2 años</td>
                <td>Analítica</td>
              </tr>
              <tr>
                <td>
                  <code>_ga_*</code>
                </td>
                <td>Google Analytics</td>
                <td>Mantiene el estado de la sesión</td>
                <td>2 años</td>
                <td>Analítica</td>
              </tr>
              <tr>
                <td>
                  <code>_fbp</code>
                </td>
                <td>Meta (Facebook)</td>
                <td>Entrega y medición de anuncios</td>
                <td>90 días</td>
                <td>Marketing</td>
              </tr>
              <tr>
                <td>
                  <code>consent</code>
                </td>
                <td>Essentia</td>
                <td>Almacena las preferencias de consentimiento de cookies</td>
                <td>1 año</td>
                <td>Funcional</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2>4. Gestión de sus preferencias de cookies</h2>
        <p>
          Puede gestionar sus preferencias de cookies en cualquier momento
          haciendo clic en el enlace &quot;Configuración de cookies&quot; en el
          pie de página. También puede controlar las cookies a través de la
          configuración de su navegador:
        </p>
        <ul>
          <li>
            <strong>Chrome:</strong> Configuración &gt; Privacidad y seguridad
            &gt; Cookies
          </li>
          <li>
            <strong>Firefox:</strong> Preferencias &gt; Privacidad &amp;
            Seguridad
          </li>
          <li>
            <strong>Safari:</strong> Preferencias &gt; Privacidad
          </li>
          <li>
            <strong>Edge:</strong> Configuración &gt; Cookies y permisos del
            sitio
          </li>
        </ul>
        <p>
          Tenga en cuenta que deshabilitar determinadas cookies puede afectar la
          funcionalidad de nuestro sitio web.
        </p>

        <h2>5. Cookies de terceros</h2>
        <p>
          Algunas cookies de nuestro sitio web son establecidas por proveedores
          externos. No tenemos control sobre estas cookies. Para más
          información, consulte las políticas de privacidad de los terceros
          correspondientes:
        </p>
        <ul>
          <li>
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de privacidad de Google
            </a>
          </li>
          <li>
            <a
              href="https://www.facebook.com/privacy/policy/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Política de privacidad de Meta
            </a>
          </li>
        </ul>

        <h2>6. Actualizaciones de esta política</h2>
        <p>
          Podemos actualizar esta Política de Cookies periódicamente para
          reflejar cambios tecnológicos o en la legislación aplicable. Le
          notificaremos los cambios significativos mediante un aviso en nuestro
          sitio web.
        </p>

        <h2>7. Contacto</h2>
        <p>
          Para cualquier consulta sobre el uso de cookies, contáctenos en{" "}
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>
          .
        </p>
      </>
    );
  }

  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: May 2026
      </p>

      <p>
        This Cookie Policy explains how Essentia Social Wellness Club
        (&quot;Essentia&quot;, &quot;we&quot;, &quot;us&quot;) uses cookies and
        similar tracking technologies on our website (essentiawellnessclub.com),
        and how you can manage your preferences.
      </p>

      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They allow the site to remember your actions and preferences
        over a period of time, so you do not have to re-enter them each time you
        visit. Cookies can be &quot;session&quot; (deleted when you close your
        browser) or &quot;persistent&quot; (remain on your device for a set
        period).
      </p>

      <h2>2. Types of Cookies We Use</h2>

      <h3>2.1 Strictly Necessary Cookies</h3>
      <p>
        These cookies are essential for the website to function properly. They
        enable core features such as page navigation, secure areas, and form
        submissions. Without these cookies, the website cannot operate
        correctly. No consent is required for these cookies.
      </p>

      <h3>2.2 Analytics Cookies</h3>
      <p>
        We use analytics tools (such as Google Analytics) to understand how
        visitors interact with our website: which pages are visited, how long
        users stay, and what actions they take. This data is aggregated and
        anonymised where possible and is used solely to improve our website.
      </p>
      <p>
        These cookies are only placed with your consent. You may withdraw your
        consent at any time via your cookie preferences.
      </p>

      <h3>2.3 Functional Cookies</h3>
      <p>
        Functional cookies remember your preferences such as language settings,
        region, and user interface choices to provide a more personalised
        experience. They are not strictly necessary but enhance usability.
      </p>

      <h3>2.4 Marketing and Third-Party Cookies</h3>
      <p>
        We may use third-party marketing cookies to deliver relevant
        advertisements and measure campaign effectiveness. These cookies track
        your browsing across websites. They are only placed with your explicit
        consent.
      </p>

      <h2>3. Cookie Table</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Purpose</th>
              <th>Duration</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>_session</code>
              </td>
              <td>Essentia</td>
              <td>User session management</td>
              <td>Session</td>
              <td>Strictly necessary</td>
            </tr>
            <tr>
              <td>
                <code>_ga</code>
              </td>
              <td>Google Analytics</td>
              <td>Distinguishes unique users</td>
              <td>2 years</td>
              <td>Analytics</td>
            </tr>
            <tr>
              <td>
                <code>_ga_*</code>
              </td>
              <td>Google Analytics</td>
              <td>Maintains session state</td>
              <td>2 years</td>
              <td>Analytics</td>
            </tr>
            <tr>
              <td>
                <code>_fbp</code>
              </td>
              <td>Meta (Facebook)</td>
              <td>Ad delivery and measurement</td>
              <td>90 days</td>
              <td>Marketing</td>
            </tr>
            <tr>
              <td>
                <code>consent</code>
              </td>
              <td>Essentia</td>
              <td>Stores cookie consent preferences</td>
              <td>1 year</td>
              <td>Functional</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>4. Managing Your Cookie Preferences</h2>
      <p>
        You can manage your cookie preferences at any time by clicking the
        &quot;Cookie Settings&quot; link in the footer. You can also control
        cookies through your browser settings:
      </p>
      <ul>
        <li>
          <strong>Chrome:</strong> Settings &gt; Privacy and Security &gt;
          Cookies
        </li>
        <li>
          <strong>Firefox:</strong> Preferences &gt; Privacy &amp; Security
        </li>
        <li>
          <strong>Safari:</strong> Preferences &gt; Privacy
        </li>
        <li>
          <strong>Edge:</strong> Settings &gt; Cookies and site permissions
        </li>
      </ul>
      <p>
        Please note that disabling certain cookies may affect the functionality
        of our website.
      </p>

      <h2>5. Third-Party Cookies</h2>
      <p>
        Some cookies on our website are set by third-party providers. We have no
        control over these cookies. Please refer to the relevant third-party
        privacy policies for more information:
      </p>
      <ul>
        <li>
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Privacy Policy
          </a>
        </li>
        <li>
          <a
            href="https://www.facebook.com/privacy/policy/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Meta Privacy Policy
          </a>
        </li>
      </ul>

      <h2>6. Updates to This Policy</h2>
      <p>
        We may update this Cookie Policy from time to time to reflect changes in
        technology or applicable law. We will notify you of significant changes
        by posting a notice on our website.
      </p>

      <h2>7. Contact</h2>
      <p>
        For any questions about our use of cookies, please contact us at{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>
        .
      </p>
    </>
  );
}
