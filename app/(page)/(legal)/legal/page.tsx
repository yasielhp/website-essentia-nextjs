import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Notice | Essentia",
  description:
    "Legal notice and regulatory information for Essentia Social Wellness Club, located in Costa Adeje, Tenerife.",
};

export default function LegalNoticePage() {
  return (
    <>
      <h1>Legal Notice</h1>
      <p className="text-petroleum-400 text-sm">Last updated: May 2026</p>

      <p>
        In compliance with Law 34/2002 of 11 July on Information Society Services
        and Electronic Commerce (LSSI-CE), we provide the following identifying
        information.
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
        <strong>Phone:</strong>{" "}
        <a href="tel:+34922123456">+34 922 123 456</a>
        <br />
        <strong>Website:</strong> essentiawellnessclub.com
      </p>

      <h2>2. Intellectual Property</h2>
      <p>
        All content on this website — including but not limited to text, images,
        graphics, logos, icons, audio clips, and software — is the exclusive
        property of Essentia Social Wellness Club or its content suppliers and is
        protected by applicable intellectual property laws.
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
        We are not liable for any direct, indirect, or consequential loss arising
        from the use of, or inability to use, this website or its content.
      </p>

      <h2>5. Third-Party Links</h2>
      <p>
        This website may contain links to third-party websites. These links are
        provided for convenience only. Essentia Social Wellness Club has no
        control over the content of those sites and accepts no responsibility for
        them or for any loss or damage that may arise from your use of them.
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
