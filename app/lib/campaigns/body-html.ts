/**
 * Turns the plain-text body of a campaign into the HTML that goes inside the
 * email template.
 *
 * Deliberately not Markdown. The email goes out in the centre's name to the
 * whole list, so the admin gets exactly three constructs — a blank line for a
 * new paragraph, `**bold**`, and `[label](https://url)` — and everything else
 * is escaped. A stray tag would break the layout in some client; a link that
 * is not https looks like phishing and gets the domain flagged. Fewer rules
 * means nothing to get wrong in a hurry.
 */

const PARAGRAPH_STYLE =
  "margin:0 0 16px;font-size:16px;line-height:1.6;color:#103838;";
const LINK_STYLE = "color:#335554;text-decoration:underline;";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// The URL may contain no whitespace and no `)`, which is also what closes the
// construct. Quotes have already been escaped to `&quot;` by the time this
// runs, so they cannot end the href attribute.
const LINK_PATTERN = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/gi;
const BOLD_PATTERN = /\*\*(.+?)\*\*/g;

function paragraphToHtml(paragraph: string): string {
  const html = escapeHtml(paragraph)
    .replace(BOLD_PATTERN, "<strong>$1</strong>")
    .replace(
      LINK_PATTERN,
      (_match, label: string, url: string) =>
        `<a href="${url}" style="${LINK_STYLE}">${label}</a>`,
    )
    .replace(/\n/g, "<br />");
  return `<p style="${PARAGRAPH_STYLE}">${html}</p>`;
}

export function bodyToHtml(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map(paragraphToHtml)
    .join("");
}

const FIRST_NAME_TOKEN = /\{\{\s*first_name\s*\}\}/g;
// With no name to insert, the token goes together with the one space before
// it, so "Hola {{first_name}}, bienvenida" reads "Hola, bienvenida" and not
// "Hola , bienvenida". Only one space: a deliberate double space is theirs.
const FIRST_NAME_TOKEN_WITH_SPACE = / ?\{\{\s*first_name\s*\}\}/g;

/**
 * Fills `{{first_name}}` in either the subject or the body. Escaping is on by
 * default because the body is HTML; the subject is plain text and passes
 * `escape: false`, or a subscriber called "Ana & Luis" would read `&amp;`.
 */
export function renderVariables(
  text: string,
  vars: { first_name: string },
  options: { escape?: boolean } = {},
): string {
  const firstName = vars.first_name.trim();
  if (firstName.length === 0) {
    return text.replace(FIRST_NAME_TOKEN_WITH_SPACE, "").trim();
  }
  const value = options.escape === false ? firstName : escapeHtml(firstName);
  return text.replace(FIRST_NAME_TOKEN, value);
}
