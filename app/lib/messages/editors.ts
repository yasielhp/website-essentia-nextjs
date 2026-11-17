import type { MessageTemplateRowView } from "./types";

/**
 * Who saved each message. The column holds a user id; the list shows a name.
 * Pure: the action reads the profiles and hands the map in.
 */

type RawRow = {
  key?: unknown;
  channel?: unknown;
  locale?: unknown;
  updated_by?: unknown;
};

/** Name of each profile that has one, keyed by id. */
export function editorNames(
  profiles: {
    id: string;
    full_name?: string | null;
    first_name?: string | null;
  }[],
): Map<string, string> {
  const names = new Map<string, string>();
  for (const profile of profiles) {
    const name = [profile.full_name, profile.first_name].find(
      (candidate) => candidate && candidate.trim() !== "",
    );
    if (name) names.set(profile.id, name.trim());
  }
  return names;
}

/** The ids of whoever saved something, without repeats. */
export function editorIds(raw: RawRow[]): string[] {
  return [
    ...new Set(
      raw.flatMap((row) =>
        typeof row.updated_by === "string" ? [row.updated_by] : [],
      ),
    ),
  ];
}

export function withEditors(
  rows: MessageTemplateRowView[],
  raw: RawRow[],
  names: Map<string, string>,
): MessageTemplateRowView[] {
  return rows.map((row) => {
    const source = raw.find(
      (item) =>
        item.key === row.key &&
        item.channel === row.channel &&
        item.locale === row.locale,
    );
    const id = typeof source?.updated_by === "string" ? source.updated_by : "";
    return { ...row, updated_by_name: names.get(id) ?? null };
  });
}
