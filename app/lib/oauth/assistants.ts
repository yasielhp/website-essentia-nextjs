/**
 * Which assistant a connection belongs to, and the connections of one assistant
 * folded into one.
 *
 * An assistant registers itself under whatever name it likes, so the name is
 * all there is to go on: anything mentioning ChatGPT or OpenAI is ChatGPT,
 * anything mentioning Claude or Anthropic is Claude, and the rest is "other".
 * Each time a connection is refreshed a new row replaces the old one, and the
 * same assistant can be authorized more than once, so a person can hold several
 * rows for what is, to them, one connection.
 */

export type KnownAssistant = "chatgpt" | "claude";

export function assistantOf(clientName: string): KnownAssistant | null {
  const name = clientName.toLowerCase();
  if (name.includes("chatgpt") || name.includes("openai")) return "chatgpt";
  if (name.includes("claude") || name.includes("anthropic")) return "claude";
  return null;
}

export type ConnectionRow = {
  id: string;
  clientName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** One assistant as the person sees it: connected since the latest row, last used at the latest use, and every row to cut off together. */
export type ConnectionGroup = {
  /** The name to show: the most recent row's. */
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  ids: string[];
};

function fold(rows: ConnectionRow[]): ConnectionGroup | null {
  if (rows.length === 0) return null;
  const newest = rows.reduce((a, b) => (b.createdAt > a.createdAt ? b : a));
  const used = rows
    .map((r) => r.lastUsedAt)
    .filter((d): d is string => d !== null)
    .sort();
  return {
    name: newest.clientName,
    createdAt: newest.createdAt,
    lastUsedAt: used.length > 0 ? used[used.length - 1]! : null,
    ids: rows.map((r) => r.id),
  };
}

export type GroupedConnections = {
  chatgpt: ConnectionGroup | null;
  claude: ConnectionGroup | null;
  /** Everything else, one entry per name (ignoring case), newest first. */
  others: ConnectionGroup[];
};

export function groupConnections(rows: ConnectionRow[]): GroupedConnections {
  const byName = new Map<string, ConnectionRow[]>();
  const known: Record<KnownAssistant, ConnectionRow[]> = {
    chatgpt: [],
    claude: [],
  };
  for (const row of rows) {
    const assistant = assistantOf(row.clientName);
    if (assistant) {
      known[assistant].push(row);
    } else {
      const key = row.clientName.trim().toLowerCase();
      byName.set(key, [...(byName.get(key) ?? []), row]);
    }
  }
  return {
    chatgpt: fold(known.chatgpt),
    claude: fold(known.claude),
    others: [...byName.values()]
      .map((group) => fold(group)!)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}
