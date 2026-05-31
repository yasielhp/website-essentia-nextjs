import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isEs = locale === "es";

  return {
    title: isEs ? "Aviso Legal | Essentia" : "Legal Notice | Essentia",
    description: isEs
      ? "Aviso legal e información regulatoria de Essentia Social Wellness Club, ubicado en Costa Adeje, Tenerife."
      : "Legal notice and regulatory information for Essentia Social Wellness Club, located in Costa Adeje, Tenerife.",
    alternates: {
      canonical: isEs ? "/es/legal" : "/legal",
      languages: {
        en: "/legal",
        es: "/es/legal",
        "x-default": "/legal",
      },
    },
  };
}

export default async function LegalNoticePage() {
  const locale = await getLocale();

  if (locale === "es") {
    return (
      <>
        <h1>Aviso Legal</h1>
        <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
          Última actualización: mayo 2026
        </p>

        <p>
          En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la
          Sociedad de la Información y de Comercio Electrónico (LSSI-CE),
          facilitamos la siguiente información identificativa.
        </p>

        <h2>1. Información identificativa</h2>
        <p>
          <strong>Nombre comercial:</strong> Essentia Social Wellness Club
          <br />
          <strong>Domicilio social:</strong> Baobab Suites, Costa Adeje,
          Tenerife, Islas Canarias, España
          <br />
          <strong>Correo electrónico de contacto:</strong>{" "}
          <a href="mailto:info@essentiawellnessclub.com">
            info@essentiawellnessclub.com
          </a>
          <br />
          <strong>Teléfono:</strong>{" "}
          <a href="tel:+34922123456">+34 922 123 456</a>
          <br />
          <strong>Sitio web:</strong> essentiawellnessclub.com
        </p>

        <h2>2. Propiedad intelectual</h2>
        <p>
          Todos los contenidos de este sitio web (incluidos textos, imágenes,
          gráficos, logotipos, iconos, clips de audio y software) son propiedad
          exclusiva de Essentia Social Wellness Club o de sus proveedores de
          contenido, y están protegidos por la legislación de propiedad
          intelectual aplicable.
        </p>
        <p>
          Queda estrictamente prohibida la reproducción, distribución,
          comunicación pública o transformación de cualquier parte de este sitio
          web sin autorización previa y por escrito.
        </p>

        <h2>3. Uso aceptable</h2>
        <p>
          Usted se compromete a utilizar este sitio web únicamente con fines
          lícitos y de un modo que no infrinja los derechos de terceros ni
          restrinja su uso. Los usos prohibidos incluyen:
        </p>
        <ul>
          <li>Transmitir comunicaciones comerciales no solicitadas.</li>
          <li>
            Intentar acceder sin autorización a cualquier parte del sitio.
          </li>
          <li>
            Reproducir o redistribuir cualquier contenido sin permiso escrito
            expreso.
          </li>
          <li>
            Utilizar herramientas automatizadas para extraer, rastrear o indexar
            el contenido del sitio sin consentimiento.
          </li>
        </ul>

        <h2>4. Limitación de responsabilidad</h2>
        <p>
          Essentia Social Wellness Club realiza esfuerzos razonables para
          garantizar que la información de este sitio web sea exacta y esté
          actualizada. No obstante, no garantizamos la integridad o exactitud de
          la información proporcionada y no asumimos ninguna responsabilidad por
          errores u omisiones.
        </p>
        <p>
          No somos responsables de ningún daño directo, indirecto o consecuente
          derivado del uso, o de la imposibilidad de uso, de este sitio web o su
          contenido.
        </p>

        <h2>5. Enlaces a terceros</h2>
        <p>
          Este sitio web puede contener enlaces a sitios web de terceros. Dichos
          enlaces se facilitan únicamente por conveniencia. Essentia Social
          Wellness Club no controla el contenido de esos sitios y no asume
          ninguna responsabilidad respecto a ellos ni por las pérdidas o daños
          que puedan derivarse de su uso.
        </p>

        <h2>6. Ley aplicable y jurisdicción</h2>
        <p>
          El presente Aviso Legal se rige por la legislación española. Cualquier
          controversia relacionada con este sitio web estará sometida a la
          jurisdicción exclusiva de los Juzgados y Tribunales de Santa Cruz de
          Tenerife, España, salvo que las disposiciones imperativas de
          protección al consumidor exijan otra cosa.
        </p>

        <h2>7. Contacto</h2>
        <p>
          Para cualquier consulta relativa a este Aviso Legal, contáctenos en{" "}
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
      <h1>Legal Notice</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: May 2026
      </p>

      <p>
        In compliance with Law 34/2002 of 11 July on Information Society
        Services and Electronic Commerce (LSSI-CE), we provide the following
        identifying information.
      </p>

      <h2>1. Identifying Information</h2>
      <p>
        <strong>Trading name:</strong> Essentia Social Wellness Club
        <br />
        <strong>Registered address:</strong> Baobab Suites, Costa Adeje,
        Tenerife, Islas Canarias, España
        <br />
        <strong>Contact email:</strong>{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>
        <br />
        <strong>Phone:</strong> <a href="tel:+34922123456">+34 922 123 456</a>
        <br />
        <strong>Website:</strong> essentiawellnessclub.com
      </p>

      <h2>2. Intellectual Property</h2>
      <p>
        All content on this website (including text, images, graphics, logos,
        icons, audio clips, and software) is the exclusive property of Essentia
        Social Wellness Club or its content suppliers and is protected by
        applicable intellectual property laws.
      </p>
      <p>
        Reproduction, distribution, public communication, or transformation of
        any part of this website without prior written authorisation is strictly
        prohibited.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>
        You agree to use this website only for lawful purposes and in a way that
        does not infringe the rights of others or restrict their use. Prohibited
        uses include:
      </p>
      <ul>
        <li>Transmitting unsolicited commercial communications.</li>
        <li>Attempting to gain unauthorised access to any part of the site.</li>
        <li>
          Reproducing or redistributing any content without express written
          permission.
        </li>
        <li>
          Using automated tools to scrape, crawl, or index site content without
          consent.
        </li>
      </ul>

      <h2>4. Limitation of Liability</h2>
      <p>
        Essentia Social Wellness Club makes reasonable efforts to ensure that
        information on this website is accurate and up to date. However, we do
        not warrant the completeness or accuracy of any information provided and
        accept no liability for any errors or omissions.
      </p>
      <p>
        We are not liable for any direct, indirect, or consequential loss
        arising from the use of, or inability to use, this website or its
        content.
      </p>

      <h2>5. Third-Party Links</h2>
      <p>
        This website may contain links to third-party websites. These links are
        provided for convenience only. Essentia Social Wellness Club has no
        control over the content of those sites and accepts no responsibility
        for them or for any loss or damage that may arise from your use of them.
      </p>

      <h2>6. Governing Law and Jurisdiction</h2>
      <p>
        This Legal Notice is governed by Spanish law. Any disputes arising in
        connection with this website shall be subject to the exclusive
        jurisdiction of the Courts of Santa Cruz de Tenerife, Spain, unless
        mandatory consumer protection provisions require otherwise.
      </p>

      <h2>7. Contact</h2>
      <p>
        For any questions regarding this Legal Notice, please contact us at{" "}
        <a href="mailto:info@essentiawellnessclub.com">
          info@essentiawellnessclub.com
        </a>
        .
      </p>
    </>
  );
}
