/**
 * How a campaign is handed to an AI assistant.
 *
 * The assistant only reads campaigns. A WhatsApp campaign spends money and the
 * number's reputation, so creating, changing, sending and activating it stay in
 * the dashboard; there is no tool for them (a test keeps it so). What it reads
 * says the channel, and for WhatsApp the template and how many parameters it
 * has, never the parameters themselves: a fixed one is text the admin typed and
 * may carry a name or a number.
 */

type Counters = {
  recipients_count?: number;
  delivered_count?: number;
  opened_count?: number;
  clicked_count?: number;
};

type Row = Counters & {
  channel?: string | null;
  content?: Record<string, unknown> | null;
  [key: string]: unknown;
};

const rate = (n: number, of: number) =>
  of > 0 ? Math.round((n / of) * 1000) / 10 : null;

const channelOf = (row: { channel?: string | null }) =>
  row.channel === "whatsapp" ? "whatsapp" : "email";

type EmailBlock = {
  subject?: string;
  preheader?: string;
  title?: string;
  doc?: unknown;
} | null;

/** One campaign in full: the row, its rates and a summary of its content. */
export function shapeCampaign(campaign: Row): Record<string, unknown> {
  const { content, ...rest } = campaign;
  const channel = channelOf(campaign);
  const recipients = campaign.recipients_count ?? 0;
  const delivered = campaign.delivered_count ?? 0;
  const opened = campaign.opened_count ?? 0;
  const clicked = campaign.clicked_count ?? 0;

  if (channel === "whatsapp") {
    const { opened_count, clicked_count, ...kept } = rest;
    void opened_count;
    void clicked_count;
    const block = (content ?? {}).whatsapp as
      { templateId?: string | null; params?: unknown[] } | undefined;
    return {
      ...kept,
      channel,
      // On WhatsApp an "open" is a read receipt and Meta reports no clicks.
      read_count: opened,
      rates_percent: {
        delivered: rate(delivered, recipients),
        read: rate(opened, delivered),
      },
      whatsapp: {
        template_id: block?.templateId ?? null,
        parameter_count: Array.isArray(block?.params) ? block.params.length : 0,
      },
    };
  }

  return {
    ...rest,
    channel,
    rates_percent: {
      delivered: rate(delivered, recipients),
      opened: rate(opened, delivered),
      clicked: rate(clicked, delivered),
    },
    content_summary: Object.fromEntries(
      Object.entries((content ?? {}) as Record<string, EmailBlock>)
        .filter(([language]) => language !== "whatsapp")
        .map(([language, block]) => [
          language,
          {
            subject: block?.subject ?? null,
            preheader: block?.preheader ?? null,
            title: block?.title ?? null,
            body_characters: block?.doc ? JSON.stringify(block.doc).length : 0,
          },
        ]),
    ),
  };
}

/** The rows of the list: the channel on each, and WhatsApp's counters by their name. */
export function shapeCampaignListing(rows: Row[]): Record<string, unknown>[] {
  return rows.map((row) => {
    const channel = channelOf(row);
    if (channel === "whatsapp") {
      const { opened_count, clicked_count, ...kept } = row;
      void clicked_count;
      return { ...kept, channel, read_count: opened_count };
    }
    return { ...row, channel };
  });
}
