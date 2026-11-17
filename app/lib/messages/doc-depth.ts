/** The deepest a message body may nest: a list in a quote in a column is 6. */
export const MAX_DOC_DEPTH = 30;

/**
 * How many levels deep a document goes, the root counting as one, without
 * recursion: it is run on a body nobody has validated yet, so the counter must
 * not be the thing that overflows the stack on a hostile one. Only `content`
 * is followed (the nesting of a document is its content); any other shape
 * counts as no children.
 */
export function docDepth(doc: unknown): number {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return 0;
  let deepest = 0;
  const stack: { node: unknown; depth: number }[] = [{ node: doc, depth: 1 }];
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!;
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      continue;
    }
    if (depth > deepest) deepest = depth;
    const content = (node as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const child of content) stack.push({ node: child, depth: depth + 1 });
  }
  return deepest;
}
