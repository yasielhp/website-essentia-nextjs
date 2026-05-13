import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | Essentia",
  description:
    "Learn how Essentia uses cookies and similar technologies on our website, and how to manage your preferences.",
};

export default function CookiePolicyPage() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-petroleum-400 mt-1 mb-8 text-xs tracking-widest uppercase">
        Last updated: May 2026
      </p>

      <p>
        This Cookie Policy explains how Essentia Social Wellness Club
        ("Essentia", "we", "us") uses cookies and similar tracking technologies
        on our website (essentiawellnessclub.com), and how you can manage your
        preferences.
      </p>

      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files placed on your device when you visit a
        website. They allow the site to remember your actions and preferences
        over a period of time, so you do not have to re-enter them each time you
        visit. Cookies can be "session" (deleted when you close your browser) or
        "persistent" (remain on your device for a set period).
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
        "Cookie Settings" link in the footer. You can also control cookies
        through your browser settings:
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
