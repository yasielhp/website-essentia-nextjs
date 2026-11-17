/**
 * The email as the preview frame is given it.
 *
 * The frame is sandboxed with nothing allowed, so no script runs in it, but a
 * link in it would still navigate the frame itself, away from the preview.
 * Every link is sent to a new window instead (which the sandbox then refuses to
 * open: a click does nothing) and given a rel that cuts the opener. Done here,
 * on the client, when the frame's document is put together: the HTML the server
 * builds is the one that goes out as email, and is not touched.
 */
export function previewSrcDoc(html: string): string {
  const base = '<base target="_blank">';
  const withBase = /<head(\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}${base}`)
    : `${base}${html}`;
  return withBase.replace(/<a(\s[^>]*)?>/gi, (anchor) => {
    const cleaned = anchor
      .replace(/\s(?:rel|target)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
      .replace(/>$/, "");
    return `${cleaned} target="_blank" rel="noopener noreferrer">`;
  });
}
